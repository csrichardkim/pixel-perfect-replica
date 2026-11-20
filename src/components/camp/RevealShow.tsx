import { useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getReveal } from "@/lib/game.functions";
import { favoriteNames, groupCards, normalizeName, revealStage, type RevealCard } from "@/lib/game-utils";
import { promptForRound } from "@/lib/prompts";
import { storageUrl } from "@/lib/photo";
import { useServerClock, useTicker, type Room } from "@/hooks/use-game";
import { cn } from "@/lib/utils";
import { PromptText, RoundBadge, WoodSign } from "./bits";

const TILTS = [-6, 4, -3, 7, -5, 3, -8, 5];

function Polaroid({
  card,
  size,
  tilt = 0,
  className,
}: {
  card: RevealCard;
  size: "sm" | "md" | "lg";
  tilt?: number;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "polaroid shrink-0",
        size === "lg" && "w-60 sm:w-80",
        size === "md" && "w-full",
        size === "sm" && "w-14 p-1 pb-0.5 sm:w-16",
        className,
      )}
      style={{ transform: `rotate(${tilt}deg)`, "--tilt": `${tilt}deg` } as React.CSSProperties}
    >
      <div className="aspect-[4/5] w-full overflow-hidden rounded-sm bg-cream-dark">
        <img src={card.url} alt={`Photo picked for ${card.name}`} className="h-full w-full object-cover" />
      </div>
      <figcaption
        className={cn(
          "truncate text-center font-hand text-ink",
          size === "lg" && "py-2 text-3xl sm:text-4xl",
          size === "md" && "py-1 text-xl sm:text-2xl",
          size === "sm" && "text-[9px] leading-tight",
        )}
      >
        {card.name}
      </figcaption>
    </figure>
  );
}

function Fireflies() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className="animate-firefly absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-flame shadow-[0_0_10px_4px] shadow-flame/70"
          style={
            {
              "--fx": `${Math.cos((i / 14) * Math.PI * 2) * (70 + (i % 3) * 30)}px`,
              "--fy": `${Math.sin((i / 14) * Math.PI * 2) * (70 + (i % 4) * 25)}px`,
              "--delay": `${(i % 5) * 0.3}s`,
              "--dur": `${1.6 + (i % 3) * 0.4}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function RevealShow({ room, footer }: { room: Room; footer: ReactNode }) {
  const now = useServerClock();
  const round = room.current_round;
  const q = useQuery({
    queryKey: ["reveal", room.code, round],
    queryFn: () => getReveal({ data: { code: room.code, round } }),
    staleTime: Infinity,
    retry: 5,
    retryDelay: (n) => Math.min(800 * 2 ** n, 6000),
  });
  const cards = useMemo(
    () => (q.data?.cards ?? []).map((c) => ({ ...c, url: storageUrl(c.url) })),
    [q.data],
  );
  useEffect(() => {
    for (const c of cards) {
      const img = new Image();
      img.src = c.url;
    }
  }, [cards]);

  const started = room.reveal_started_at ? Date.parse(room.reveal_started_at) : now();
  const elapsed = now() - started;
  const loading = !q.data;
  const stage = loading ? { kind: "intro" as const } : revealStage(elapsed, cards.length);
  useTicker(200, stage.kind !== "final");

  const prompt = promptForRound(round);

  if (stage.kind === "intro") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <RoundBadge round={round} />
        <WoodSign swing className="max-w-md">
          <p className="text-balance text-2xl leading-snug sm:text-4xl">{prompt}</p>
        </WoodSign>
        {loading && elapsed > 2500 && (
          <p className="animate-pulse font-display text-xl text-muted-foreground">Developing photos… 📸</p>
        )}
        <div className="mt-auto pt-6">{footer}</div>
      </div>
    );
  }

  if (stage.kind === "cards") {
    const current = cards[stage.shown - 1];
    const previous = cards.slice(0, stage.shown - 1);
    return (
      <div className="flex flex-1 flex-col items-center gap-4">
        <RoundBadge round={round} />
        <p className="text-balance text-center font-display text-xl text-cream sm:text-2xl">{prompt}</p>
        {previous.length > 0 && (
          <div className="flex max-w-full flex-wrap justify-center gap-1.5">
            {previous.map((c, i) => (
              <Polaroid key={c.key} card={c} size="sm" tilt={TILTS[i % TILTS.length] ?? 0} />
            ))}
          </div>
        )}
        {current && (
          <div className="flex flex-1 items-center justify-center py-2">
            <div key={current.key} className="animate-card-fly" style={{ "--tilt": `${TILTS[(stage.shown - 1) % TILTS.length]}deg` } as React.CSSProperties}>
              <Polaroid card={current} size="lg" />
            </div>
          </div>
        )}
        <p className="font-display text-lg text-muted-foreground">
          {stage.shown} / {cards.length}
        </p>
        <div className="pt-2">{footer}</div>
      </div>
    );
  }

  // Final collage
  const groups = groupCards(cards);
  const favorites = favoriteNames(groups);
  return (
    <div className="flex flex-1 flex-col items-center gap-5">
      <RoundBadge round={round} />
      <p className="text-balance text-center font-display text-xl text-cream sm:text-2xl">{prompt}</p>
      {cards.length === 0 ? (
        <div className="panel animate-pop-in p-8 text-center">
          <p className="text-5xl">🦗</p>
          <p className="mt-2 font-display text-2xl">No photos this round!</p>
        </div>
      ) : (
        <>
          <PromptText text="The votes are in!" className="text-3xl sm:text-4xl" />
          <div className="flex w-full flex-wrap items-start justify-center gap-x-4 gap-y-8">
            {groups.map((g, i) => {
              const fav = favorites.has(normalizeName(g.name));
              const lead = g.cards[0];
              if (!lead) return null;
              return (
                <div
                  key={lead.key}
                  className={cn("animate-pop-in relative", fav ? "w-2/3 max-w-64" : "w-[44%] max-w-52")}
                  style={{ "--delay": `${i * 0.12}s`, "--tilt": `${TILTS[i % TILTS.length]}deg` } as React.CSSProperties}
                >
                  {fav && <Fireflies />}
                  {g.count > 1 && (
                    <>
                      <div className="polaroid absolute inset-0 rotate-6 opacity-80" aria-hidden="true" />
                      <div className="polaroid absolute inset-0 -rotate-3 opacity-90" aria-hidden="true" />
                    </>
                  )}
                  <Polaroid card={{ ...lead, name: g.name }} size="md" className="relative" />
                  {g.count > 1 && (
                    <span className="absolute -right-2 -top-3 z-10 rounded-full bg-ember px-2.5 py-0.5 font-display text-lg text-cream shadow-3d-wood">
                      x{g.count}
                    </span>
                  )}
                  {fav && (
                    <div className="absolute -left-2 -right-2 -bottom-4 z-10 rounded-md bg-fire py-1 text-center font-sign text-sm text-ink shadow-3d-fire">
                      🏆 Camp Favorite
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <div className="pt-4">{footer}</div>
    </div>
  );
}
