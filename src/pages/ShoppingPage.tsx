import { useLoaderData, useRevalidator } from "react-router";
import { ShoppingCart } from "lucide-react";

import type { ShoppingItem, ShoppingSummary } from "@/lib/shopping-api";
import { deleteShoppingItem } from "@/lib/shopping-api";
import { formatAmount } from "@/lib/format";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { ShoppingItemForm } from "@/components/shopping/ShoppingItemForm";
import { ShoppingItemRow } from "@/components/shopping/ShoppingItemRow";

function groupByCategory(items: ShoppingItem[]): Array<[string, ShoppingItem[]]> {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const key = item.category || "Other";
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return Array.from(groups.entries());
}

export default function ShoppingPage() {
  const { items, summary } = useLoaderData() as { items: ShoppingItem[]; summary: ShoppingSummary };
  const revalidator = useRevalidator();
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
  // Distinct existing categories feed the add-form's suggestions so members
  // reuse a spelling instead of forking a near-duplicate group.
  const categories = Array.from(new Set(items.map((item) => item.category).filter((c): c is string => Boolean(c))));

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
        <ShoppingItemForm onAdded={() => revalidator.revalidate()} categories={categories} />

        {visibleItems.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Your list is empty"
            description="Add an item above to start your shared list."
          />
        ) : (
          <>
            {groups.map(([category, groupItems]) => (
              <div key={category}>
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {category}
                </p>
                <ul className="space-y-2">
                  {groupItems.map((item) => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
                      onChanged={() => revalidator.revalidate()}
                      onDelete={() => requestDelete(item.id, `Deleted "${item.name}"`)}
                    />
                  ))}
                </ul>
              </div>
            ))}

            {doneItems.length > 0 && (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  Done ({doneItems.length})
                </summary>
                <ul className="mt-2 space-y-2">
                  {doneItems.map((item) => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
                      onChanged={() => revalidator.revalidate()}
                      onDelete={() => requestDelete(item.id, `Deleted "${item.name}"`)}
                    />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
