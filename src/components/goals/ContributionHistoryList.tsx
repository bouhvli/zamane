import type { Contribution } from "@/lib/goals-api";
import { formatAmount, formatRelativeDate } from "@/lib/format";

export function ContributionHistoryList({ contributions }: { contributions: Contribution[] }) {
  if (contributions.length === 0) {
    return <p className="text-sm text-muted-foreground">No contributions yet — be the first.</p>;
  }

  return (
    <ul className="space-y-2">
      {contributions.map((contribution) => {
        const who = contribution.displayName || contribution.email.split("@")[0];
        const what =
          contribution.amount != null
            ? formatAmount(contribution.amount)
            : contribution.newProgressPct != null
              ? `${contribution.progressDelta != null && contribution.progressDelta > 0 ? "+" : ""}${contribution.progressDelta}% → ${contribution.newProgressPct}%`
              : "";

        return (
          <li
            key={contribution.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{who}</p>
              {contribution.note && <p className="mt-0.5 text-xs text-muted-foreground">{contribution.note}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-sm font-semibold text-foreground">{what}</p>
              <p className="text-xs text-muted-foreground">{formatRelativeDate(contribution.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
