import { Link } from "react-router";
import { ChevronRight, ShoppingCart } from "lucide-react";

import type { ShoppingItem, ShoppingSummary } from "@/lib/shopping-api";
import { formatAmount } from "@/lib/format";

// The Home dashboard's shopping preview: a single click-through card (not the
// full interactive checklist rows — Home is an overview, not where you check
// items off) naming what's still left to buy, with a few of the next items
// as a taste of the list.
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
  const preview = items.filter((item) => !item.isChecked).slice(0, 4);
  const estimatedTotal = Number(summary.estimatedTotal);

  return (
    <Link
      to="/shopping"
      className="group block rounded-lg border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,32,24,0.04),0_10px_28px_-14px_rgba(16,32,24,0.14)] outline-none transition-transform duration-200 active:scale-[0.98] hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/60 motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShoppingCart className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">
              {summary.uncheckedCount} {summary.uncheckedCount === 1 ? "item" : "items"} to buy
            </p>
            {estimatedTotal > 0 && (
              <p className="text-xs text-muted-foreground">{formatAmount(estimatedTotal)} estimated</p>
            )}
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0" />
      </div>

      {preview.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
          {preview.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm text-foreground">
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
              <span className="truncate">
                {item.name}
                {item.quantity > 1 && ` ×${item.quantity}`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-border/60 pt-3 text-sm text-muted-foreground">
          Nothing left to buy — nice work.
        </p>
      )}
    </Link>
  );
}
