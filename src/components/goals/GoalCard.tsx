import { useState } from "react";
import { Link } from "react-router";
import { Target } from "lucide-react";

import type { Goal } from "@/lib/goals-api";
import { goalImageUrl } from "@/lib/goal-image";
import { formatAmount, formatDate } from "@/lib/format";
import { cn } from "@/components/ui/utils";
import { ProgressBar } from "./ProgressBar";

// A goal reads as an aspiration, not a database row: a cover photo (or a
// branded forest gradient when there's none) carries the title, and a crisp
// solid footer keeps the money/progress unambiguous — the photo never fights
// the number for legibility. Visually a sibling of the TripCard so Goals and
// Trips feel like one app.
export function GoalCard({ goal }: { goal: Goal }) {
  const isFinancial = goal.goalType === "financial";
  const percent = isFinancial
    ? goal.targetAmount
      ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100
      : 0
    : goal.currentProgressPct;
  const pctLabel = Math.round(Math.max(0, Math.min(100, percent)));

  const [failed, setFailed] = useState(false);
  const cover = goalImageUrl(goal, { width: 1000, height: 560 });
  const showImage = Boolean(cover) && !failed;

  return (
    <Link
      to={`/goals/${goal.id}`}
      aria-label={`Open ${goal.title}`}
      className="group block overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(16,32,24,0.05),0_14px_34px_-16px_rgba(16,32,24,0.22)] outline-none transition-transform duration-200 active:scale-[0.98] hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/60 motion-reduce:hover:translate-y-0"
    >
      {/* Banner: a dark forest base is ALWAYS painted first, so the frame is
          full even while a photo loads or if it fails; the photo then covers
          it edge-to-edge and a scrim keeps the overlaid title legible. */}
      <div className="relative h-32 overflow-hidden bg-[#0C1E15]">
        <div className="absolute inset-0 bg-[radial-gradient(150%_130%_at_20%_10%,#2E5E43_0%,#1E4634_50%,#0C1E15_100%)]" />

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

        {/* Status: a celebratory lime chip when done, otherwise a frosted chip
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
            {pctLabel}%
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
