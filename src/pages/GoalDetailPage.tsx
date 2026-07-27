import { useEffect, useRef, useState } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { Coins, History, PenLine, Pencil, Plus, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import type { Goal, GoalNote, GoalType } from "@/lib/goals-api";
import { deleteGoal } from "@/lib/goals-api";
import { goalImageUrl } from "@/lib/goal-image";
import { ApiError } from "@/lib/api";
import { formatAmount, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { DetailMenu } from "@/components/layout/DetailMenu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProgressBar } from "@/components/goals/ProgressBar";
import { NotesFeed } from "@/components/goals/NotesFeed";
import { ContributionSheet } from "@/components/goals/ContributionSheet";
import { NoteComposerSheet } from "@/components/goals/NoteComposerSheet";

type Sheet = null | "choose" | "contribute" | "note";

export default function GoalDetailPage() {
  const { goal, notes } = useLoaderData() as { goal: Goal; notes: GoalNote[] };
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteGoal(goal.id);
      toast.success("Goal deleted");
      navigate("/goals");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete the goal. Please try again.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const isFinancial = goal.goalType === "financial";
  const percent = isFinancial
    ? goal.targetAmount
      ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100
      : 0
    : goal.currentProgressPct;
  const cover = goalImageUrl(goal, { width: 1000, height: 480 });

  return (
    <div>
      <PageHeader
        back={{ to: "/goals", label: "Goals" }}
        title={goal.title}
        description={[
          isFinancial ? "Financial goal" : "General goal",
          goal.targetDate ? `target ${formatDate(goal.targetDate)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        status={{ text: goal.isCompleted ? "Done" : "In progress", tone: goal.isCompleted ? "primary" : "accent" }}
        actions={
          <DetailMenu
            items={[
              { label: "History & stats", icon: History, onSelect: () => navigate(`/goals/${goal.id}/history`) },
              { label: "Edit goal", icon: Pencil, onSelect: () => navigate(`/goals/${goal.id}/edit`) },
              { label: "Delete goal", icon: Trash2, destructive: true, onSelect: () => setConfirmingDelete(true) },
            ]}
          />
        }
      />

      <div className="mx-auto max-w-md space-y-6 px-4 pb-[calc(11rem+env(safe-area-inset-bottom))]">
        {cover && (
          <img
            src={cover}
            alt=""
            className="aspect-[16/9] w-full rounded-lg border border-border object-cover shadow-[0_1px_2px_rgba(16,32,24,0.05),0_14px_34px_-16px_rgba(16,32,24,0.22)]"
          />
        )}

        {goal.isCompleted && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-center">
            <p className="text-base font-semibold text-foreground">Goal reached 🎉</p>
            <p className="mt-1 text-sm text-muted-foreground">You and your partner made it together.</p>
          </div>
        )}

        <div>
          <ProgressBar percent={percent} className="mb-2" label={goal.title} />
          <p className="text-base font-semibold text-foreground [font-variant-numeric:tabular-nums]">
            {isFinancial
              ? `${formatAmount(goal.currentAmount)} of ${formatAmount(goal.targetAmount ?? 0)}`
              : `${goal.currentProgressPct}% complete`}
          </p>
          {goal.description && <p className="mt-2 text-sm text-foreground">{goal.description}</p>}
        </div>

        <div>
          <h2 className="mb-3 font-sans text-xl font-semibold text-foreground">Notes</h2>
          {notes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No notes yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep a shared journal for this goal — add an update or a photo below.
              </p>
            </div>
          ) : (
            <NotesFeed notes={notes} onChanged={() => revalidator.revalidate()} />
          )}
        </div>
      </div>

      {/* Bottom action button — the page's one primary action, lifted clear of
          the nav. It opens a chooser: log a contribution, or add a note. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-sticky)] mx-auto flex max-w-md justify-center px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom)+0.75rem)]">
        <button
          type="button"
          onClick={() => setSheet("choose")}
          className="pointer-events-auto inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 outline-none transition-transform active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Plus className="size-5" />
          Add to this goal
        </button>
      </div>

      <ActionChooserSheet
        open={sheet === "choose"}
        onClose={() => setSheet(null)}
        goalType={goal.goalType}
        onPick={(choice) => setSheet(choice)}
      />

      <ContributionSheet
        open={sheet === "contribute"}
        onClose={() => setSheet(null)}
        goalId={goal.id}
        goalType={goal.goalType}
        currentProgressPct={goal.currentProgressPct}
        onContributed={() => revalidator.revalidate()}
      />

      <NoteComposerSheet
        open={sheet === "note"}
        onClose={() => setSheet(null)}
        goalId={goal.id}
        onAdded={() => revalidator.revalidate()}
      />

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this goal?"
        description="This removes the goal, its notes, and its entire contribution history for both of you. This can't be undone."
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

// The two-way chooser behind the bottom "Add" button: contribution vs note.
function ActionChooserSheet({
  open,
  onClose,
  goalType,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  goalType: GoalType;
  onPick: (choice: "contribute" | "note") => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  const contributeCopy =
    goalType === "financial" ? "Log money you've put toward this goal" : "Update how far along you are";

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
      <div className="flex flex-col px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Add to this goal</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-2 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          <ChooserRow
            icon={Coins}
            title={goalType === "financial" ? "Contribution" : "Progress update"}
            description={contributeCopy}
            onClick={() => onPick("contribute")}
          />
          <ChooserRow
            icon={PenLine}
            title="Note"
            description="Write an update and add photos anywhere in it"
            onClick={() => onPick("note")}
          />
        </div>
      </div>
    </dialog>
  );
}

function ChooserRow({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-xl border border-border bg-card p-3.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
