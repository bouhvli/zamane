import { useLoaderData, useRevalidator } from "react-router";
import { TrendingUp } from "lucide-react";

import type { Goal, Contribution } from "@/lib/goals-api";
import { formatAmount, formatRelativeDate, initials } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/components/goals/ProgressBar";
import { ContributionHistoryList } from "@/components/goals/ContributionHistoryList";
import { EmptyState } from "@/components/layout/EmptyState";

export default function GoalHistoryPage() {
  const { goal, contributions } = useLoaderData() as { goal: Goal; contributions: Contribution[] };
  const revalidator = useRevalidator();
  const isFinancial = goal.goalType === "financial";

  const percent = isFinancial
    ? goal.targetAmount
      ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100
      : 0
    : goal.currentProgressPct;
  const pct = Math.round(Math.max(0, Math.min(100, percent)));

  // KPIs are derived from the contribution log (small, per-couple), not a
  // second server round-trip.
  const money = contributions.filter((c) => c.amount != null).map((c) => Number(c.amount));
  const sum = money.reduce((total, value) => total + value, 0);
  const count = isFinancial ? money.length : contributions.length;
  const avg = money.length ? sum / money.length : 0;
  const largest = money.length ? Math.max(...money) : 0;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = contributions
    .filter((c) => c.amount != null && new Date(c.createdAt) >= monthStart)
    .reduce((total, c) => total + Number(c.amount), 0);

  const latest = contributions[0]?.createdAt;

  // Per-partner split.
  const byUser = new Map<string, { name: string; sum: number; count: number }>();
  for (const c of contributions) {
    const name = c.displayName || c.email.split("@")[0];
    const entry = byUser.get(c.userId) ?? { name, sum: 0, count: 0 };
    if (c.amount != null) entry.sum += Number(c.amount);
    entry.count += 1;
    byUser.set(c.userId, entry);
  }
  const partners = [...byUser.values()].sort((a, b) => (isFinancial ? b.sum - a.sum : b.count - a.count));

  return (
    <div>
      <PageHeader back={{ to: `/goals/${goal.id}`, label: "Goal" }} title="History & stats" description={goal.title} />

      <div className="mx-auto max-w-md space-y-6 px-4 pb-12">
        {count === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Nothing logged yet"
            description={
              isFinancial
                ? "Contributions you log will show up here with the numbers behind them."
                : "Progress updates you log will show up here with the numbers behind them."
            }
          />
        ) : (
          <>
            {/* Headline: where the goal stands right now. */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(26,15,20,0.04),0_10px_28px_-16px_rgba(26,15,20,0.16)]">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-2xl font-bold tracking-tight text-foreground [font-variant-numeric:tabular-nums]">
                  {isFinancial ? formatAmount(goal.currentAmount) : `${goal.currentProgressPct}%`}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">{pct}%</span>
              </div>
              <ProgressBar percent={percent} label={goal.title} />
              <p className="mt-2 text-sm text-muted-foreground">
                {isFinancial
                  ? `of ${formatAmount(goal.targetAmount ?? 0)} · ${formatAmount(Math.max(0, Number(goal.targetAmount ?? 0) - Number(goal.currentAmount)))} to go`
                  : goal.isCompleted
                    ? "Completed 🎉"
                    : "In progress"}
              </p>
            </div>

            {/* KPI grid. */}
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={isFinancial ? "Contributions" : "Updates"} value={String(count)} />
              {isFinancial ? (
                <>
                  <StatTile label="Average" value={formatAmount(avg)} />
                  <StatTile label="Largest" value={formatAmount(largest)} />
                  <StatTile label="This month" value={formatAmount(thisMonth)} />
                </>
              ) : (
                <StatTile label="Last update" value={latest ? formatRelativeDate(latest) : "—"} />
              )}
            </div>

            {/* Who did what. */}
            {partners.length > 0 && (
              <div>
                <h2 className="mb-3 font-sans text-base font-semibold text-foreground">By partner</h2>
                <div className="space-y-2">
                  {partners.map((partner) => {
                    const share = isFinancial && sum > 0 ? Math.round((partner.sum / sum) * 100) : null;
                    return (
                      <div
                        key={partner.name}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                      >
                        <span
                          aria-hidden="true"
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
                        >
                          {initials(partner.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{partner.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {partner.count} {partner.count === 1 ? (isFinancial ? "contribution" : "update") : isFinancial ? "contributions" : "updates"}
                          </p>
                        </div>
                        {isFinancial && (
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-foreground [font-variant-numeric:tabular-nums]">
                              {formatAmount(partner.sum)}
                            </p>
                            {share != null && <p className="text-xs text-muted-foreground">{share}%</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full log. */}
            <div>
              <h2 className="mb-3 font-sans text-base font-semibold text-foreground">All activity</h2>
              <ContributionHistoryList contributions={contributions} onChanged={() => revalidator.revalidate()} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight text-foreground [font-variant-numeric:tabular-nums]">{value}</p>
    </div>
  );
}
