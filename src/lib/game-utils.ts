/** Pure game helpers shared by the browser and the server. */

// No I or O (look like 1 and 0).
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LENGTH = 4;

export function generateRoomCode(random: () => number = secureRandom): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 4294967296;
}

export function normalizeCodeInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, CODE_LENGTH);
}

export function isValidCode(code: string): boolean {
  return /^[A-Z]{4}$/.test(code);
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same seed → same order on every device. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const rand = mulberry32(hashString(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export type RevealCard = { key: string; name: string; url: string };
export type RevealGroup = { name: string; count: number; cards: RevealCard[] };

/** Groups cards by name (case/space-insensitive), most-picked first. */
export function groupCards(cards: readonly RevealCard[]): RevealGroup[] {
  const map = new Map<string, RevealCard[]>();
  for (const c of cards) {
    const k = normalizeName(c.name);
    const list = map.get(k) ?? [];
    list.push(c);
    map.set(k, list);
  }
  const groups: RevealGroup[] = [];
  for (const list of map.values()) {
    // Display the most common spelling.
    const spellings = new Map<string, number>();
    for (const c of list) {
      const n = cleanName(c.name);
      spellings.set(n, (spellings.get(n) ?? 0) + 1);
    }
    const best = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    groups.push({ name: best, count: list.length, cards: list });
  }
  return groups.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Names that get the "Camp Favorite" ribbon: most picks, picked at least twice. */
export function favoriteNames(groups: readonly RevealGroup[]): Set<string> {
  const top = groups[0]?.count ?? 0;
  if (top < 2) return new Set();
  return new Set(groups.filter((g) => g.count === top).map((g) => normalizeName(g.name)));
}

export const REVEAL_INTRO_MS = 2500;
export const REVEAL_CARD_MS = 1000;

export type RevealStage =
  | { kind: "intro" }
  | { kind: "cards"; shown: number }
  | { kind: "final" };

/** Where every device should be in the reveal, from the shared start time. */
export function revealStage(elapsedMs: number, cardCount: number): RevealStage {
  if (elapsedMs < REVEAL_INTRO_MS) return { kind: "intro" };
  if (cardCount === 0) return { kind: "final" };
  const afterIntro = elapsedMs - REVEAL_INTRO_MS;
  if (afterIntro >= cardCount * REVEAL_CARD_MS) return { kind: "final" };
  return { kind: "cards", shown: Math.floor(afterIntro / REVEAL_CARD_MS) + 1 };
}

export function remainingMs(
  roundStartedAt: string | null,
  durationSeconds: number,
  serverNow: number,
): number {
  if (!roundStartedAt) return durationSeconds * 1000;
  const end = Date.parse(roundStartedAt) + durationSeconds * 1000;
  return Math.max(0, end - serverNow);
}

export function photoPathFor(roomId: string, round: number, playerId: string, id: string): string {
  return `${roomId}/r${round}-${playerId}-${id}.jpg`;
}
