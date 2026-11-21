import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  generateRoomCode,
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

describe("game setup", () => {
  it("plays the 8 prompts in order", () => {
    expect(PROMPTS).toHaveLength(8);
    expect(PROMPTS[0]).toBe("Who's most likely to fall asleep first at camp?");
    expect(PROMPTS[5]).toBe("Who is most likely to be the next ISA President?");
    expect(PROMPTS[7]).toBe("Who's most likely to give the best advice?");
  });

  it("defaults the round timer to 2 minutes and offers 3 minutes", () => {
    expect(DEFAULT_ROUND_SECONDS).toBe(120);
    expect(ROUND_TIMER_OPTIONS).toContain(180);
  });
});
