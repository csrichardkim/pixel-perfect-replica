import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const STARS = (() => {
  const r = rng(42);
  return Array.from({ length: 70 }, (_, i) => ({
    id: i,
    left: r() * 100,
    top: r() * 62,
    size: r() < 0.15 ? 3 : r() < 0.5 ? 2 : 1.5,
    dur: 2 + r() * 3,
    delay: r() * 4,
  }));
})();

const BULBS = (() => {
  // Two drooping strands across the top.
  const pts: { x: number; y: number; d: number }[] = [];
  const strand = (x0: number, x1: number, sag: number, n: number) => {
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = 6 + 4 * sag * t * (1 - t);
      pts.push({ x, y, d: (i % 5) * 0.4 });
    }
  };
  strand(0, 50, 17, 9);
  strand(50, 100, 17, 9);
  return pts;
})();

function TreeLine() {
  const r = rng(7);
  const trees: string[] = [];
  let x = -20;
  while (x < 1220) {
    const w = 40 + r() * 50;
    const h = 90 + r() * 120;
    const base = 260;
    const top = base - h;
    // Layered pine: three stacked triangles.
    const cx = x + w / 2;
    trees.push(
      `M${x} ${base} L${cx} ${top} L${x + w} ${base} Z`,
      `M${x + w * 0.1} ${base - h * 0.35} L${cx} ${top - 10} L${x + w * 0.9} ${base - h * 0.35} Z`,
    );
    x += w * (0.55 + r() * 0.35);
  }
  return (
    <svg
      viewBox="0 0 1200 260"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-x-0 bottom-0 h-36 w-full text-silhouette sm:h-48"
      aria-hidden="true"
    >
      <path d={trees.join(" ")} fill="currentColor" />
      {/* Tents */}
      <g fill="currentColor">
        <path d="M180 260 L250 175 L320 260 Z" />
        <path d="M880 260 L940 190 L1000 260 Z" />
      </g>
      <g className="fill-fire/70">
        <path d="M238 260 L250 228 L262 260 Z" />
        <path d="M930 260 L940 234 L950 260 Z" />
      </g>
      <rect x="0" y="250" width="1200" height="10" fill="currentColor" />
    </svg>
  );
}

export function Campfire({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative h-28 w-28", className)} aria-hidden="true">
      <div className="absolute inset-x-0 bottom-2 mx-auto h-24 w-24 rounded-full bg-fire/25 blur-2xl" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="animate-ember absolute bottom-10 h-1.5 w-1.5 rounded-full bg-flame"
          style={
            {
              left: `${35 + i * 6}%`,
              "--delay": `${i * 0.45}s`,
              "--dur": `${1.8 + (i % 3) * 0.5}s`,
              "--drift": `${(i % 2 ? 1 : -1) * (8 + i * 3)}px`,
            } as React.CSSProperties
          }
        />
      ))}
      <div className="animate-flicker absolute bottom-5 left-1/2 h-20 w-14 -translate-x-1/2 rounded-[50%_50%_45%_45%/65%_65%_35%_35%] bg-ember" />
      <div
        className="animate-flicker absolute bottom-5 left-1/2 h-14 w-10 -translate-x-1/2 rounded-[50%_50%_45%_45%/65%_65%_35%_35%] bg-fire"
        style={{ animationDelay: "0.15s" }}
      />
      <div
        className="animate-flicker absolute bottom-5 left-1/2 h-8 w-6 -translate-x-1/2 rounded-[50%_50%_45%_45%/65%_65%_35%_35%] bg-flame"
        style={{ animationDelay: "0.3s" }}
      />
      <div className="absolute bottom-3 left-1/2 h-3 w-24 -translate-x-1/2 rotate-12 rounded-full bg-wood-dark" />
      <div className="absolute bottom-3 left-1/2 h-3 w-24 -translate-x-1/2 -rotate-12 rounded-full bg-wood" />
    </div>
  );
}

export function Lanterns() {
  const items = [
    { left: "8%", delay: "0s", dur: "13s" },
    { left: "26%", delay: "4s", dur: "16s" },
    { left: "48%", delay: "1.5s", dur: "14s" },
    { left: "68%", delay: "6s", dur: "15s" },
    { left: "86%", delay: "2.5s", dur: "12s" },
  ];
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      {items.map((l, i) => (
        <div
          key={i}
          className="animate-lantern absolute bottom-0"
          style={{ left: l.left, "--delay": l.delay, "--dur": l.dur } as React.CSSProperties}
        >
          <div className="h-10 w-7 rounded-[40%_40%_30%_30%] bg-fire/90 shadow-[0_0_24px_8px] shadow-fire/50">
            <div className="mx-auto mt-2 h-5 w-3 rounded-full bg-flame/90" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CampScene({
  children,
  fire = false,
  className,
}: {
  children: ReactNode;
  fire?: boolean;
  className?: string;
}) {
  return (
    <div className="sky relative min-h-dvh overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        {STARS.map((s) => (
          <span
            key={s.id}
            className="animate-twinkle absolute rounded-full bg-cream"
            style={
              {
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                "--dur": `${s.dur}s`,
                "--delay": `${s.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
        <div className="absolute right-[9%] top-[13%] h-12 w-12 rounded-full bg-cream shadow-[0_0_40px_10px] shadow-cream/25 sm:h-16 sm:w-16" />
        {/* String lights */}
        <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-16 w-full sm:h-20">
          <path d="M0 6 Q25 40 50 6 Q75 40 100 6" className="stroke-cream/40" strokeWidth="0.25" vectorEffect="non-scaling-stroke" fill="none" />
        </svg>
        <div className="absolute inset-x-0 top-0 h-16 sm:h-20">
          {BULBS.map((b, i) => (
            <span
              key={i}
              className={cn(
                "animate-bulb absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full shadow-[0_0_12px_4px]",
                i % 3 === 0
                  ? "bg-bulb shadow-bulb/60"
                  : i % 3 === 1
                    ? "bg-fire shadow-fire/60"
                    : "bg-lake shadow-lake/60",
              )}
              style={{ left: `${b.x}%`, top: `${(b.y / 24) * 100}%`, "--delay": `${b.d}s` } as React.CSSProperties}
            />
          ))}
        </div>
        <TreeLine />
      </div>
      {fire && (
        <div className="pointer-events-none fixed bottom-2 left-1/2 z-0 -translate-x-1/2">
          <Campfire />
        </div>
      )}
      <div className={cn("relative z-10 mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-40 pt-16 sm:pt-20", className)}>
        {children}
      </div>
    </div>
  );
}
