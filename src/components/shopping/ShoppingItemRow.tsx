import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ShoppingItem } from "@/lib/shopping-api";
import { toggleShoppingItem } from "@/lib/shopping-api";
import { ApiError } from "@/lib/api";
import { formatAmount, formatRelativeDate, initials } from "@/lib/format";
import { cn } from "@/components/ui/utils";
import { Button } from "@/components/ui/button";

// A stable, harmonious dot colour per category name — a small splash that makes
// a long list scannable at a glance (the category text stays the real label, so
// colour is never the only signal). Fixed S/L keeps every hue on-key.
function categoryHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % 360;
}

export function ShoppingItemRow({
  item,
  onChanged,
  onDelete,
  addedByLabel,
}: {
  item: ShoppingItem;
  onChanged: () => void;
  // Delete is owned by the page (undoable, delayed-commit); the row just
  // asks for it. Toggle stays local since it's instant and non-destructive.
  onDelete: () => void;
  // Who added this — "You" or the partner's name — shown with the timestamp so
  // the list reads as a shared space rather than a solo to-do.
  addedByLabel: string;
}) {
  // Optimistic toggle: reflect the new state instantly, then reconcile. On a
  // slow connection the checkbox no longer freezes waiting for the round-trip.
  const [pendingChecked, setPendingChecked] = useState<boolean | null>(null);
  const checked = pendingChecked ?? item.isChecked;

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

  const unitPrice = item.price != null ? Number(item.price) : null;
  const hasPrice = unitPrice != null && unitPrice > 0;
  const lineTotal = hasPrice ? unitPrice * item.quantity : 0;

  return (
    <li
      className={cn(
        "group rounded-2xl border p-3.5 shadow-[0_1px_2px_rgba(16,32,24,0.04)] transition-all duration-200 active:scale-[0.99]",
        // A completed item picks up the brand's celebratory lime wash (the
        // same accent GoalCard uses for its "Done" chip) instead of going flat
        // grey — checking something off reads as a small win, not a demotion.
        checked ? "border-accent-strong/25 bg-accent/[0.08]" : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={checked ? `Mark ${item.name} as not bought` : `Mark ${item.name} as bought`}
          onClick={handleToggle}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-6 items-center justify-center rounded-[10px] border-2 transition-colors duration-200",
              checked ? "border-accent-strong bg-accent" : "border-input group-hover:border-primary/50",
            )}
          >
            {/* Mounted only while checked, so every check-off pops in fresh
                instead of just fading a static icon's opacity. */}
            {checked && (
              <Check className="size-4 animate-in zoom-in-50 duration-200 text-accent-foreground" strokeWidth={3} />
            )}
          </span>
        </button>

        <p
          className={cn(
            "min-w-0 flex-1 text-[15px] font-semibold leading-snug text-foreground",
            checked && "text-muted-foreground line-through",
          )}
        >
          <span className="break-words">{item.name}</span>
          {item.quantity > 1 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 align-middle text-xs font-semibold text-secondary-foreground [font-variant-numeric:tabular-nums]">
              ×{item.quantity}
            </span>
          )}
        </p>

        {hasPrice && (
          <span
            className={cn(
              "shrink-0 text-sm font-semibold text-foreground [font-variant-numeric:tabular-nums]",
              checked && "text-muted-foreground",
            )}
          >
            {formatAmount(lineTotal)}
          </span>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-1.5 size-9 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${item.name}`}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Meta + notes, indented to sit under the name (checkbox 44px + gap 12px). */}
      <div className={cn("pl-14", checked && "opacity-60")}>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {item.category && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full"
                style={{ backgroundColor: `hsl(${categoryHue(item.category)} 50% 52%)` }}
              />
              {item.category}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="flex size-4 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground"
            >
              {initials(addedByLabel)}
            </span>
            <span>{addedByLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{formatRelativeDate(item.createdAt)}</span>
            {hasPrice && item.quantity > 1 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatAmount(unitPrice)} each</span>
              </>
            )}
          </span>
        </div>

        {item.notes && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{item.notes}</p>}
      </div>
    </li>
  );
}
