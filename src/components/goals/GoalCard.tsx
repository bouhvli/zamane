import { useState } from "react";
import { Link } from "react-router";
import { Check, CircleDot } from "lucide-react";

import type { Goal } from "@/lib/goals-api";
import { goalImageUrl } from "@/lib/goal-image";
import { formatAmount, formatDate } from "@/lib/format";
import { cn } from "@/components/ui/utils";
import { CardThumb } from "@/components/layout/CardThumb";
import { GLASS_ROW } from "@/components/layout/glass-row";
import { ProgressOrbit } from "@/components/ProgressOrbit";

/** Percent complete, clamped to 0–100. */
function goalPercent(goal: Goal): number {
  const raw =
    goal.goalType === "financial"
      ? goal.targetAmount
        ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100
        : 0
      : goal.currentProgressPct;
  return Math.max(0, Math.min(100, raw));
}

const CARD_BASE =
  "group block overflow-hidden outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60";

/** Pairs the card's thumbnail with the detail page's cover so the photo grows
 *  into place instead of the whole screen cross-fading. Minted per goal id
 *  because a view-transition-name must be unique among rendered elements. */
export const goalCoverTransitionName = (id: string) => `goal-cover-${id}`;

export function GoalCard({ goal, variant = "full" }: { goal: Goal; variant?: "full" | "compact" }) {
  return variant === "compact" ? <CompactGoalCard goal={goal} /> : <FullGoalCard goal={goal} />;
}

