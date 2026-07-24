import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import type { ShoppingItem } from "@/lib/shopping-api";
import { toggleShoppingItem } from "@/lib/shopping-api";
import { ApiError } from "@/lib/api";
import { formatAmount, initials } from "@/lib/format";
import { cn } from "@/components/ui/utils";
import { Button } from "@/components/ui/button";

export function ShoppingItemRow({
  item,
  onChanged,
  onDelete,
  addedBy,
}: {
  item: ShoppingItem;
  onChanged: () => void;
  // Delete is owned by the page (undoable, delayed-commit); the row just
  // asks for it. Toggle stays local since it's instant and non-destructive.
  onDelete: () => void;
  // The partner's display name when *they* added this item — surfaced as a
  // small avatar so the list reads as a shared space, not a solo to-do list.
  // Null for the current user's own items, so it stays signal, not noise.
  addedBy?: string | null;
}) {
  // Optimistic toggle: reflect the new state instantly, then reconcile. On a
  // slow connection the checkbox no longer freezes waiting for the round-trip.
  const [pendingChecked, setPendingChecked] = useState<boolean | null>(null);
  const checked = pendingChecked ?? item.isChecked;

  // Clear the optimistic flag once a revalidate brings the server's value in
  // line, so a later change from the partner's device isn't masked.
  useEffect(() => {
    if (pendingChecked !== null && item.isChecked === pendingChecked) setPendingChecked(null);
  }, [item.isChecked, pendingChecked]);

  async function handleToggle() {
    const next = !checked;
    setPendingChecked(next);
    try {
      await toggleShoppingItem(item.id, next);
      onChanged();
    } catch (error) {
      setPendingChecked(null);
      toast.error(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={checked ? "Mark as not bought" : "Mark as bought"}
        onClick={handleToggle}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-5 items-center justify-center rounded-md border transition-colors",
            checked ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent",
          )}
        >
          <Check className="size-3.5" />
        </span>
      </button>

      <div className={cn("min-w-0 flex-1", checked && "opacity-60")}>
        <p className={cn("truncate text-sm font-medium text-foreground", checked && "line-through")}>
          {item.name}
          {item.quantity > 1 && <span className="ml-1 text-muted-foreground">× {item.quantity}</span>}
        </p>
        {item.notes && <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.notes}</p>}
      </div>

      {item.price && (
        <p className="shrink-0 font-mono text-sm text-muted-foreground">
          {formatAmount(Number(item.price) * item.quantity)}
        </p>
      )}

      {addedBy && (
        <span
          title={`Added by ${addedBy}`}
          aria-label={`Added by ${addedBy}`}
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
        >
          {initials(addedBy)}
        </span>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Delete ${item.name}`}
        onClick={onDelete}
      >
        <X className="size-4" />
      </Button>
    </li>
  );
}
