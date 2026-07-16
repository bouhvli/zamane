import { Link } from "react-router";

import type { Trip } from "@/lib/trips-api";
import { formatAmount, formatDate } from "@/lib/format";

export function TripCard({ trip }: { trip: Trip }) {
  const dateRange = trip.startDate
    ? trip.endDate && trip.endDate !== trip.startDate
      ? `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`
      : formatDate(trip.startDate)
    : null;

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-[color,background-color,border-color,transform] active:scale-[0.98] hover:border-primary/40"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 min-w-0 text-balance text-lg font-semibold leading-snug text-foreground">
          {trip.title}
        </h3>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {trip.itineraryCount} {trip.itineraryCount === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{trip.destination ?? "No destination set"}</span>
        {dateRange && <span>{dateRange}</span>}
      </div>

      {trip.budget && (
        <p className="mt-2 font-mono text-sm font-semibold text-foreground">{formatAmount(trip.budget)} budget</p>
      )}
    </Link>
  );
}
