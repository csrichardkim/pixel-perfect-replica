import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CampScene, Lanterns } from "@/components/camp/CampScene";
import { CountdownBar, PromptText, RoundBadge } from "@/components/camp/bits";
import { AnswerForm } from "@/components/camp/AnswerForm";
import { RevealShow } from "@/components/camp/RevealShow";
import { usePlayers, useRoom, useServerClock, useTicker, type Player, type Room } from "@/hooks/use-game";
import { remainingMs } from "@/lib/game-utils";
import { promptForRound } from "@/lib/prompts";
import { session } from "@/lib/session";

export const Route = createFileRoute("/play/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} · Camp Who's Most Likely To` },
      { name: "description", content: "You're at the campfire! Pick a name, snap a photo, and watch the reveal." },
      { property: "og:title", content: `Room ${params.code} · Camp Who's Most Likely To` },
      { property: "og:description", content: "You're at the campfire! Pick a name, snap a photo, and watch the reveal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const { room, state } = useRoom(code);
  const { players, loaded } = usePlayers(room?.id);
  useServerClock();

  useEffect(() => {
    const id = session.getPlayerId(code);
    if (!id) void navigate({ to: "/join", search: { code } });
    else setPlayerId(id);
  }, [code, navigate]);

  useEffect(() => {
    if (room?.status === "ended") void navigate({ to: "/thanks" });
  }, [room?.status, navigate]);

  const me = players.find((p) => p.id === playerId);

  useEffect(() => {
    if (loaded && playerId && !me && room && room.status !== "ended") {
      // Double-check before bouncing (list might be mid-refresh).
      const t = setTimeout(() => {
        session.clearPlayer(code);
        void navigate({ to: "/join", search: { code } });
      }, 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [loaded, playerId, me, room, code, navigate]);

  if (state === "missing") {
    return (
      <CampScene>
        <main className="m-auto text-center">
          <p className="text-6xl">🧭</p>
          <h1 className="mt-4 font-display text-3xl">This room doesn't exist anymore.</h1>
        </main>
      </CampScene>
    );
  }

  if (!room || !me || !playerId) {
    return (
      <CampScene>
        <p className="m-auto animate-pulse font-display text-2xl">Finding your spot by the fire…</p>
      </CampScene>
    );
  }

  return (
    <CampScene fire={room.status === "lobby"}>
      <header className="mb-4 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 rounded-full bg-night-deep/70 px-3 py-1.5">
          <span className="text-2xl">{me.avatar}</span>
          <span className="max-w-[9rem] truncate font-bold">{me.name}</span>
        </span>
        <span className="rounded-full bg-night-deep/70 px-3 py-1.5 font-display text-lg tracking-widest text-flame">
          {code}
        </span>
      </header>
      {room.status === "lobby" && <PlayerLobby room={room} count={players.length} />}
      {room.status === "answering" && <PlayerRound room={room} me={me} />}
      {room.status === "reveal" && (
        <RevealShow
          room={room}
          footer={<p className="animate-pulse font-display text-xl text-muted-foreground">Waiting for the host…</p>}
        />
      )}
    </CampScene>
  );
}

function PlayerLobby({ room, count }: { room: Room; count: number }) {
  return (
    <>
      <Lanterns />
      <main className="relative flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <RoundBadge round={room.current_round} />
        <p className="animate-pop-in text-7xl">🏮</p>
        <h1 className="font-display text-5xl text-cream text-glow">You're in!</h1>
        <p className="text-xl text-muted-foreground">Waiting for the host to start…</p>
        <p className="rounded-full bg-pine/80 px-4 py-1.5 font-display text-lg">
          {count} {count === 1 ? "camper" : "campers"} by the fire
        </p>
      </main>
    </>
  );
}

function PlayerRound({ room, me }: { room: Room; me: Player }) {
  const now = useServerClock();
  useTicker(250);
  const left = remainingMs(room.round_started_at, room.round_duration_seconds, now());
  const eligible = room.round_started_at ? Date.parse(me.joined_at) <= Date.parse(room.round_started_at) : false;

  return (
    <main className="flex flex-1 flex-col gap-5">
      <RoundBadge round={room.current_round} />
      <PromptText key={`prompt-${room.current_round}`} text={promptForRound(room.current_round)} className="animate-sign-swing" />
      <CountdownBar remainingMs={left} totalMs={room.round_duration_seconds * 1000} />
      {eligible ? (
        <>
          {left <= 0 && (
            <p className="text-center font-display text-lg text-flame">
              ⏰ Time's up! You can still submit until the host reveals.
            </p>
          )}
          <AnswerForm key={`answer-${room.current_round}`} code={room.code} playerId={me.id} round={room.current_round} />
        </>
      ) : (
        <div className="panel p-6 text-center">
          <p className="text-5xl">🪵</p>
          <p className="mt-2 font-display text-2xl">Grab a log and sit tight!</p>
          <p className="text-muted-foreground">You joined mid-round — you'll play from the next round.</p>
        </div>
      )}
    </main>
  );
}
