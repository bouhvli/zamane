import { useState } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Goal, Contribution } from "@/lib/goals-api";
import { deleteGoal } from "@/lib/goals-api";
import { ApiError } from "@/lib/api";
import { formatAmount, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { DetailMenu } from "@/components/layout/DetailMenu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProgressBar } from "@/components/goals/ProgressBar";
import { ContributionForm } from "@/components/goals/ContributionForm";
import { ContributionHistoryList } from "@/components/goals/ContributionHistoryList";

export default function GoalDetailPage() {
  const { goal, contributions } = useLoaderData() as { goal: Goal; contributions: Contribution[] };
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
              { label: "Edit goal", icon: Pencil, onSelect: () => navigate(`/goals/${goal.id}/edit`) },
              { label: "Delete goal", icon: Trash2, destructive: true, onSelect: () => setConfirmingDelete(true) },
            ]}
          />
        }
      />

      <div className="mx-auto max-w-md space-y-6 px-4 pb-12">
        {goal.isCompleted && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-center">
            <p className="text-base font-semibold text-foreground">Goal reached 🎉</p>
            <p className="mt-1 text-sm text-muted-foreground">You and your partner made it together.</p>
          </div>
        )}

        <div>
          <ProgressBar percent={percent} className="mb-2" label={goal.title} />
          <p className="text-base font-semibold text-foreground">
            {isFinancial
              ? `${formatAmount(goal.currentAmount)} of ${formatAmount(goal.targetAmount ?? 0)}`
              : `${goal.currentProgressPct}% complete`}
          </p>
          {goal.description && <p className="mt-2 text-sm text-foreground">{goal.description}</p>}
        </div>

        <div>
          <h2 className="mb-3 font-sans text-xl font-semibold text-foreground">Contribute</h2>
          <ContributionForm
            goalId={goal.id}
            goalType={goal.goalType}
            currentProgressPct={goal.currentProgressPct}
            onContributed={() => revalidator.revalidate()}
          />
        </div>

        <div>
          <h2 className="mb-3 font-sans text-xl font-semibold text-foreground">History</h2>
          <ContributionHistoryList contributions={contributions} onChanged={() => revalidator.revalidate()} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this goal?"
        description="This removes the goal and its entire contribution history for both of you. This can't be undone."
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
