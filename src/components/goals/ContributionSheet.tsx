import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import type { GoalType } from "@/lib/goals-api";
import { Button } from "@/components/ui/button";
import { ContributionForm } from "./ContributionForm";

// The contribution flow as a slide-up sheet (same native <dialog> primitive as
// trips/SheetShell: focus trap + Escape + backdrop for free). The goal page
// no longer carries an always-open form — adding is now a deliberate step from
// the bottom action button. The form is mounted only while open, so every
// open starts clean.
export function ContributionSheet({
  open,
  onClose,
  goalId,
  goalType,
  goalTitle,
  currentProgressPct,
  onContributed,
}: {
  open: boolean;
  onClose: () => void;
  goalId: string;
  goalType: GoalType;
  /**
   * Which goal this is for. Omitted on GoalDetailPage, where the page header
   * already names it; required in practice when the sheet is opened from the
   * Home dashboard, where nothing else on screen says which goal was picked
   * (recognition over recall).
   */
  goalTitle?: string;
  currentProgressPct: number;
  onContributed: () => void;
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
      className="sheet-dialog glass-4"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="shrink-0 px-5 pt-3">
          <div aria-hidden="true" className="sheet-grabber mx-auto mb-3" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                {goalType === "financial" ? "Add contribution" : "Update progress"}
              </h2>
              {goalTitle && <p className="truncate text-sm text-muted-foreground">{goalTitle}</p>}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mr-2 size-9 text-muted-foreground"
              aria-label="Close"
              onClick={onClose}
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {open && (
            <ContributionForm
              goalId={goalId}
              goalType={goalType}
              currentProgressPct={currentProgressPct}
              onContributed={onContributed}
            />
          )}
        </div>
      </div>
    </dialog>
  );
}
