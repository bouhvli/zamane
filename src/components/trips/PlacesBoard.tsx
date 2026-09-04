import { useMemo, useState } from "react";
import { CalendarPlus, ExternalLink, MapPinned, Pencil, Star, Trash2 } from "lucide-react";

import type { TripPlace } from "@/lib/trips-api";
import { deleteTripPlace, setTripPlaceVisited, updateTripPlace } from "@/lib/trips-api";
import { formatAmount } from "@/lib/format";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { useOptimisticToggle } from "@/lib/use-optimistic-toggle";
import { cn } from "@/components/ui/utils";
import { TickBox } from "@/components/ui/tick-box";
import { categoryIcon, categoryLabel, TRIP_CATEGORIES } from "./trip-categories";

/** A place's own fields, shaped for the update endpoint. Nulls have to become
 *  `undefined`: the request schema coerces, and a null estCost would coerce
 *  straight to 0 — silently rewriting "no estimate" as "free". */
function placeUpdatePayload(place: TripPlace) {
  return {
    id: place.id,
    name: place.name,
    category: place.category ?? undefined,
    area: place.area ?? undefined,
    notes: place.notes ?? undefined,
    url: place.url ?? undefined,
    estCost: place.estCost ? Number(place.estCost) : undefined,
    isPriority: place.isPriority,
  };
}

type Filter = "all" | "todo" | "visited" | string;

/**
 * The board of candidates: everywhere you want to go on this trip, before any
 * of it is a commitment.
 *
 * Kept apart from the timeline because a place and a plan are different
 * claims. "The fjord viewpoint, sometime this week" belongs on a wishlist you
 * can browse and prune; "Tuesday 09:00" belongs on a spine you can follow.
 * Scheduling links the two rather than copying, so a place knows it's already
 * on the plan and can't be quietly double-booked.
 */
