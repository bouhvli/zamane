import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Trip } from "@/lib/trips-api";
import { parseDay } from "@/lib/format";
import { tripCoverUrl } from "@/lib/trip-photo";
import { cn } from "@/components/ui/utils";

export type TripStatus = { label: string; tone: "live" | "soon" | "past" };

/** Pairs a trip's cover on a list with the same cover on its detail page, so
 *  the photo grows into place instead of the screen cross-fading. Minted per
 *  trip id because a view-transition-name must be unique among rendered
 *  elements. */
export const tripCoverTransitionName = (id: string) => `trip-cover-${id}`;

// At-a-glance state for the badge: a countdown builds anticipation for an
// upcoming trip (goal-gradient / Zeigarnik), "now" flags the one in progress,
// and past trips fade to a quiet neutral so they don't compete for attention.
export function tripStatus(trip: Trip): TripStatus | null {
  if (!trip.startDate) return null;
  const start = parseDay(trip.startDate);
  const end = trip.endDate ? parseDay(trip.endDate) : start;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 86_400_000;

  if (today < start) {
    const days = Math.round((start.getTime() - today.getTime()) / dayMs);
    const label = days === 0 ? "Starts today" : days === 1 ? "Tomorrow" : `In ${days} days`;
    return { label, tone: "soon" };
  }
  if (today <= end) return { label: "Happening now", tone: "live" };
  return { label: "Past", tone: "past" };
}

export function StatusBadge({ status }: { status: TripStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-numeric text-xs font-bold shadow-sm backdrop-blur-sm",
        status.tone === "soon" && "bg-card/85 text-foreground backdrop-blur-sm",
        // "Happening now" is a live state, not a brand moment — semantic
        // colour, same as a reached goal.
        status.tone === "live" && "bg-success text-white",
        status.tone === "past" && "bg-card/75 text-muted-foreground backdrop-blur-sm",
      )}
    >
      {status.tone !== "past" && (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            status.tone === "live" && "animate-pulse motion-reduce:animate-none",
          )}
        />
      )}
      {status.label}
    </span>
  );
}

// Frosted-glass metadata pill, legible over any photo thanks to the scrim
// beneath it (mirrors the chips on the reference cards).
export function GlassChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="cover-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-numeric text-xs font-medium backdrop-blur-sm">
      <Icon className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

// The cover surface shared by the trip card and the detail hero. The light
// brand wash (see --thumb-wash in theme.css) is ALWAYS painted first, so the
// frame is fully filled even while the photo is still loading or if it fails.
// The photo then covers it edge-to-edge (object-cover, no letterboxing), and
// only then does a scrim go down to keep white overlay text legible.
//
// `data-cover` tells the overlay which world it is in: over a photo the
// children read white (.cover-title / .cover-sub / .cover-chip), over the
// light wash they flip to ink. One decision here instead of six at the call
// sites.
export function TripCover({
  trip,
  className,
  dim,
  children,
  style,
}: {
  trip: Trip;
  className?: string;
  /** Slightly desaturate the photo (used for past trips). */
  dim?: boolean;
  children?: ReactNode;
  /** Carries the view-transition-name pairing this cover with its counterpart
   *  on the other screen. See tripCoverTransitionName. */
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const coverUrl = tripCoverUrl(trip);
  const showImage = Boolean(coverUrl) && !failed;

  return (
    <div
      style={style}
      data-cover={showImage}
      className={cn("brand-thumb-base relative overflow-hidden", className)}
    >
      {/* Always-on branded base — guarantees the frame is filled. */}
      <div className="brand-thumb-radial absolute inset-0" />

      {!showImage && (
        <>
          <MapPin
            className="absolute -right-3 -bottom-4 size-32 text-[var(--thumb-ink)] opacity-[0.12] [stroke-width:1.5]"
          />
        </>
      )}

      {showImage && (
        <img
          src={coverUrl as string}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100",
            dim && "saturate-[0.65]",
          )}
        />
      )}

      {/* Scrim for legibility of the overlaid white text — only meaningful
          over a photo. On the light wash it would just muddy the surface, and
          the overlay flips to ink instead. */}
      {showImage && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
      )}

      {children}
    </div>
  );
}
