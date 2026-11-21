/**
 * Edit this list to change the game's prompts. They play in order,
 * one round per prompt.
 */
export const PROMPTS: readonly string[] = [
  "Who's most likely to fall asleep first at camp?",
  "Who's most likely to get married first?",
  "Who's most likely to become famous?",
  "Who's most likely to get arrested?",
  "Who's most likely to secretly bring alcohol to camp?",
  "Who is most likely to be the next ISA President?",
  "Who's most likely to have a hidden talent?",
  "Who's most likely to give the best advice?",
];

export const TOTAL_ROUNDS = PROMPTS.length;

export function promptForRound(round: number): string {
  return PROMPTS[round - 1] ?? "";
}

export const AVATARS: readonly { emoji: string; label: string }[] = [
  { emoji: "⛺", label: "Tent" },
  { emoji: "🛶", label: "Canoe" },
  { emoji: "🍡", label: "Marshmallow" },
  { emoji: "🔥", label: "Campfire" },
  { emoji: "🐻", label: "Bear" },
  { emoji: "🦉", label: "Owl" },
  { emoji: "🌲", label: "Pine tree" },
  { emoji: "🧭", label: "Compass" },
  { emoji: "🦝", label: "Raccoon" },
  { emoji: "🦊", label: "Fox" },
  { emoji: "🐿️", label: "Chipmunk" },
  { emoji: "🏕️", label: "Campsite" },
  { emoji: "🔦", label: "Flashlight" },
  { emoji: "🎣", label: "Fishing rod" },
  { emoji: "🌙", label: "Moon" },
  { emoji: "🐸", label: "Frog" },
];

export const ROUND_TIMER_OPTIONS = [60, 120, 180] as const;
export const DEFAULT_ROUND_SECONDS = 120;
