import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TOTAL_ROUNDS } from "./prompts";
import { cleanName, generateRoomCode, photoPathFor, seededShuffle } from "./game-utils";
import { purgeOldRooms, purgeRoomData } from "./game.server";

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}$/);
const token = z.string().min(20).max(200);
const uuid = z.string().uuid();

type Fail = { ok: false; error: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function rpcError(message: string | undefined): string {
  const m = message ?? "";
  for (const k of [
    "not_host",
    "need_players",
    "round_closed",
    "not_in_room",
    "next_round",
    "bad_path",
    "room_not_found",
  ]) {
    if (m.includes(k)) return k;
  }
  return "server_error";
}

export const getServerTime = createServerFn({ method: "GET" }).handler(async () => ({
  now: Date.now(),
}));

export const createRoom = createServerFn({ method: "POST" }).handler(async () => {
  const db = await admin();
  await purgeOldRooms(db).catch((e) => console.error("old room cleanup", e));
  for (let i = 0; i < 12; i++) {
    const roomCode = generateRoomCode();
    const { data, error } = await db.from("rooms").insert({ code: roomCode }).select("id, code").single();
    if (error) {
      if (error.code === "23505") continue; // duplicate code → try another
      console.error("createRoom", error.message);
      return { ok: false, error: "server_error" } as Fail;
    }
    const hostToken = crypto.randomUUID() + crypto.randomUUID();
    const { error: secretErr } = await db
      .from("room_secrets")
      .insert({ room_id: data.id, host_token: hostToken });
    if (secretErr) {
      await db.from("rooms").delete().eq("id", data.id);
      return { ok: false, error: "server_error" } as Fail;
    }
    return { ok: true as const, code: data.code, hostToken };
  }
  return { ok: false, error: "busy" } as Fail;
});

export const verifyHost = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, token }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.rpc("check_host", { p_code: data.code, p_token: data.token });
    return { ok: !error };
  });

export const startGame = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code, token, duration: z.number().int().min(30).max(600) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.rpc("host_start", {
      p_code: data.code,
      p_token: data.token,
      p_duration: data.duration,
    });
    if (error) return { ok: false, error: rpcError(error.message) } as Fail;
    return { ok: true as const };
  });

export const hostNext = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ code, token, fromRound: z.number().int().min(0).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: status, error } = await db.rpc("host_next", {
      p_code: data.code,
      p_token: data.token,
      p_total: TOTAL_ROUNDS,
      p_from_round: data.fromRound,
    });
    if (error) return { ok: false, error: rpcError(error.message) } as Fail;
    if (status === "ended") {
      const { data: room } = await db.from("rooms").select("id").eq("code", data.code).single();
      if (room) await purgeRoomData(db, room.id);
    }
    return { ok: true as const, status: status as string };
  });

export const endGame = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, token }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: roomId, error } = await db.rpc("host_end", {
      p_code: data.code,
      p_token: data.token,
    });
    if (error || !roomId) return { ok: false, error: rpcError(error?.message) } as Fail;
    await purgeRoomData(db, roomId);
    return { ok: true as const };
  });

/** Any device may call this when its countdown hits zero; the DB only acts if time is really up. */
export const tickRound = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    await db.rpc("tick_round", { p_code: data.code });
    return { ok: true as const };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code,
        name: z.string().trim().min(1).max(24),
        avatar: z.string().min(1).max(16),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: room } = await db.from("rooms").select("id, status").eq("code", data.code).maybeSingle();
    if (!room) return { ok: false, error: "room_not_found" } as Fail;
    if (room.status === "ended") return { ok: false, error: "room_ended" } as Fail;
    const { count } = await db
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    if ((count ?? 0) >= 120) return { ok: false, error: "room_full" } as Fail;
    const { data: player, error } = await db
      .from("players")
      .insert({ room_id: room.id, name: cleanName(data.name), avatar: data.avatar })
      .select("id")
      .single();
    if (error || !player) return { ok: false, error: "server_error" } as Fail;
    return { ok: true as const, playerId: player.id };
  });

async function loadPlayerRoom(roomCode: string, playerId: string) {
  const db = await admin();
  const { data: room } = await db.from("rooms").select("*").eq("code", roomCode).maybeSingle();
  if (!room) return { db, room: null, player: null };
  const { data: player } = await db
    .from("players")
    .select("id, joined_at")
    .eq("id", playerId)
    .eq("room_id", room.id)
    .maybeSingle();
  return { db, room, player };
}

export const getUploadTarget = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, playerId: uuid, round: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const { db, room, player } = await loadPlayerRoom(data.code, data.playerId);
    if (!room || !player) return { ok: false, error: "not_in_room" } as Fail;
    if (room.status !== "answering" || room.current_round !== data.round)
      return { ok: false, error: "round_closed" } as Fail;
    const path = photoPathFor(room.id, data.round, player.id, crypto.randomUUID().slice(0, 8));
    const { data: signed, error } = await db.storage.from("photos").createSignedUploadUrl(path);
    if (error || !signed) return { ok: false, error: "server_error" } as Fail;
    return { ok: true as const, path, token: signed.token };
  });

export const submitAnswer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code,
        playerId: uuid,
        round: z.number().int(),
        name: z.string().trim().min(1).max(40),
        path: z.string().min(10).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: res, error } = await db.rpc("submit_answer", {
      p_code: data.code,
      p_player: data.playerId,
      p_round: data.round,
      p_name: cleanName(data.name),
      p_path: data.path,
    });
    if (error) return { ok: false, error: rpcError(error.message) } as Fail;
    const oldPath = (res as { old_path?: string | null } | null)?.old_path;
    if (oldPath) await db.storage.from("photos").remove([oldPath]);
    return { ok: true as const };
  });

export const getMySubmission = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, playerId: uuid, round: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const { db, room, player } = await loadPlayerRoom(data.code, data.playerId);
    if (!room || !player) return { chosenName: null as string | null };
    const { data: sub } = await db
      .from("submissions")
      .select("chosen_name")
      .eq("room_id", room.id)
      .eq("round", data.round)
      .eq("player_id", player.id)
      .maybeSingle();
    return { chosenName: sub?.chosen_name ?? null };
  });

/** Anonymous reveal: names + signed photo links, same shuffled order for everyone. */
export const getReveal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code, round: z.number().int() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: room } = await db
      .from("rooms")
      .select("id, status, current_round")
      .eq("code", data.code)
      .maybeSingle();
    if (!room || room.status !== "reveal" || room.current_round !== data.round)
      return { cards: [] as { key: string; name: string; url: string }[] };
    const { data: subs } = await db
      .from("submissions")
      .select("id, chosen_name, photo_path")
      .eq("room_id", room.id)
      .eq("round", data.round)
      .order("id");
    const list = subs ?? [];
    if (list.length === 0) return { cards: [] };
    const { data: signed } = await db.storage.from("photos").createSignedUrls(
      list.map((s) => s.photo_path),
      60 * 60 * 2,
    );
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedURL]));
    const cards = list
      .map((s, i) => ({
        key: `c${i}-${s.id.slice(0, 6)}`,
        name: s.chosen_name,
        // Relative to the storage API; the browser prefixes its own backend URL.
        url: byPath.get(s.photo_path) ?? "",
      }))
      .filter((c) => c.url);
    return { cards: seededShuffle(cards, `${room.id}:${data.round}`) };
  });
