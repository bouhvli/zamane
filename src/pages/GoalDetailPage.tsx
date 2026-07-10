import { Link, useLoaderData, useRevalidator } from "react-router";

import type { Goal, Contribution } from "@/lib/goals-api";
import { formatAmount, formatDate } from "@/lib/format";
import { PageHero } from "@/components/layout/PageHero";
import { ProgressBar } from "@/components/goals/ProgressBar";
import { ContributionForm } from "@/components/goals/ContributionForm";
import { ContributionHistoryList } from "@/components/goals/ContributionHistoryList";

export default function GoalDetailPage() {
  const { goal, contributions } = useLoaderData() as { goal: Goal; contributions: Contribution[] };
  const revalidator = useRevalidator();

  const isFinancial = goal.goalType === "financial";
  const percent = isFinancial
    ? goal.targetAmount
      ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100
      : 0
    : goal.currentProgressPct;

  return (
    <div>
      <PageHero
        label={isFinancial ? "FINANCIAL GOAL" : "GENERAL GOAL"}
        value={goal.title}
        description={goal.targetDate ? `Target date: ${formatDate(goal.targetDate)}` : undefined}
        status={{ text: goal.isCompleted ? "Done" : "In progress", tone: goal.isCompleted ? "primary" : "accent" }}
      />

      <div className="mx-auto max-w-md space-y-6 px-4 pb-12">
        <div>
          <ProgressBar percent={percent} className="mb-2" />
          <p className="text-base font-semibold text-foreground">
            {isFinancial
              ? `${formatAmount(goal.currentAmount)} of ${formatAmount(goal.targetAmount ?? 0)}`
              : `${goal.currentProgressPct}% complete`}
          </p>
          {goal.description && <p className="mt-2 text-sm text-foreground">{goal.description}</p>}
        </div>

        <div>
          <h2 className="mb-3 font-heading text-xl text-foreground">Contribute</h2>
          <ContributionForm goalId={goal.id} goalType={goal.goalType} onContributed={() => revalidator.revalidate()} />
        </div>

        <div>
          <h2 className="mb-3 font-heading text-xl text-foreground">History</h2>
          <ContributionHistoryList contributions={contributions} />
        </div>

        <Link
          to="/goals"
          className="block rounded-sm text-center text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Back to all goals
        </Link>
      </div>
    </div>
  );
}
