import { useState } from "react";
import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Trip } from "@/lib/trips-api";
import { parseDay } from "@/lib/format";
import { tripCoverUrl } from "@/lib/trip-photo";
import { cn } from "@/components/ui/utils";

export type TripStatus = { label: string; tone: "live" | "soon" | "past" };

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
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm",
        status.tone === "soon" && "bg-white/90 text-foreground",
        status.tone === "live" && "bg-accent text-accent-foreground",
        status.tone === "past" && "bg-black/45 text-white/90",
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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
      <Icon className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

// The cover surface shared by the trip card and the detail hero. A dark forest
// gradient is ALWAYS painted first, so the frame is fully filled even while the
// photo is still loading or if it fails — the image can never leave a strip of
// page background showing. The photo then covers it edge-to-edge (object-cover,
// no letterboxing); a bottom scrim keeps overlaid white text legible. Overlay
// content (badges, title, controls) is passed as children.
export function TripCover({
  trip,
  className,
  dim,
  children,
}: {
  trip: Trip;
  className?: string;
  /** Slightly desaturate the photo (used for past trips). */
  dim?: boolean;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const coverUrl = tripCoverUrl(trip);
  const showImage = Boolean(coverUrl) && !failed;

  return (
    <div className={cn("relative overflow-hidden bg-[#0C1E15]", className)}>
      {/* Always-on branded base — guarantees the frame is filled. */}
      <div className="absolute inset-0 bg-[radial-gradient(150%_130%_at_20%_10%,#2E5E43_0%,#1E4634_50%,#0C1E15_100%)]" />

      {!showImage && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1.5px)] [background-size:22px_22px]" />
          <MapPin className="absolute -bottom-3 -right-2 size-28 text-white/[0.07]" strokeWidth={1.5} />
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

      {/* Scrim for legibility of the overlaid white text. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />

      {children}
    </div>
  );
}
