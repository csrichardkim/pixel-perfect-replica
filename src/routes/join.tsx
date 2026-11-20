import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampScene } from "@/components/camp/CampScene";
import { WoodSign } from "@/components/camp/bits";
import { supabase } from "@/integrations/supabase/client";
import { joinRoom } from "@/lib/game.functions";
import { isValidCode, normalizeCodeInput } from "@/lib/game-utils";
import { AVATARS } from "@/lib/prompts";
import { session } from "@/lib/session";
import { cn } from "@/lib/utils";

type JoinSearch = { code?: string };

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>): JoinSearch => {
    const c = typeof s["code"] === "string" ? normalizeCodeInput(s["code"]) : "";
    return c ? { code: c } : {};
  },
  head: () => ({
    meta: [
      { title: "Join a Room · Camp Who's Most Likely To" },
      { name: "description", content: "Enter your 4-letter room code to join the campfire game." },
      { property: "og:title", content: "Join a Room · Camp Who's Most Likely To" },
      { property: "og:description", content: "Enter your 4-letter room code to join the campfire game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState(search.code ?? "");
  const [step, setStep] = useState<"code" | "profile">("code");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATARS[0]?.emoji ?? "⛺");
  const [joining, setJoining] = useState(false);
  const autoChecked = useRef(false);

  const checkCode = useCallback(
    async (c: string) => {
      setError(null);
      if (!isValidCode(c)) {
        setError("Room codes are 4 letters.");
        return;
      }
      setChecking(true);
      try {
        const { data: room, error: err } = await supabase
          .from("rooms")
          .select("id, status")
          .eq("code", c)
          .maybeSingle();
        if (err) throw err;
        if (!room) {
          setError("Hmm, no room with that code. Double-check with your host!");
          return;
        }
        if (room.status === "ended") {
          setError("That game has already ended.");
          return;
        }
        // Rejoin automatically if this phone already joined.
        const saved = session.getPlayerId(c);
        if (saved) {
          const { data: p } = await supabase
            .from("players")
            .select("id")
            .eq("id", saved)
            .eq("room_id", room.id)
            .maybeSingle();
          if (p) {
            await navigate({ to: "/play/$code", params: { code: c } });
            return;
          }
          session.clearPlayer(c);
        }
        setStep("profile");
      } catch {
        setError("Couldn't reach camp. Check your signal and try again.");
      } finally {
        setChecking(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (search.code && !autoChecked.current) {
      autoChecked.current = true;
      void checkCode(search.code);
    }
  }, [search.code, checkCode]);

  async function join() {
    if (!name.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const res = await joinRoom({ data: { code, name: name.trim(), avatar } });
      if (!res.ok) {
        setError(
          res.error === "room_ended"
            ? "That game has already ended."
            : res.error === "room_not_found"
              ? "That room doesn't exist anymore."
              : res.error === "room_full"
                ? "This room is full!"
                : "Couldn't join. Try again.",
        );
        setJoining(false);
        return;
      }
      session.setPlayerId(code, res.playerId);
      await navigate({ to: "/play/$code", params: { code } });
    } catch {
      setError("Couldn't reach camp. Check your signal and try again.");
      setJoining(false);
    }
  }

  return (
    <CampScene>
      <main className="flex flex-1 flex-col items-center gap-8 pt-4">
        <WoodSign swing>
          <h1 className="text-2xl sm:text-3xl">{step === "code" ? "Join a Room" : `Room ${code}`}</h1>
        </WoodSign>

        {step === "code" ? (
          <form
            className="panel flex w-full flex-col gap-5 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void checkCode(code);
            }}
          >
            <label className="flex flex-col gap-3 text-center">
              <span className="font-display text-2xl">Enter the room code</span>
              <Input
                value={code}
                onChange={(e) => setCode(normalizeCodeInput(e.target.value))}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={4}
                placeholder="ABCD"
                aria-label="Room code"
                className="h-20 rounded-2xl border-2 border-fire/60 bg-night-deep/70 text-center font-display text-5xl tracking-[0.4em] text-flame uppercase placeholder:text-muted-foreground/30"
              />
            </label>
            {error && <p className="rounded-xl bg-destructive/20 p-3 text-center text-cream">{error}</p>}
            <Button type="submit" variant="camp" size="jumbo" disabled={checking || code.length !== 4}>
              {checking ? "Checking…" : "Next"}
            </Button>
          </form>
        ) : (
          <form
            className="panel flex w-full flex-col gap-5 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void join();
            }}
          >
            <label className="flex flex-col gap-2">
              <span className="font-display text-2xl">Your camp name</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 24))}
                placeholder="e.g. Marshmallow Mike"
                autoComplete="nickname"
                className="h-14 rounded-2xl border-cream/30 bg-night-deep/60 px-4 text-xl text-cream placeholder:text-muted-foreground/70"
              />
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-display text-2xl">Pick your avatar</legend>
              <div className="grid grid-cols-4 gap-2">
                {AVATARS.map((a) => (
                  <button
                    key={a.emoji}
                    type="button"
                    aria-label={a.label}
                    aria-pressed={avatar === a.emoji}
                    onClick={() => setAvatar(a.emoji)}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-2xl border-2 bg-night-deep/60 text-4xl transition-transform active:scale-90",
                      avatar === a.emoji ? "animate-pulse-ring scale-105 border-fire bg-fire/20" : "border-cream/15",
                    )}
                  >
                    {a.emoji}
                  </button>
                ))}
              </div>
            </fieldset>
            {error && <p className="rounded-xl bg-destructive/20 p-3 text-center text-cream">{error}</p>}
            <Button type="submit" variant="camp" size="jumbo" disabled={joining || !name.trim()}>
              {joining ? "Joining…" : `Join as ${avatar}`}
            </Button>
            <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => setStep("code")}>
              Use a different code
            </Button>
          </form>
        )}
      </main>
    </CampScene>
  );
}
