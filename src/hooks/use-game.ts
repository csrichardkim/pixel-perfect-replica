import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getServerTime } from "@/lib/game.functions";

export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type Player = Database["public"]["Tables"]["players"]["Row"];

/* ---------- Shared server clock ---------- */
let clockOffset = 0;
let clockSynced = false;
let syncing: Promise<void> | null = null;

async function syncClock() {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    try {
      const t0 = Date.now();
      const { now } = await getServerTime();
      const t1 = Date.now();
      const rtt = t1 - t0;
      if (rtt < best) {
        best = rtt;
        clockOffset = now + rtt / 2 - t1;
      }
    } catch {
      /* keep previous offset */
    }
  }
  clockSynced = true;
}

export function serverNow(): number {
  return Date.now() + clockOffset;
}

export function useServerClock() {
  const [, setReady] = useState(clockSynced);
  useEffect(() => {
    if (!syncing) syncing = syncClock();
    void syncing.then(() => setReady(true));
  }, []);
  return serverNow;
}

/** Re-renders every `ms` milliseconds. */
export function useTicker(ms: number, active = true) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms, active]);
}

/* ---------- Room ---------- */
export function useRoom(code: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const latest = useRef<Room | null>(null);

  const apply = useCallback((next: Room) => {
    latest.current = next;
    setRoom(next);
    setState("ready");
  }, []);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
    if (error) return;
    if (!data) {
      setState("missing");
      return;
    }
    apply(data);
  }, [code, apply]);

  useEffect(() => {
    void refresh();
    const channel = supabase
      .channel(`room-${code}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        (payload) => {
          if (payload.eventType === "DELETE") setState("missing");
          else apply(payload.new as Room);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    // Safety net for flaky camp signal.
    const poll = setInterval(() => void refresh(), 4000);
    const onVis = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
      void supabase.removeChannel(channel);
    };
  }, [code, refresh, apply]);

  return { room, state, refresh };
}

/* ---------- Players ---------- */
export function usePlayers(roomId: string | undefined) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true })
      .limit(500);
    if (error) return;
    setPlayers(data ?? []);
    setLoaded(true);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    void refresh();
    const channel = supabase
      .channel(`players-${roomId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const p = payload.new as Player;
          setPlayers((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "players" },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setPlayers((list) => list.filter((x) => x.id !== id));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    const poll = setInterval(() => void refresh(), 8000);
    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [roomId, refresh]);

  return { players, loaded, refresh };
}

/* ---------- Hydration-safe localStorage read ---------- */
const noop = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
