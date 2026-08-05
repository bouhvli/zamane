import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import type { Goal } from "@/lib/goals-api";
import { formatAmount } from "@/lib/format";
import { ProgressBar } from "./ProgressBar";

/** Fraction of a goal that's done, 0–1. Financial goals measure money, general
 *  goals carry their own percentage. */
export function goalProgress(goal: Goal): number {
  if (goal.goalType === "financial") {
    return goal.targetAmount ? Number(goal.currentAmount) / Number(goal.targetAmount) : 0;
  }
  return goal.currentProgressPct / 100;
}

// Lets the Home dashboard's primary action ("Add to a goal") reach the core
// loop without first navigating to the goals list and then into a goal — the
// contribution flow was three screens from the dashboard and had no affordance
// on it at all. Skipped entirely when there's only one goal open: the caller
// jumps straight to the contribution sheet rather than asking a question with
// one answer (Tesler's Law — absorb the complexity).
export function GoalPickerSheet({
  open,
  goals,
  onClose,
  onPick,
}: {
  open: boolean;
  goals: Goal[];
  onClose: () => void;
  onPick: (goal: Goal) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="flex max-h-[80dvh] flex-col">
        <div className="shrink-0 px-5 pt-3">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Add to a goal</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="-mr-2 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {goals.map((goal) => {
            const percent = goalProgress(goal) * 100;
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => onPick(goal)}
                className="block w-full rounded-xl border border-border bg-card p-3.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-semibold text-foreground">{goal.title}</span>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground [font-variant-numeric:tabular-nums]">
                    {Math.round(Math.max(0, Math.min(100, percent)))}%
                  </span>
                </div>
                <ProgressBar percent={percent} label={goal.title} />
                {goal.goalType === "financial" && (
                  <p className="mt-2 text-xs text-muted-foreground [font-variant-numeric:tabular-nums]">
                    {formatAmount(goal.currentAmount)} of {formatAmount(goal.targetAmount ?? 0)}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </dialog>
  );
}
