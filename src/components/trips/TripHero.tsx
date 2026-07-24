import { Link } from "react-router";
import { Calendar, ChevronLeft, MapPin, Route, Wallet } from "lucide-react";

import type { Trip } from "@/lib/trips-api";
import { formatAmount, formatDateRange } from "@/lib/format";
import { DetailMenu, type DetailMenuItem } from "@/components/layout/DetailMenu";
import { GlassChip, StatusBadge, TripCover, tripStatus } from "./trip-visuals";

const GLASS_CIRCLE =
  "flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/15 text-white backdrop-blur-sm outline-none transition-colors hover:bg-white hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-white/60";

// The trip detail header, styled as a large version of the trip card: the
// destination photo (or branded gradient) fills a tall hero, with the back
// affordance and overflow menu floated on top and the title + metadata chips
// overlaid at the bottom — the same visual language as the list card.
export function TripHero({
  trip,
  backTo,
  menuItems,
}: {
  trip: Trip;
  backTo: string;
  menuItems: DetailMenuItem[];
}) {
  const status = tripStatus(trip);
  const dateRange = trip.startDate ? formatDateRange(trip.startDate, trip.endDate) : null;

  return (
    <div className="mx-auto max-w-md px-4 pt-4">
      <TripCover
        trip={trip}
        dim={status?.tone === "past"}
        className="aspect-[4/3] rounded-lg shadow-[0_1px_2px_rgba(16,32,24,0.05),0_16px_38px_-16px_rgba(16,32,24,0.3)]"
      >
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3.5">
          <div className="flex items-center gap-2">
            <Link to={backTo} aria-label="Back to trips" className={GLASS_CIRCLE}>
              <ChevronLeft className="size-5" />
            </Link>
            {status && <StatusBadge status={status} />}
          </div>
          <DetailMenu
            items={menuItems}
            triggerClassName="size-9 rounded-full border border-white/20 bg-white/15 text-white backdrop-blur-sm hover:bg-white hover:text-foreground focus-visible:ring-white/60"
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="flex items-center gap-1 text-sm font-medium text-white/80">
            <MapPin className="size-4 shrink-0" />
            <span className="truncate">{trip.destination ?? "No destination set yet"}</span>
          </p>
          <h1 className="mt-1 text-balance text-2xl font-bold leading-tight tracking-tight text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.4)]">
            {trip.title}
          </h1>

          {(dateRange || trip.itineraryCount > 0 || trip.budget) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {dateRange && <GlassChip icon={Calendar}>{dateRange}</GlassChip>}
              {trip.itineraryCount > 0 && (
                <GlassChip icon={Route}>
                  {trip.itineraryCount} {trip.itineraryCount === 1 ? "stop" : "stops"}
                </GlassChip>
              )}
              {trip.budget && (
                <GlassChip icon={Wallet}>
                  <span className="[font-variant-numeric:tabular-nums]">{formatAmount(trip.budget)}</span>
                </GlassChip>
              )}
            </div>
          )}
        </div>
      </TripCover>
    </div>
  );
}
