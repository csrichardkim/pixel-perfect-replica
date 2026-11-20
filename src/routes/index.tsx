import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CampScene } from "@/components/camp/CampScene";
import { createRoom } from "@/lib/game.functions";
import { session } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Camp Who's Most Likely To" },
      { name: "description", content: "Gather 'round! Host or join a campfire game of Who's Most Likely To — vote with a photo." },
      { property: "og:title", content: "Camp Who's Most Likely To" },
      { property: "og:description", content: "Gather 'round! Host or join a campfire game of Who's Most Likely To — vote with a photo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function host() {
    setBusy(true);
    setError(null);
    try {
      const res = await createRoom();
      if (!res.ok) throw new Error(res.error);
      session.setHostToken(res.code, res.hostToken);
      await navigate({ to: "/host/$code", params: { code: res.code } });
    } catch {
      setError("Couldn't light the fire — check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <CampScene fire>
      <main className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <div className="animate-sign-swing flex flex-col items-center gap-3">
          <p className="font-sign text-lg tracking-widest text-flame sm:text-xl">⛺ Camp ⛺</p>
          <h1 className="font-display text-6xl leading-[0.95] text-cream text-glow sm:text-7xl">
            Who's Most
            <br />
            Likely To…
          </h1>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-5">
          <Button asChild variant="camp" size="jumbo" className="w-full">
            <Link to="/join">Join Room</Link>
          </Button>
          <Button variant="pine" size="jumbo" className="w-full" disabled={busy} onClick={() => void host()}>
            {busy ? "Lighting the fire…" : "Host a Game"}
          </Button>
          {error && <p className="rounded-xl bg-destructive/20 p-3 text-cream">{error}</p>}
        </div>

        <p className="text-sm text-muted-foreground">📸 Photos are deleted when the game ends.</p>
      </main>
    </CampScene>
  );
}
