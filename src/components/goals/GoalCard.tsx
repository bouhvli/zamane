import { useState } from "react";
import { Link } from "react-router";
import { Check, Target } from "lucide-react";

import type { Goal } from "@/lib/goals-api";
import { goalImageUrl } from "@/lib/goal-image";
import { formatAmount, formatDate } from "@/lib/format";
import { cn } from "@/components/ui/utils";
import { CardThumb } from "@/components/layout/CardThumb";
import { GLASS_ROW } from "@/components/layout/glass-row";
import { ProgressBar } from "./ProgressBar";

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
  "group block overflow-hidden rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60";

export function GoalCard({ goal, variant = "full" }: { goal: Goal; variant?: "full" | "compact" }) {
  return variant === "compact" ? <CompactGoalCard goal={goal} /> : <FullGoalCard goal={goal} />;
}

// The dashboard row. Where the full card spends ~218px to show a photo and one
// figure, this spends ~96px and shows four: how far along, how much is in, what
// is still missing, and by when. Home is an overview — density is the point,
// and the aspirational photo treatment stays on the Goals page where it can
// breathe.
//
// Hover is a background tint rather than a lift: down a list of rows a
// translate reads as jitter, and colour is the calmer "this is tappable".
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
      aria-label={`Open ${goal.title}`}
      className={cn(
        CARD_BASE,
        GLASS_ROW,
        "border border-border p-3 transition-colors duration-200 hover:border-primary/30 hover:bg-muted/50 active:scale-[0.99] motion-reduce:active:scale-100",
      )}
    >
      <div className="flex items-center gap-3">
        <CardThumb
          src={goalImageUrl(goal, { width: 160, height: 160 })}
          icon={goal.isCompleted ? Check : Target}
          dim={goal.isCompleted}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm font-semibold leading-tight text-foreground">
              {goal.title}
            </h3>
            {goal.isCompleted ? (
              <span className="shrink-0 text-xs font-semibold text-accent-strong">Reached</span>
            ) : (
              <span className="shrink-0 text-xs font-semibold text-muted-foreground [font-variant-numeric:tabular-nums]">
                {Math.round(percent)}%
              </span>
            )}
          </div>

          <ProgressBar percent={percent} label={goal.title} className="h-1.5" />

          <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs [font-variant-numeric:tabular-nums]">
            {isFinancial ? (
              <>
                {/* "29,200 of 40,000" doesn't fit beside the second figure at
                    390px — it truncated to "of MAD 40,…" and repeated the
                    currency. The target is already encoded by the bar and the
                    percentage, so the pair says saved / still-needed instead:
                    parallel, shorter, and both halves stay readable even at
                    seven figures. */}
                <span className="min-w-0 truncate text-muted-foreground">
                  {formatAmount(current)} saved
                </span>
                {/* Weighted heavier than the figure beside it: what's left is
                    the number that tells you whether to act. */}
                {remaining > 0 && (
                  <span className="shrink-0 font-semibold text-foreground">
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
                  <span className="shrink-0 font-semibold text-foreground">
                    {Math.round(100 - percent)}% to go
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// A goal reads as an aspiration, not a database row: a cover photo (or a
// branded forest gradient when there's none) carries the title, and a crisp
// solid footer keeps the money/progress unambiguous — the photo never fights
// the number for legibility. Visually a sibling of the TripCard so Goals and
// Trips feel like one app.
function FullGoalCard({ goal }: { goal: Goal }) {
  const isFinancial = goal.goalType === "financial";
  const percent = goalPercent(goal);

  const [failed, setFailed] = useState(false);
  const cover = goalImageUrl(goal, { width: 1000, height: 560 });
  const showImage = Boolean(cover) && !failed;

  return (
    <Link
      to={`/goals/${goal.id}`}
      aria-label={`Open ${goal.title}`}
      className={cn(
        CARD_BASE,
        "border border-border bg-card shadow-[0_1px_2px_rgba(26,15,20,0.05),0_14px_34px_-16px_rgba(26,15,20,0.22)] transition-transform duration-200 active:scale-[0.98] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
      )}
    >
      {/* Banner: a dark violet base (matching the PageHero brand surface) is
          ALWAYS painted first, so the frame is full even while a photo loads
          or if it fails; the photo then covers it edge-to-edge and a scrim
          keeps the overlaid title legible. */}
      <div className="brand-thumb-base relative h-32 overflow-hidden">
        <div className="brand-thumb-radial absolute inset-0" />

        {!showImage && (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1.5px)] [background-size:22px_22px]" />
            <Target className="absolute -right-3 -bottom-4 size-28 text-white/[0.07]" strokeWidth={1.5} />
          </>
        )}

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

        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        {/* Status: a celebratory chip when done, otherwise a frosted chip
            naming the goal type. Text carries the meaning, not colour alone. */}
        <div className="absolute inset-x-0 top-0 flex justify-end p-3">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm",
              goal.isCompleted
                ? "bg-accent text-accent-foreground"
                : "border border-white/20 bg-white/15 text-white",
            )}
          >
            {goal.isCompleted && <span className="size-1.5 rounded-full bg-current" />}
            {goal.isCompleted ? "Done" : isFinancial ? "Financial" : "General"}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="line-clamp-2 text-balance text-lg font-bold leading-tight tracking-tight text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.4)]">
            {goal.title}
          </h3>
        </div>
      </div>

      {/* Footer: the number stays on a solid surface so it's always crisp. */}
      <div className="p-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-semibold text-foreground [font-variant-numeric:tabular-nums]">
            {isFinancial
              ? `${formatAmount(goal.currentAmount)} of ${formatAmount(goal.targetAmount ?? 0)}`
              : "Progress"}
          </span>
          <span className="shrink-0 text-xs font-semibold text-muted-foreground [font-variant-numeric:tabular-nums]">
            {Math.round(percent)}%
          </span>
        </div>

        <ProgressBar percent={percent} label={goal.title} />

        {goal.targetDate && (
          <p className="mt-2 text-xs text-muted-foreground">by {formatDate(goal.targetDate)}</p>
        )}
      </div>
    </Link>
  );
}
