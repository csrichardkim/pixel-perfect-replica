import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  favoriteNames,
  generateRoomCode,
  groupCards,
  normalizeCodeInput,
  revealStage,
  seededShuffle,
} from "@/lib/game-utils";
import { PROMPTS, ROUND_TIMER_OPTIONS, DEFAULT_ROUND_SECONDS } from "@/lib/prompts";

describe("room codes", () => {
  it("are 4 uppercase letters without I or O", () => {
    for (let i = 0; i < 500; i++) {
      const c = generateRoomCode();
      expect(c).toMatch(/^[A-Z]{4}$/);
      expect(c).not.toMatch(/[IO]/);
    }
    expect(CODE_ALPHABET).not.toContain("I");
    expect(CODE_ALPHABET).not.toContain("O");
  });

  it("auto-uppercases typed input and keeps 4 letters", () => {
    expect(normalizeCodeInput("ab1c-dz")).toBe("ABCD");
  });
});

describe("reveal timing", () => {
  it("shows the prompt for 2.5s, then one card every 1s, then the collage", () => {
    expect(revealStage(0, 3)).toEqual({ kind: "intro" });
    expect(revealStage(2499, 3)).toEqual({ kind: "intro" });
    expect(revealStage(2500, 3)).toEqual({ kind: "cards", shown: 1 });
    expect(revealStage(3499, 3)).toEqual({ kind: "cards", shown: 1 });
    expect(revealStage(3500, 3)).toEqual({ kind: "cards", shown: 2 });
    expect(revealStage(4500, 3)).toEqual({ kind: "cards", shown: 3 });
    expect(revealStage(5500, 3)).toEqual({ kind: "final" });
  });

  it("gives every device the same card order for a round", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    expect(seededShuffle(items, "room:1")).toEqual(seededShuffle(items, "room:1"));
  });
});

describe("collage grouping", () => {
  const card = (name: string, i: number) => ({ key: String(i), name, url: "u" });
  it("groups repeated names (any case/spacing) with a count", () => {
    const groups = groupCards([card("Abigail", 1), card("abigail ", 2), card("Ben", 3), card("ABIGAIL", 4)]);
    expect(groups[0]?.count).toBe(3);
    expect(groups[0]?.name.toLowerCase()).toBe("abigail");
    expect(groups[1]?.count).toBe(1);
  });

  it("crowns the most-picked name only when picked at least twice", () => {
    expect(favoriteNames(groupCards([card("A", 1), card("B", 2)])).size).toBe(0);
    expect([...favoriteNames(groupCards([card("A", 1), card("a", 2), card("B", 3)]))]).toEqual(["a"]);
  });
});

describe("game setup", () => {
  it("plays the 8 prompts in order", () => {
    expect(PROMPTS).toHaveLength(8);
    expect(PROMPTS[0]).toBe("Who's most likely to make friends with a stranger?");
    expect(PROMPTS[7]).toBe("Who's most likely to give the best advice?");
  });

  it("defaults the round timer to 2 minutes and offers 3 minutes", () => {
    expect(DEFAULT_ROUND_SECONDS).toBe(120);
    expect(ROUND_TIMER_OPTIONS).toContain(180);
  });
});
