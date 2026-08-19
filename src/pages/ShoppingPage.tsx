import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { ChevronDown, ShoppingCart } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import type { ShoppingItem, ShoppingSummary } from "@/lib/shopping-api";
import { deleteShoppingItem } from "@/lib/shopping-api";
import { formatAmount } from "@/lib/format";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Fab } from "@/components/layout/Fab";
import { ShoppingItemSheet } from "@/components/shopping/ShoppingItemSheet";
import { ShoppingItemRow } from "@/components/shopping/ShoppingItemRow";

const OTHER = "Other";

function groupByCategory(items: ShoppingItem[]): Array<[string, ShoppingItem[]]> {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const key = item.category || OTHER;
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  // Real categories first (alphabetical); the uncategorized "Other" bucket
  // always sinks to the bottom rather than jumping around by insertion order.
  return Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === OTHER) return 1;
    if (b === OTHER) return -1;
    return a.localeCompare(b);
  });
}

export default function ShoppingPage() {
  const { user } = useAuth();
  const { items, summary } = useLoaderData() as { items: ShoppingItem[]; summary: ShoppingSummary };
  const revalidator = useRevalidator();
  // Adding is now a deliberate step off the FAB rather than an always-open
  // card at the top of the page — the list itself gets the first viewport.
  const [adding, setAdding] = useState(false);
  const { pendingIds, requestDelete } = useUndoableDelete({
    commit: (id) => deleteShoppingItem(id),
    onCommitted: () => revalidator.revalidate(),
    errorMessage: "Couldn't delete the item. Please try again.",
  });

  // Optimistically hide items awaiting their undo window so the list reads as
  // deleted immediately, while the actual delete is still reversible.
  const visibleItems = items.filter((item) => !pendingIds.has(item.id));
  // Bought items drop into a collapsed "Done" group at the bottom instead of
  // sitting greyed-out among what's still to buy.
  const activeItems = visibleItems.filter((item) => !item.isChecked);
  const doneItems = visibleItems.filter((item) => item.isChecked);
  const groups = groupByCategory(activeItems);
  // Category headers only earn their place once there are ≥2 real groups. When
  // everything is uncategorized (the common quick-add case), a lone "OTHER"
  // heading is noise implying structure that isn't there — so drop it and show
  // a flat list instead.
  const showCategoryHeaders = groups.length > 1 || (groups.length === 1 && groups[0][0] !== OTHER);
  // Distinct existing categories feed the add-form's suggestions so members
  // reuse a spelling instead of forking a near-duplicate group.
  const categories = Array.from(new Set(items.map((item) => item.category).filter((c): c is string => Boolean(c))));

  // Who added an item — "You" for the current user, otherwise the partner's
  // name — so the shared list shows whose is whose at a glance.
  const addedByLabel = (item: ShoppingItem): string => {
    if (user && item.createdBy && item.createdBy === user.id) return "You";
    return item.createdByName || item.createdByEmail?.split("@")[0] || "Partner";
  };

  // Sum of the priced items in a group, for the per-category subtotal.
  const categorySubtotal = (list: ShoppingItem[]): number =>
    list.reduce((sum, it) => sum + (it.price ? Number(it.price) * it.quantity : 0), 0);

  const renderRow = (item: ShoppingItem) => (
    <ShoppingItemRow
      key={item.id}
      item={item}
      addedByLabel={addedByLabel(item)}
      onChanged={() => revalidator.revalidate()}
      onDelete={() => requestDelete(item.id, `Deleted "${item.name}"`)}
    />
  );

  return (
    <div>
      <PageHeader
        title="Shopping"
        description={items.length === 0 ? "No items yet — add the first one." : "Your shared shopping list."}
        stats={[
          { label: "to buy", value: String(summary.uncheckedCount) },
          { label: "checked", value: String(summary.checkedCount) },
          { label: "est. total", value: formatAmount(summary.estimatedTotal) },
        ]}
      />

      <div className="mx-auto max-w-md space-y-6 px-4 pb-12">
        {visibleItems.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Your list is empty"
            description="Tap the button below to add your first item."
          />
        ) : (
          <>
            {showCategoryHeaders ? (
              groups.map(([category, groupItems]) => {
                const subtotal = categorySubtotal(groupItems);
                return (
                  <div key={category}>
                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</p>
                      <p className="font-numeric text-xs text-muted-foreground">
                        {groupItems.length} {groupItems.length === 1 ? "item" : "items"}
                        {subtotal > 0 && ` · ${formatAmount(subtotal)}`}
                      </p>
                    </div>
                    <ul className="space-y-2.5">{groupItems.map(renderRow)}</ul>
                  </div>
                );
              })
            ) : (
              activeItems.length > 0 && <ul className="space-y-2.5">{activeItems.map(renderRow)}</ul>
            )}

            {doneItems.length > 0 && (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <ChevronDown className="size-3.5 transition-transform duration-200 group-open:rotate-180" />
                  Done ({doneItems.length})
                </summary>
                <ul className="mt-2 space-y-2.5">{doneItems.map(renderRow)}</ul>
              </details>
            )}
          </>
        )}
      </div>

      <Fab label="Add item" onClick={() => setAdding(true)} />

      <ShoppingItemSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => revalidator.revalidate()}
        categories={categories}
      />
    </div>
  );
}
