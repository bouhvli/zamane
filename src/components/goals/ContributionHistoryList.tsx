import { X } from "lucide-react";

import type { Contribution } from "@/lib/goals-api";
import { deleteContribution } from "@/lib/goals-api";
import { formatAmount, formatRelativeDate } from "@/lib/format";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { Button } from "@/components/ui/button";

export function ContributionHistoryList({
  contributions,
  onChanged,
}: {
  contributions: Contribution[];
  onChanged: () => void;
}) {
  const { pendingIds, requestDelete } = useUndoableDelete({
    commit: (id) => deleteContribution(id),
    onCommitted: onChanged,
    errorMessage: "Couldn't remove the contribution. Please try again.",
  });

  const visible = contributions.filter((contribution) => !pendingIds.has(contribution.id));

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">No contributions yet — be the first.</p>;
  }

  return (
    <ul className="space-y-2">
      {visible.map((contribution) => {
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
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{who}</p>
              {contribution.note && <p className="mt-0.5 text-xs text-muted-foreground">{contribution.note}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="text-right">
                <p className="font-mono text-sm font-semibold text-foreground">{what}</p>
                <p className="text-xs text-muted-foreground">{formatRelativeDate(contribution.createdAt)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${who}'s contribution of ${what}`}
                onClick={() => requestDelete(contribution.id, `Removed ${what || "contribution"}`)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
