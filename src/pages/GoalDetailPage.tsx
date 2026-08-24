import { useEffect, useRef, useState } from "react";
import { useNavigate, useRevalidator } from "react-router";
import { Coins, History, PenLine, Pencil, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import type { Goal, GoalNote, GoalType } from "@/lib/goals-api";
import { deleteGoal } from "@/lib/goals-api";
import { goalImageUrl } from "@/lib/goal-image";
import { ApiError } from "@/lib/api";
import { formatAmount, formatDate } from "@/lib/format";
import { useRouteData } from "@/lib/use-route-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { DetailSkeleton } from "@/components/layout/Skeleton";
import { Fab } from "@/components/layout/Fab";
import { DetailMenu } from "@/components/layout/DetailMenu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProgressOrbit } from "@/components/ProgressOrbit";
import { goalCoverTransitionName } from "@/components/goals/GoalCard";
import { NotesFeed } from "@/components/goals/NotesFeed";
import { ContributionSheet } from "@/components/goals/ContributionSheet";
import { NoteComposerSheet } from "@/components/goals/NoteComposerSheet";

type Sheet = null | "choose" | "contribute" | "note";

export default function GoalDetailPage() {
  // `undefined` until the payload lands — see src/lib/use-route-data.ts. Read
  // before the other hooks, unwrapped after them, so the skeleton's early
  // return never sits between two hook calls.
  const data = useRouteData<{ goal: Goal; notes: GoalNote[] }>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  if (!data) return <DetailSkeleton rows={2} />;

  const { goal, notes } = data;

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
  // What's still missing — the figure that tells you whether to act, which
  // the page made you subtract for yourself.
  const remaining = Math.max(0, Number(goal.targetAmount ?? 0) - Number(goal.currentAmount));
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
        status={{ text: goal.isCompleted ? "Reached" : "In progress", tone: goal.isCompleted ? "success" : "accent" }}
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
            // The other half of the pair: the list card's thumbnail carries the
            // same name, so following the link grows the photo into this cover
            // instead of cross-fading the whole screen.
            style={{ viewTransitionName: goalCoverTransitionName(goal.id) }}
            className="aspect-[16/9] w-full rounded-lg border border-border object-cover shadow-[0_2px_4px_rgb(var(--glass-ink)/0.04),0_22px_44px_-26px_rgb(var(--glass-cast)/0.3)]"
          />
        )}

        {goal.isCompleted && (
          <div className="rounded-lg border border-success/30 bg-success-surface p-4 text-center">
            <p className="text-base font-semibold text-foreground">Goal reached 🎉</p>
            <p className="mt-1 text-sm text-muted-foreground">You and your partner made it together.</p>
          </div>
        )}

        {/* The orbit at headline size. This page's whole reason to exist is
            "how are we doing on this one", and a 6px bar answered it in the
            margin — the ring makes the answer the first thing on the screen,
            with the money reading beside it rather than under it. */}
        <div className="glass-2 flex items-center gap-5 p-5">
          <ProgressOrbit percent={percent} size={104} stroke={10} label={goal.title} animate>
            <span className="orbit-value text-2xl">
              {Math.round(percent)}
              <span className="text-[0.5em] font-semibold">%</span>
            </span>
          </ProgressOrbit>

          <div className="min-w-0 flex-1">
            {isFinancial ? (
              <>
                <p className="font-display text-xl text-foreground">{formatAmount(goal.currentAmount)}</p>
                <p className="mt-0.5 font-numeric text-sm text-muted-foreground">
                  of {formatAmount(goal.targetAmount ?? 0)}
                </p>
                {remaining > 0 && (
                  <p className="mt-2 font-numeric text-sm font-bold text-foreground">
                    {formatAmount(remaining)} to go
                  </p>
                )}
              </>
            ) : (
              <p className="font-display text-xl text-foreground">
                {goal.isCompleted ? "Reached" : "In progress"}
              </p>
            )}
          </div>
        </div>

        {goal.description && <p className="text-sm text-foreground">{goal.description}</p>}

        <div>
          <h2 className="mb-3 text-xl font-semibold text-foreground">Notes</h2>
          {notes.length === 0 ? (
            <div className="glass-2 border-dashed border-violet-200 px-4 py-8 text-center">
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

      {/* The page's one primary action, in the same floating control every
          other screen uses. It was a full-width solid violet bar here — a
          third shape for one job, and the heaviest element on the page.
          It opens a chooser: log a contribution, or add a note. */}
      <Fab label="Add to this goal" onClick={() => setSheet("choose")} />

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
      className="sheet-dialog glass-4"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="flex flex-col px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div aria-hidden="true" className="sheet-grabber mx-auto mb-3" />
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