export function PlacesBoard({
  places,
  onSchedule,
  onEdit,
  onChanged,
  onAdd,
}: {
  places: TripPlace[];
  onSchedule: (place: TripPlace) => void;
  onEdit: (place: TripPlace) => void;
  onChanged: () => void;
  onAdd: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const { pendingIds, requestDelete } = useUndoableDelete({
    commit: (id) => deleteTripPlace(id),
    onCommitted: onChanged,
    errorMessage: "Couldn't remove the place. Please try again.",
  });

  const live = places.filter((p) => !pendingIds.has(p.id));

  // Only offer filters that would actually return something — a row of chips
  // where five of seven lead to "no results" teaches nothing about the trip.
  const availableCategories = useMemo(() => {
    const present = new Set(live.map((p) => p.category).filter(Boolean));
    return TRIP_CATEGORIES.filter((c) => present.has(c.value));
  }, [live]);

  const visitedCount = live.filter((p) => p.isVisited).length;

  const shown = live.filter((p) => {
    if (filter === "all") return true;
    if (filter === "todo") return !p.isVisited;
    if (filter === "visited") return p.isVisited;
    return p.category === filter;
  });

  if (places.length === 0) {
    return (
      <div className="glass-2 flex flex-col items-center gap-3 border-dashed border-violet-200 px-6 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-violet-100 text-primary">
          <MapPinned className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="font-medium text-foreground">No places saved yet</p>
          <p className="text-sm text-muted-foreground">
            Collect everywhere you want to go, then drop them onto days when the plan firms up.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="mt-1 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Save a place
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Filter places"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All {live.length}
        </FilterChip>
        {visitedCount > 0 && (
          <>
            <FilterChip active={filter === "todo"} onClick={() => setFilter("todo")}>
              Still to see {live.length - visitedCount}
            </FilterChip>
            <FilterChip active={filter === "visited"} onClick={() => setFilter("visited")}>
              Seen {visitedCount}
            </FilterChip>
          </>
        )}
        {availableCategories.map((c) => (
          <FilterChip key={c.value} active={filter === c.value} onClick={() => setFilter(c.value)}>
            <c.icon aria-hidden="true" className="size-3.5" />
            {c.label}
          </FilterChip>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">Nothing saved under this filter yet.</p>
      ) : (
        <ul className="stagger space-y-2.5">
          {shown.map((place) => (
            <PlaceRow
              key={place.id}
              place={place}
              onSchedule={() => onSchedule(place)}
              onEdit={() => onEdit(place)}
              onDelete={() => requestDelete(place.id, `Removed "${place.name}"`)}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold outline-none",
        "transition-[background-color,border-color,color,transform] duration-[var(--dur-2)] ease-[var(--ease-glide)]",
        "active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-card/70 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function PlaceRow({
  place,
  onSchedule,
  onEdit,
  onDelete,
  onChanged,
}: {
  place: TripPlace;
  onSchedule: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const Icon = categoryIcon(place.category);
  const kind = categoryLabel(place.category);

  const [isVisited, setVisited] = useOptimisticToggle(
    place.isVisited,
    (next) => setTripPlaceVisited(place.id, next),
    onChanged,
    "Couldn't save that. Please try again.",
  );
  const [isPriority, setPriority] = useOptimisticToggle(
    place.isPriority,
    (next) => updateTripPlace({ ...placeUpdatePayload(place), isPriority: next }),
    onChanged,
    "Couldn't save that. Please try again.",
  );

  const meta = [kind, place.area, place.estCost && Number(place.estCost) > 0 ? formatAmount(place.estCost) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      data-checked={isVisited}
      className={cn(
        "glass-1 rounded-md p-3 transition-opacity duration-[var(--dur-2)]",
        isVisited && "opacity-[0.66]",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors duration-[var(--dur-2)]",
            isVisited ? "border-success/30 bg-success-surface text-success" : "border-border bg-card text-primary",
          )}
        >
          <Icon className="size-[1.125rem]" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p
              className={cn(
                "min-w-0 flex-1 text-sm font-semibold leading-snug",
                isVisited ? "text-muted-foreground" : "text-foreground",
              )}
            >
              <span className="strike">{place.name}</span>
            </p>

            {/* The star is the one thing on the board that ranks: a must-do
                against a maybe. Deliberately a boolean, not a 1-5 priority —
                two people rank a five-point scale inconsistently and it stops
                meaning anything by the third place. */}
            <button
              type="button"
              aria-pressed={isPriority}
              aria-label={isPriority ? `Unstar ${place.name}` : `Star ${place.name} as a must-do`}
              onClick={() => setPriority(!isPriority)}
              className="-mt-1.5 -mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Star
                className={cn(
                  "size-4 transition-[color,transform] duration-[var(--dur-2)] ease-[var(--ease-glide)]",
                  isPriority ? "scale-110 fill-accent text-accent" : "text-muted-foreground/70",
                )}
              />
            </button>
          </div>

          {meta && <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>}
          {place.notes && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{place.notes}</p>}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {/* Nothing on the left once it's seen: offering "Add to a day" for
                somewhere you've already been is incoherent, and a "Seen" pill
                beside a struck title and a green tick is the same fact three
                times. */}
            {isVisited ? null : place.isScheduled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[0.6875rem] font-bold text-primary">
                On the plan
              </span>
            ) : (
              <button
                type="button"
                onClick={onSchedule}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-violet-100 px-3 text-xs font-semibold text-primary outline-none transition-colors hover:bg-violet-200 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <CalendarPlus aria-hidden="true" className="size-3.5" />
                Add to a day
              </button>
            )}

            {place.url && (
              <a
                href={place.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <ExternalLink aria-hidden="true" className="size-3.5" />
                Open
              </a>
            )}

            <span className="flex-1" />

            <TickBox
              checked={isVisited}
              label={isVisited ? `Mark ${place.name} as not seen yet` : `Mark ${place.name} as seen`}
              onChange={setVisited}
              size="sm"
            />
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${place.name}`}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Remove ${place.name}`}
              className="-mr-1 flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
