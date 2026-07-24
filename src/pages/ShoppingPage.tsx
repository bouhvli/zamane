import { useLoaderData, useRevalidator } from "react-router";
import { ShoppingCart } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import type { ShoppingItem, ShoppingSummary } from "@/lib/shopping-api";
import { deleteShoppingItem } from "@/lib/shopping-api";
import { formatAmount } from "@/lib/format";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { ShoppingItemForm } from "@/components/shopping/ShoppingItemForm";
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

  // The partner's name when *they* added an item, so the row can show whose it
  // is. Null for your own items (and before a partner joins) — signal only.
  const addedByPartner = (item: ShoppingItem): string | null => {
    if (!user || !item.createdBy || item.createdBy === user.id) return null;
    return item.createdByName || item.createdByEmail?.split("@")[0] || "Partner";
  };

  const renderRow = (item: ShoppingItem) => (
    <ShoppingItemRow
      key={item.id}
      item={item}
      addedBy={addedByPartner(item)}
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
        <ShoppingItemForm onAdded={() => revalidator.revalidate()} categories={categories} />

        {visibleItems.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Your list is empty"
            description="Add an item above to start your shared list."
          />
        ) : (
          <>
            {showCategoryHeaders ? (
              groups.map(([category, groupItems]) => (
                <div key={category}>
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {category}
                  </p>
                  <ul className="space-y-2">{groupItems.map(renderRow)}</ul>
                </div>
              ))
            ) : (
              activeItems.length > 0 && <ul className="space-y-2">{activeItems.map(renderRow)}</ul>
            )}

            {doneItems.length > 0 && (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  Done ({doneItems.length})
                </summary>
                <ul className="mt-2 space-y-2">{doneItems.map(renderRow)}</ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
