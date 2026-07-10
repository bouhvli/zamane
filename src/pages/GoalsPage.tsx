import { useLoaderData } from "react-router";

import type { Goal, GoalsSummary } from "@/lib/goals-api";
import { formatAmount } from "@/lib/format";
import { PageHero } from "@/components/layout/PageHero";
import { GoalCard } from "@/components/goals/GoalCard";

export default function GoalsPage() {
  const { goals, summary } = useLoaderData() as { goals: Goal[]; summary: GoalsSummary };

  return (
    <div>
      <PageHero
        label="GOALS"
        value={`${summary.activeCount} active`}
        description={
          summary.activeCount === 0
            ? "No active goals yet — start one together."
            : "Keep going, you're making progress."
        }
        stats={[
          { label: "Active", value: String(summary.activeCount) },
          { label: "Saved this month", value: formatAmount(summary.totalSavedThisMonth) },
          { label: "Completed", value: String(summary.completedCount) },
        ]}
        actions={[{ label: "New goal", to: "/goals/new" }]}
      />

      <div className="mx-auto max-w-md space-y-3 px-4 pb-12">
        {goals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No goals yet — create the first one.
          </div>
        ) : (
          goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)
        )}
      </div>
    </div>
  );
}
