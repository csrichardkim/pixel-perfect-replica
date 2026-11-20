import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TOTAL_ROUNDS } from "@/lib/prompts";

export function WoodSign({
  children,
  className,
  swing = false,
}: {
  children: ReactNode;
  className?: string;
  swing?: boolean;
}) {
  return (
    <div className={cn("relative mx-auto w-fit", swing && "animate-sign-swing", className)}>
      <div className="absolute -top-6 left-6 h-6 w-1 bg-wood-dark" aria-hidden="true" />
      <div className="absolute -top-6 right-6 h-6 w-1 bg-wood-dark" aria-hidden="true" />
      <div className="wood-sign px-5 py-3 text-center">{children}</div>
    </div>
  );
}

export function RoundBadge({ round, className }: { round: number; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto w-fit rounded-full border border-cream/25 bg-night-deep/70 px-4 py-1.5 font-display text-lg tracking-wide text-flame",
        className,
      )}
    >
      {round > 0 ? `Round ${round} of ${TOTAL_ROUNDS}` : `${TOTAL_ROUNDS} rounds tonight`}
    </div>
  );
}

export function CountdownBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const pct = totalMs > 0 ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100)) : 0;
  const secs = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");
  const urgent = secs <= 10;
  return (
    <div className="w-full" role="timer" aria-label={`${secs} seconds left`}>
      <div className="mb-1 flex items-center justify-between font-display text-lg">
        <span className="text-muted-foreground">⏳ Time left</span>
        <span className={cn("tabular-nums", urgent ? "animate-wiggle text-ember" : "text-flame")}>
          {mm}:{ss}
        </span>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full border border-cream/20 bg-night-deep/80">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-linear",
            urgent ? "bg-ember" : pct < 40 ? "bg-fire" : "bg-pine",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function PromptText({ text, className }: { text: string; className?: string }) {
  return (
    <h2
      className={cn(
        "text-balance text-center font-display text-3xl leading-tight text-cream text-glow sm:text-5xl",
        className,
      )}
    >
      {text}
    </h2>
  );
}
