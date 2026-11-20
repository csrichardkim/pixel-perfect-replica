import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { CampScene } from "@/components/camp/CampScene";
import { CountdownBar, PromptText, RoundBadge, WoodSign } from "@/components/camp/bits";
import { EndGameButton } from "@/components/camp/EndGameButton";
import { RevealShow } from "@/components/camp/RevealShow";
import { usePlayers, useRoom, useServerClock, useTicker, type Room, type Player } from "@/hooks/use-game";
import { endGame, hostNext, startGame, tickRound, verifyHost } from "@/lib/game.functions";
import { remainingMs } from "@/lib/game-utils";
import { DEFAULT_ROUND_SECONDS, promptForRound, ROUND_TIMER_OPTIONS, TOTAL_ROUNDS } from "@/lib/prompts";
import { session } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/host/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Hosting ${params.code} · Camp Who's Most Likely To` },
      { name: "description", content: "Host screen for a campfire game of Who's Most Likely To." },
      { property: "og:title", content: `Hosting ${params.code} · Camp Who's Most Likely To` },
      { property: "og:description", content: "Host screen for a campfire game of Who's Most Likely To." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [auth, setAuth] = useState<"checking" | "ok" | "denied">("checking");
  const { room, state, refresh } = useRoom(code);
  const { players } = usePlayers(room?.id);
  useServerClock();

  useEffect(() => {
    const t = session.getHostToken(code);
    if (!t) {
      setAuth("denied");
      return;
    }
    setToken(t);
    verifyHost({ data: { code, token: t } })
      .then((r) => setAuth(r.ok ? "ok" : "denied"))
      .catch(() => setAuth("ok")); // offline: let the actions themselves verify
  }, [code]);

  useEffect(() => {
    if (room?.status === "ended") void navigate({ to: "/thanks" });
  }, [room?.status, navigate]);

  if (auth === "denied" || state === "missing") {
    return (
      <CampScene>
        <main className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="text-6xl">🧭</p>
          <h1 className="font-display text-3xl">
            {state === "missing" ? "This room doesn't exist." : "This phone isn't the host of this room."}
          </h1>
          <Button asChild variant="camp" size="xl">
            <Link to="/">Back to camp</Link>
          </Button>
        </main>
      </CampScene>
    );
  }

  if (!room || !token || auth === "checking") {
    return (
      <CampScene>
        <p className="m-auto animate-pulse font-display text-2xl">Gathering firewood…</p>
      </CampScene>
    );
  }

  const onEnd = async () => {
    await endGame({ data: { code, token } });
    await navigate({ to: "/thanks" });
  };

  return (
    <CampScene className="max-w-4xl" fire={room.status === "lobby"}>
      <header className="mb-4 flex items-center justify-between gap-2">
        <span className="rounded-full bg-night-deep/70 px-3 py-1.5 font-display text-lg tracking-widest text-flame">
          {code}
        </span>
        <EndGameButton onConfirm={onEnd} />
      </header>
      {room.status === "lobby" && <Lobby room={room} players={players} token={token} onChange={refresh} />}
      {room.status === "answering" && <HostRound room={room} token={token} onChange={refresh} />}
      {room.status === "reveal" && (
        <RevealShow room={room} footer={<NextButton room={room} token={token} onChange={refresh} />} />
      )}
    </CampScene>
  );
}

