import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;
const BUCKET = "photos";

/** Deletes every photo, submission and player for a room. Keeps the room row (status ended). */
export async function purgeRoomData(db: Db, roomId: string): Promise<void> {
  const paths = new Set<string>();
  const { data: subs } = await db.from("submissions").select("photo_path").eq("room_id", roomId);
  for (const s of subs ?? []) paths.add(s.photo_path);

  // Catch photos uploaded but never submitted.
  for (let offset = 0; offset < 5000; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list(roomId, { limit: 1000, offset });
    if (error || !data || data.length === 0) break;
    for (const f of data) if (f.id) paths.add(`${roomId}/${f.name}`);
    if (data.length < 1000) break;
  }

  const all = [...paths];
  for (let i = 0; i < all.length; i += 100) {
    const { error } = await db.storage.from(BUCKET).remove(all.slice(i, i + 100));
    if (error) console.error("photo cleanup failed", error.message);
  }
  await db.from("submissions").delete().eq("room_id", roomId);
  await db.from("players").delete().eq("room_id", roomId);
}

/** Removes rooms (and everything in them) older than 24 hours. */
export async function purgeOldRooms(db: Db): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db.from("rooms").select("id").lt("created_at", cutoff).limit(20);
  for (const r of data ?? []) {
    await purgeRoomData(db, r.id);
    await db.from("rooms").delete().eq("id", r.id);
  }
}
