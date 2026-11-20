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
  IF p_path NOT LIKE (r.id::text || '/r' || p_round::text || '-' || p_player::text || '-%') THEN
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
REVOKE ALL ON FUNCTION public.submit_answer(text, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_answer(text, uuid, integer, text, text) TO service_role;