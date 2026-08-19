import { Link } from "react-router";
import { ShoppingCart } from "lucide-react";

import type { ShoppingItem, ShoppingSummary } from "@/lib/shopping-api";
import { formatAmount } from "@/lib/format";
import { cn } from "@/components/ui/utils";
import { CardThumb } from "@/components/layout/CardThumb";
import { GLASS_ROW } from "@/components/layout/glass-row";
import { ProgressBar } from "@/components/goals/ProgressBar";

// The Home dashboard's shopping row: a single click-through card (not the full
// interactive checklist — Home is an overview, not where you check items off),
// built to the same grammar as the compact goal and trip rows.
//
// Two things it didn't surface before: the list's own progress (a shopping list
// IS a progress bar, and `checkedCount` was already in the summary, unused),
// and the item names inline rather than as a four-row list — that list cost
// ~70px to say what one truncated line says.
export function ShoppingPreviewCard({
  items,
  summary,
}: {
  items: ShoppingItem[];
  summary: ShoppingSummary;
}) {
  // Already ordered unchecked-first by the API, but filter explicitly so an
  // all-checked list shows the "nothing left" copy instead of stale bought
  // items.
  const preview = items.filter((item) => !item.isChecked).slice(0, 3);
  const estimatedTotal = Number(summary.estimatedTotal);
  const total = summary.uncheckedCount + summary.checkedCount;
  const percent = total > 0 ? (summary.checkedCount / total) * 100 : 0;

  const names = preview
    .map((item) => (item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name))
    .join(", ");

  return (
    <Link
      to="/shopping"
      aria-label="Open the shopping list"
      className={cn(GLASS_ROW, "group block rounded-md p-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60")}
    >
      <div className="flex items-center gap-3">
        <CardThumb icon={ShoppingCart} />

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm font-semibold leading-tight text-foreground">
              {summary.uncheckedCount === 0
                ? "Nothing left to buy"
                : `${summary.uncheckedCount} ${summary.uncheckedCount === 1 ? "item" : "items"} to buy`}
            </h3>
            {estimatedTotal > 0 && (
              <span className="shrink-0 font-numeric text-xs font-bold text-foreground">
                {formatAmount(estimatedTotal)}
              </span>
            )}
          </div>

          <ProgressBar percent={percent} label="Shopping list" className="h-1.5" />

          <p className="mt-1.5 flex min-w-0 items-baseline gap-1.5 text-xs">
            <span className="shrink-0 font-numeric font-bold text-muted-foreground">
              {summary.checkedCount} of {total} bought
            </span>
            {names && (
              <>
                <span aria-hidden="true" className="shrink-0 text-muted-foreground/50">
                  ·
                </span>
                <span className="truncate text-muted-foreground">{names}</span>
              </>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
