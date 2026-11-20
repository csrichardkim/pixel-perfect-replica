CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby','answering','reveal','ended')),
  current_round integer NOT NULL DEFAULT 0,
  round_started_at timestamptz,
  round_duration_seconds integer NOT NULL DEFAULT 120 CHECK (round_duration_seconds BETWEEN 30 AND 600),
  reveal_started_at timestamptz,
  submitted_count integer NOT NULL DEFAULT 0,
  eligible_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.room_secrets (
  room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  host_token text NOT NULL
);
GRANT ALL ON public.room_secrets TO service_role;
ALTER TABLE public.room_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 24),
  avatar text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX players_room_idx ON public.players(room_id);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round integer NOT NULL,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  chosen_name text NOT NULL CHECK (char_length(chosen_name) BETWEEN 1 AND 40),
  photo_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, round, player_id)
);
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Host check
CREATE OR REPLACE FUNCTION public.check_host(p_code text, p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT r.id INTO v_id FROM rooms r JOIN room_secrets s ON s.room_id = r.id
  WHERE r.code = p_code AND s.host_token = p_token;
  IF v_id IS NULL THEN RAISE EXCEPTION 'not_host'; END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.host_start(p_code text, p_token text, p_duration integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_count integer;
BEGIN
  v_id := check_host(p_code, p_token);
  PERFORM 1 FROM rooms WHERE id = v_id FOR UPDATE;
  SELECT count(*) INTO v_count FROM players WHERE room_id = v_id;
  IF v_count < 2 THEN RAISE EXCEPTION 'need_players'; END IF;
  UPDATE rooms SET status = 'answering', current_round = 1, round_started_at = now(),
    round_duration_seconds = p_duration, reveal_started_at = NULL,
    submitted_count = 0, eligible_count = v_count
  WHERE id = v_id AND status = 'lobby';
END $$;

CREATE OR REPLACE FUNCTION public.host_next(p_code text, p_token text, p_total integer, p_from_round integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; r rooms%ROWTYPE; v_count integer;
BEGIN
  v_id := check_host(p_code, p_token);
  SELECT * INTO r FROM rooms WHERE id = v_id FOR UPDATE;
  -- Ignore stale double-taps
  IF r.current_round <> p_from_round THEN RETURN r.status; END IF;
  IF r.status = 'answering' THEN
    UPDATE rooms SET status = 'reveal', reveal_started_at = now() WHERE id = v_id;
    RETURN 'reveal';
  ELSIF r.status = 'reveal' THEN
    IF r.current_round >= p_total THEN
      UPDATE rooms SET status = 'ended' WHERE id = v_id;
      RETURN 'ended';
    END IF;
    SELECT count(*) INTO v_count FROM players WHERE room_id = v_id;
    UPDATE rooms SET status = 'answering', current_round = r.current_round + 1,
      round_started_at = now(), reveal_started_at = NULL, submitted_count = 0, eligible_count = v_count
    WHERE id = v_id;
    RETURN 'answering';
  END IF;
  RETURN r.status;
END $$;

CREATE OR REPLACE FUNCTION public.host_end(p_code text, p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  v_id := check_host(p_code, p_token);
  UPDATE rooms SET status = 'ended' WHERE id = v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.tick_round(p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE rooms SET status = 'reveal', reveal_started_at = now()
  WHERE code = p_code AND status = 'answering'
    AND round_started_at + make_interval(secs => round_duration_seconds) <= now() + interval '1 second';
END $$;

CREATE OR REPLACE FUNCTION public.submit_answer(p_code text, p_player uuid, p_round integer, p_name text, p_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r rooms%ROWTYPE; v_joined timestamptz; v_old text; v_cnt integer;
BEGIN
  SELECT * INTO r FROM rooms WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF r.status <> 'answering' OR r.current_round <> p_round
     OR now() > r.round_started_at + make_interval(secs => r.round_duration_seconds + 5) THEN
    RAISE EXCEPTION 'round_closed';
  END IF;
  SELECT joined_at INTO v_joined FROM players WHERE id = p_player AND room_id = r.id;
  IF v_joined IS NULL THEN RAISE EXCEPTION 'not_in_room'; END IF;
  IF v_joined > r.round_started_at THEN RAISE EXCEPTION 'next_round'; END IF;
  IF p_path NOT LIKE (r.id::text || '/' || p_round::text || '/' || p_player::text || '/%') THEN
    RAISE EXCEPTION 'bad_path';
  END IF;
  SELECT photo_path INTO v_old FROM submissions WHERE room_id = r.id AND round = p_round AND player_id = p_player;
  INSERT INTO submissions (room_id, round, player_id, chosen_name, photo_path)
  VALUES (r.id, p_round, p_player, p_name, p_path)
  ON CONFLICT (room_id, round, player_id)
  DO UPDATE SET chosen_name = EXCLUDED.chosen_name, photo_path = EXCLUDED.photo_path, created_at = now();
  SELECT count(*) INTO v_cnt FROM submissions WHERE room_id = r.id AND round = p_round;
  IF v_cnt >= r.eligible_count THEN
    UPDATE rooms SET submitted_count = v_cnt, status = 'reveal', reveal_started_at = now() WHERE id = r.id;
  ELSE
    UPDATE rooms SET submitted_count = v_cnt WHERE id = r.id;
  END IF;
  RETURN jsonb_build_object('old_path', CASE WHEN v_old IS DISTINCT FROM p_path THEN v_old END);
END $$;

REVOKE ALL ON FUNCTION public.check_host(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.host_start(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.host_next(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.host_end(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tick_round(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_answer(text, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_host(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.host_start(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.host_next(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.host_end(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tick_round(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_answer(text, uuid, integer, text, text) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;