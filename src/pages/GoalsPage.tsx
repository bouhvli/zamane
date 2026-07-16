import { useLoaderData } from "react-router";
import { Target } from "lucide-react";

import type { Goal, GoalsSummary } from "@/lib/goals-api";
import { formatAmount } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/layout/Fab";
import { EmptyState } from "@/components/layout/EmptyState";
import { GoalCard } from "@/components/goals/GoalCard";

export default function GoalsPage() {
  const { goals, summary } = useLoaderData() as { goals: Goal[]; summary: GoalsSummary };

  return (
    <div>
      <PageHeader
        title="Goals"
        description={
          summary.activeCount === 0
            ? "No active goals yet — start one together."
            : "Keep going, you're making progress."
        }
        stats={[
          { label: "active", value: String(summary.activeCount) },
          { label: "saved this month", value: formatAmount(summary.totalSavedThisMonth) },
          { label: "completed", value: String(summary.completedCount) },
        ]}
      />

      <div className="mx-auto max-w-md space-y-3 px-4 pb-12">
        {goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Start saving toward something together."
            action={{ to: "/goals/new", label: "Create a goal" }}
          />
        ) : (
          goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)
        )}
      </div>

      <Fab to="/goals/new" label="New goal" />
    </div>
  );
}
