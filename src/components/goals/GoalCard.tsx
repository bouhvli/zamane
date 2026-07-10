import { Link } from "react-router";

import type { Goal } from "@/lib/goals-api";
import { formatAmount, formatDate } from "@/lib/format";
import { ProgressBar } from "./ProgressBar";

export function GoalCard({ goal }: { goal: Goal }) {
  const isFinancial = goal.goalType === "financial";
  const percent = isFinancial
    ? goal.targetAmount
      ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100
      : 0
    : goal.currentProgressPct;

  return (
    <Link
      to={`/goals/${goal.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 min-w-0 text-balance font-heading text-lg leading-snug text-foreground">{goal.title}</h3>
        <span
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wider " +
            (goal.isCompleted
              ? "bg-primary/10 text-primary"
              : isFinancial
                ? "bg-accent/10 text-accent"
                : "bg-muted text-muted-foreground")
          }
        >
          {goal.isCompleted ? "Done" : isFinancial ? "Financial" : "General"}
        </span>
      </div>

      <ProgressBar percent={percent} className="mb-2" />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {isFinancial
            ? `${formatAmount(goal.currentAmount)} of ${formatAmount(goal.targetAmount ?? 0)}`
            : `${goal.currentProgressPct}% complete`}
        </span>
        {goal.targetDate && <span>by {formatDate(goal.targetDate)}</span>}
      </div>
    </Link>
  );
}
