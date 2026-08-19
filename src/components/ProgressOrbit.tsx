import type { ReactNode } from "react";

import { cn } from "@/components/ui/utils";

/**
 * The Progress Orbit — a conic-gradient ring, violet at the start of the arc
 * and rose at its head, on a hairline track. See orbit.css for the mechanics.
 *
 * It exists because a savings app's central question is "how far along are
 * we", and a 6px linear bar answers that as a readout rather than an
 * instrument. It also buys back horizontal space: on a compact row the bar had
 * to share a line with two figures, so the ring says the same thing in a
 * 40px square at the end of the row.
 *
 * One component at every size — a row indicator and a goal-detail headline
 * differ only by `size` and `stroke`.
 */
export function ProgressOrbit({
  percent,
  size = 40,
  stroke,
  label,
  children,
  className,
}: {
  percent: number;
  /** Outer diameter in px. */
  size?: number;
  /** Ring thickness in px. Defaults to a tenth of the diameter, floored at 4. */
  stroke?: number;
  /**
   * Accessible name, so a screen reader announces "Apartment deposit 73%"
   * rather than a bare number floating in the row.
   */
  label?: string;
  /** What sits inside the ring. Omit for a bare indicator. */
  children?: ReactNode;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const width = stroke ?? Math.max(4, Math.round(size / 10));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ? `${label} progress` : "Progress"}
      className={cn("orbit", className)}
      style={
        {
          "--orbit-target": clamped / 100,
          "--orbit-size": `${size}px`,
          "--orbit-w": `${width}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * The orbit's horizontal sibling, for the places a ring would be wrong: under
 * a wide figure, or spanning a full row. Same gradient, same track, so the two
 * instruments can never drift apart on colour.
 *
 * (This replaced the old ProgressBar, whose gradient was written inline at
 * three different call sites.)
 */
export function ProgressTrack({
  percent,
  label,
  className,
}: {
  percent: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ? `${label} progress` : "Progress"}
      className={cn("orbit-bar h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div className="orbit-bar-fill h-full rounded-full motion-reduce:transition-none" style={{ width: `${clamped}%` }} />
    </div>
  );
}