function Lobby({
  room,
  players,
  token,
  onChange,
}: {
  room: Room;
  players: Player[];
  token: string;
  onChange: () => Promise<void>;
}) {
  const [origin, setOrigin] = useState("");
  const [duration, setDuration] = useState<number>(DEFAULT_ROUND_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const joinUrl = `${origin}/join?code=${room.code}`;
  const canStart = players.length >= 2;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await startGame({ data: { code: room.code, token, duration } });
      if (!r.ok) setError(r.error === "need_players" ? "Need at least 2 campers to start." : "Couldn't start. Try again.");
      await onChange();
    } catch {
      setError("Couldn't reach camp. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="panel flex flex-col items-center gap-5 p-5 sm:flex-row sm:justify-center sm:gap-10 sm:p-8">
        <div className="text-center">
          <p className="font-display text-xl text-muted-foreground">Room code</p>
          <p className="font-display text-8xl leading-none tracking-[0.15em] text-flame text-glow sm:text-9xl">
            {room.code}
          </p>
          <p className="mt-3 text-lg">
            Join at <span className="font-bold text-cream">{origin.replace(/^https?:\/\//, "")}</span>
          </p>
        </div>
        {origin && (
          <div className="polaroid rotate-2 p-3">
            <QRCodeSVG
              value={joinUrl}
              size={168}
              bgColor="transparent"
              fgColor="currentColor"
              className="text-ink"
              level="M"
            />
            <p className="pt-1 text-center font-hand text-lg">Scan to join!</p>
          </div>
        )}
      </div>

      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">Campers</h2>
          <span className="rounded-full bg-pine px-3 py-1 font-display text-xl text-cream">{players.length}</span>
        </div>
        {players.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">Waiting for campers to join… 🦗</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {players.map((p) => (
              <li
                key={p.id}
                className="animate-pop-in flex items-center gap-2 rounded-2xl bg-night-deep/60 px-3 py-2"
              >
                <span className="text-3xl">{p.avatar}</span>
                <span className="truncate font-bold">{p.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel flex flex-col gap-4 p-5">
        <h2 className="font-display text-2xl">Round timer</h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Round timer">
          {ROUND_TIMER_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={duration === s}
              onClick={() => setDuration(s)}
              className={cn(
                "min-h-14 rounded-2xl border-2 font-display text-xl transition-transform active:scale-95",
                duration === s ? "border-fire bg-fire/20 text-flame" : "border-cream/15 bg-night-deep/60",
              )}
            >
              {s / 60} min
            </button>
          ))}
        </div>
        {error && <p className="rounded-xl bg-destructive/20 p-3 text-center">{error}</p>}
        <Button variant="camp" size="jumbo" disabled={!canStart || busy} onClick={() => void start()}>
          {busy ? "Starting…" : "Start Game 🔥"}
        </Button>
        {!canStart && <p className="text-center text-muted-foreground">Need at least 2 campers to start.</p>}
      </section>
    </main>
  );
}

function HostRound({ room, token, onChange }: { room: Room; token: string; onChange: () => Promise<void> }) {
  const now = useServerClock();
  useTicker(250);
  const left = remainingMs(room.round_started_at, room.round_duration_seconds, now());
  const expired = left <= 0;

  useEffect(() => {
    if (!expired) return undefined;
    const tick = () =>
      void tickRound({ data: { code: room.code } })
        .then(() => onChange())
        .catch(() => {});
    tick();
    const again = setInterval(tick, 3000);
    return () => clearInterval(again);
  }, [expired, room.current_round, room.code, onChange]);

  return (
    <main className="flex flex-1 flex-col items-center gap-8 text-center">
      <RoundBadge round={room.current_round} />
      <WoodSign swing key={room.current_round} className="max-w-2xl">
        <p className="text-balance text-2xl leading-snug sm:text-4xl">{promptForRound(room.current_round)}</p>
      </WoodSign>
      <div className="w-full max-w-xl">
        <CountdownBar remainingMs={left} totalMs={room.round_duration_seconds * 1000} />
      </div>
      <div className="panel w-full max-w-sm p-5">
        <p className="font-display text-6xl tabular-nums text-flame">
          {room.submitted_count} <span className="text-cream/60">/</span> {room.eligible_count}
        </p>
        <p className="font-display text-xl text-muted-foreground">submitted</p>
      </div>
      <NextButton room={room} token={token} onChange={onChange} />
    </main>
  );
}

function NextButton({ room, token, onChange }: { room: Room; token: string; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const last = room.current_round >= TOTAL_ROUNDS;
  const label = room.status === "answering" ? "Reveal ➜" : last ? "Finish Game 🏁" : "Next Round ➜";
  return (
    <Button
      variant={room.status === "reveal" && last ? "pine" : "camp"}
      size="jumbo"
      className="w-full max-w-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await hostNext({ data: { code: room.code, token, fromRound: room.current_round } });
          if (r.ok && r.status === "ended") await navigate({ to: "/thanks" });
          else await onChange();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "…" : label}
    </Button>
  );
}
