import { X } from "lucide-react";

import type { ItineraryItem } from "@/lib/trips-api";
import { deleteItineraryItem } from "@/lib/trips-api";
import { formatDate } from "@/lib/format";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { Button } from "@/components/ui/button";

export function ItineraryList({ items, onChanged }: { items: ItineraryItem[]; onChanged: () => void }) {
  const { pendingIds, requestDelete } = useUndoableDelete({
    commit: (id) => deleteItineraryItem(id),
    onCommitted: onChanged,
    errorMessage: "Couldn't delete the item. Please try again.",
  });

  const visible = items.filter((item) => !pendingIds.has(item.id));

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">No itinerary items yet — add the first one.</p>;
  }

  return (
    <ul className="space-y-2">
      {visible.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            {item.location && <p className="mt-0.5 text-xs text-muted-foreground">{item.location}</p>}
            {item.notes && <p className="mt-0.5 text-xs text-muted-foreground">{item.notes}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right text-xs text-muted-foreground">
              {item.itemDate && <p>{formatDate(item.itemDate)}</p>}
              {item.itemTime && <p>{item.itemTime}</p>}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${item.title}`}
              onClick={() => requestDelete(item.id, `Deleted "${item.title}"`)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
