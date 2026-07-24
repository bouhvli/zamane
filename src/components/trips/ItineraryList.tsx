import { Clock, MapPin, X } from "lucide-react";

import type { ItineraryItem } from "@/lib/trips-api";
import { deleteItineraryItem } from "@/lib/trips-api";
import { parseDay } from "@/lib/format";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { Button } from "@/components/ui/button";

// Leading tile: a calendar chip for dated stops, a neutral clock for the
// "no time set yet" ones — the visual spine that turns a flat list into a
// readable plan.
function DateTile({ date }: { date: string | null }) {
  if (!date) {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Clock className="size-5" />
      </div>
    );
  }
  const d = parseDay(date);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(d);
  return (
    <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
      <span className="text-[10px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">{month}</span>
      <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
    </div>
  );
}

// Chronological order so the itinerary reads as a real timeline no matter what
// order stops were added in: dated items first (by date, then time), undated
// ones after in the order they were created (Array.sort is stable).
function sortChronologically(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    const at = a.itemDate ? parseDay(a.itemDate).getTime() : null;
    const bt = b.itemDate ? parseDay(b.itemDate).getTime() : null;
    if (at === null && bt === null) return 0;
    if (at === null) return 1;
    if (bt === null) return -1;
    if (at !== bt) return at - bt;
    return (a.itemTime ?? "").localeCompare(b.itemTime ?? "");
  });
}

export function ItineraryList({ items, onChanged }: { items: ItineraryItem[]; onChanged: () => void }) {
  const { pendingIds, requestDelete } = useUndoableDelete({
    commit: (id) => deleteItineraryItem(id),
    onCommitted: onChanged,
    errorMessage: "Couldn't delete the item. Please try again.",
  });

  const visible = sortChronologically(items.filter((item) => !pendingIds.has(item.id)));

  return (
    <ul className="space-y-2">
      {visible.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3 shadow-[0_1px_2px_rgba(16,32,24,0.04)]"
        >
          <DateTile date={item.itemDate} />

          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            {(item.itemTime || item.location) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {item.itemTime && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5 shrink-0" />
                    {item.itemTime}
                  </span>
                )}
                {item.location && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </span>
                )}
              </div>
            )}
            {item.notes && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{item.notes}</p>}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-mr-1 -mt-1 size-9 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${item.title}`}
            onClick={() => requestDelete(item.id, `Deleted "${item.title}"`)}
          >
            <X className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
