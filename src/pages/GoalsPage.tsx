import { CircleDot } from "lucide-react";

import type { Goal, GoalsSummary } from "@/lib/goals-api";
import { useRouteData } from "@/lib/use-route-data";
import { formatAmount } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageSkeleton } from "@/components/layout/Skeleton";
import { Fab } from "@/components/layout/Fab";
import { EmptyState } from "@/components/layout/EmptyState";
import { GoalCard } from "@/components/goals/GoalCard";

export default function GoalsPage() {
  // `undefined` until the payload lands — the route committed without waiting
  // for it, which is what makes the tab switch itself instant. See
  // src/lib/use-route-data.ts.
  const data = useRouteData<{ goals: Goal[]; summary: GoalsSummary }>();

  if (!data) return <PageSkeleton cards={3} />;

  const { goals, summary } = data;

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

      <div className="stagger mx-auto max-w-md space-y-4 px-4 pb-12">
        {goals.length === 0 ? (
          <EmptyState
            icon={CircleDot}
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
