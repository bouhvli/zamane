import { Link } from "react-router";
import { Calendar, ChevronRight, MapPin, Route, Wallet } from "lucide-react";

import type { Trip } from "@/lib/trips-api";
import { formatAmount, formatDateRange } from "@/lib/format";
import { tripCoverUrl } from "@/lib/trip-photo";
import { cn } from "@/components/ui/utils";
import { CardThumb } from "@/components/layout/CardThumb";
import { GLASS_ROW } from "@/components/layout/glass-row";
import { GlassChip, StatusBadge, TripCover, tripStatus, tripCoverTransitionName } from "./trip-visuals";

export function TripCard({ trip, variant = "full" }: { trip: Trip; variant?: "full" | "compact" }) {
  return variant === "compact" ? <CompactTripCard trip={trip} /> : <FullTripCard trip={trip} />;
}

// The dashboard row — ~90px against the full card's ~244px. The photo shrinks
// to a thumbnail and the three facts that were floating in glass chips over it
// become one legible metadata line on a solid surface, with the countdown
// leading because it's the fact that decides whether you care right now.
function CompactTripCard({ trip }: { trip: Trip }) {
  const status = tripStatus(trip);
  const dateRange = trip.startDate ? formatDateRange(trip.startDate, trip.endDate) : null;

  // Assembled as an array so the "·" separators land only between facts that
  // actually exist — no dangling dot on a trip with no budget.
  const facts = [
    dateRange,
    trip.itineraryCount > 0 ? `${trip.itineraryCount} ${trip.itineraryCount === 1 ? "stop" : "stops"}` : null,
    trip.budget ? formatAmount(trip.budget) : null,
  ].filter(Boolean);

  return (
    <Link
      to={`/trips/${trip.id}`}
      viewTransition
      aria-label={`Open ${trip.title}`}
      className={cn(GLASS_ROW, "group block rounded-md p-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60")}
    >
      <div className="flex items-center gap-3">
        <CardThumb
          src={tripCoverUrl(trip)}
          icon={MapPin}
          dim={status?.tone === "past"}
          style={{ viewTransitionName: tripCoverTransitionName(trip.id) }}
        />

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight text-foreground">{trip.title}</h3>

          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin aria-hidden="true" className="size-3 shrink-0" />
            <span className="truncate">{trip.destination ?? "No destination set yet"}</span>
          </p>

          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
            {status && (
              <>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 font-numeric font-bold",
                    status.tone === "live" && "text-rose-700",
                    status.tone === "soon" && "text-primary",
                    status.tone === "past" && "text-muted-foreground",
                  )}
                >
                  {status.tone === "live" && (
                    <span
                      aria-hidden="true"
                      className="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none"
                    />
                  )}
                  {status.label}
                </span>
                {facts.length > 0 && (
                  <span aria-hidden="true" className="shrink-0 text-muted-foreground/50">
                    ·
                  </span>
                )}
              </>
            )}
            <span className="truncate font-numeric text-muted-foreground">{facts.join(" · ")}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}

function FullTripCard({ trip }: { trip: Trip }) {
  const status = tripStatus(trip);
  const dateRange = trip.startDate ? formatDateRange(trip.startDate, trip.endDate) : null;

  return (
    <Link
      to={`/trips/${trip.id}`}
      viewTransition
      aria-label={`Open ${trip.title}`}
      className="group relative block rounded-lg outline-none transition-transform duration-[var(--dur-2)] ease-[var(--ease-glide)] hover:-translate-y-0.5 active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/60 motion-reduce:hover:translate-y-0"
    >
      <TripCover
        trip={trip}
        dim={status?.tone === "past"}
        style={{ viewTransitionName: tripCoverTransitionName(trip.id) }}
        className="aspect-[16/10] rounded-lg shadow-[0_2px_4px_rgb(var(--glass-ink)/0.04),0_22px_44px_-26px_rgb(var(--glass-cast)/0.4)]"
      >
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3.5">
          {status ? <StatusBadge status={status} /> : <span aria-hidden="true" />}
          <span
            aria-hidden="true"
            className="cover-chip flex size-9 items-center justify-center rounded-full backdrop-blur-sm transition-colors duration-[var(--dur-2)] group-hover:bg-card group-hover:text-foreground"
          >
            <ChevronRight className="size-5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0" />
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="cover-sub flex items-center gap-1 text-xs font-medium">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{trip.destination ?? "No destination set yet"}</span>
          </p>
          <h3 className="cover-title mt-1 line-clamp-2 text-xl leading-tight font-bold tracking-tight text-balance">
            {trip.title}
          </h3>

          {(dateRange || trip.itineraryCount > 0 || trip.budget) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {dateRange && <GlassChip icon={Calendar}>{dateRange}</GlassChip>}
              {trip.itineraryCount > 0 && (
                <GlassChip icon={Route}>
                  {trip.itineraryCount} {trip.itineraryCount === 1 ? "stop" : "stops"}
                </GlassChip>
              )}
              {trip.budget && (
                <GlassChip icon={Wallet}>
                  {formatAmount(trip.budget)}
                </GlassChip>
              )}
            </div>
          )}
        </div>
      </TripCover>
    </Link>
  );
}