// The dashboard row. Where the full card spends ~218px to show a photo and one
// figure, this spends ~90px and shows four: how far along, how much is in,
// what is still missing, and by when.
//
// The linear bar became the orbit at the end of the row. The bar had to share
// a line with two figures and a percentage; the ring says the same thing in a
// 40px square, gives the percentage a home inside it, and buys the money
// figures a full line of their own.
function CompactGoalCard({ goal }: { goal: Goal }) {
  const isFinancial = goal.goalType === "financial";
  const percent = goalPercent(goal);
  const current = Number(goal.currentAmount);
  const target = Number(goal.targetAmount ?? 0);
  // The actionable figure the card never showed: what's still missing. "29,200
  // of 40,000" makes you do the subtraction yourself.
  const remaining = Math.max(0, target - current);

  return (
    <Link
      to={`/goals/${goal.id}`}
      viewTransition
      aria-label={`Open ${goal.title}`}
      className={cn(CARD_BASE, GLASS_ROW, "rounded-md p-3")}
    >
      <div className="flex items-center gap-3">
        <CardThumb
          src={goalImageUrl(goal, { width: 160, height: 160 })}
          icon={goal.isCompleted ? Check : CircleDot}
          dim={goal.isCompleted}
          style={{ viewTransitionName: goalCoverTransitionName(goal.id) }}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm leading-tight font-semibold text-foreground">
              {goal.title}
            </h3>
            {goal.isCompleted && (
              // Semantic success, not the brand rose: a reached goal is a
              // state, and states live outside the two brand hues.
              <span className="shrink-0 text-xs font-bold text-success">Reached</span>
            )}
          </div>

          <div className="flex items-baseline justify-between gap-2 text-xs">
            {isFinancial ? (
              <>
                {/* "29,200 of 40,000" doesn't fit beside the second figure at
                    390px — and the target is already encoded by the ring, so
                    the pair says saved / still-needed instead: parallel,
                    shorter, and both halves stay readable at seven figures. */}
                <span className="min-w-0 truncate font-numeric text-muted-foreground">
                  {formatAmount(current)} saved
                </span>
                {/* Weighted heavier than the figure beside it: what's left is
                    the number that tells you whether to act. */}
                {remaining > 0 && (
                  <span className="shrink-0 font-numeric font-bold text-foreground">
                    {formatAmount(remaining)} to go
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="min-w-0 truncate text-muted-foreground">
                  {goal.targetDate ? `by ${formatDate(goal.targetDate)}` : "General goal"}
                </span>
                {percent < 100 && (
                  <span className="shrink-0 font-numeric font-bold text-foreground">
                    {Math.round(100 - percent)}% to go
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <ProgressOrbit percent={percent} size={42} label={goal.title}>
          <span className="orbit-value text-[11px]">{Math.round(percent)}</span>
        </ProgressOrbit>
      </div>
    </Link>
  );
}

// A goal reads as an aspiration, not a database row: a cover photo (or the
// branded radial when there's none) carries the title, and the orbit straddles
// the seam between photo and footer so the number is never fighting the image
// for legibility.
function FullGoalCard({ goal }: { goal: Goal }) {
  const isFinancial = goal.goalType === "financial";
  const percent = goalPercent(goal);

  const [failed, setFailed] = useState(false);
  const cover = goalImageUrl(goal, { width: 1000, height: 560 });
  const showImage = Boolean(cover) && !failed;

  return (
    <Link
      to={`/goals/${goal.id}`}
      viewTransition
      aria-label={`Open ${goal.title}`}
      className={cn(
        CARD_BASE,
        "glass-2 !overflow-visible transition-transform duration-[var(--dur-2)] ease-[var(--ease-glide)] hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:hover:translate-y-0",
      )}
    >
      {/* Banner: the brand radial is ALWAYS painted first, so the frame is full
          even while a photo loads or if it fails; the photo then covers it
          edge-to-edge and a scrim keeps the overlaid title legible. */}
      <div
        className="brand-thumb-base relative h-32 overflow-hidden rounded-t-[calc(var(--radius-lg)-1px)]"
        style={{ viewTransitionName: goalCoverTransitionName(goal.id) }}
      >
        <div className="brand-thumb-radial absolute inset-0" />

        {/* No watermark mark here, unlike TripCover: the orbit already sits in
            this corner, and a second faint ring behind it read as a smudge
            rather than as texture. The brand wash and its dot lattice carry
            the empty cover on their own. */}

        {showImage && (
          <img
            src={cover as string}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            className={cn(
              "absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100",
              goal.isCompleted && "saturate-[0.9]",
            )}
          />
        )}

        {/* The scrim exists to keep the title legible over a photo. Without a
            photo the surface is a light wash, so the scrim would only muddy
            it — and the title flips to ink instead of white. */}
        {showImage && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        )}

        {/* Status: text carries the meaning, not colour alone. */}
        <div className="absolute inset-x-0 top-0 flex justify-end p-3">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm backdrop-blur-sm",
              goal.isCompleted
                ? "bg-success text-white"
                : showImage
                  ? "border border-white/20 bg-white/15 text-white"
                  : "border border-violet-200 bg-card/70 text-violet-700 backdrop-blur-sm",
            )}
          >
            {goal.isCompleted && <span className="size-1.5 rounded-full bg-current" />}
            {goal.isCompleted ? "Reached" : isFinancial ? "Financial" : "General"}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4 pr-24">
          <h3
            className={cn(
              "line-clamp-2 text-lg leading-tight font-bold tracking-tight text-balance",
              showImage
                ? "text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.4)]"
                : "text-[var(--thumb-ink)]",
            )}
          >
            {goal.title}
          </h3>
        </div>
      </div>

      {/* The instrument straddles the seam: half on the photo, half on the
          footer, which is what makes it read as an inset dial rather than a
          widget parked in a corner. */}
      <div className="relative px-4 pb-4">
        <ProgressOrbit
          percent={percent}
          size={72}
          stroke={7}
          label={goal.title}
          className="absolute -top-9 right-4 rounded-full bg-card p-1 shadow-[0_4px_10px_rgb(var(--glass-ink)/0.12)]"
        >
          <span className="orbit-value text-base">
            {Math.round(percent)}
            <span className="text-[0.6em] font-semibold">%</span>
          </span>
        </ProgressOrbit>

        <div className="pt-4 pr-20">
          <span className="block truncate font-numeric text-sm font-bold text-foreground">
            {isFinancial
              ? `${formatAmount(goal.currentAmount)} of ${formatAmount(goal.targetAmount ?? 0)}`
              : "In progress"}
          </span>
          {goal.targetDate && (
            <p className="mt-1 text-xs text-muted-foreground">by {formatDate(goal.targetDate)}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
