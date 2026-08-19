import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Plus } from "lucide-react";

import { cn } from "@/components/ui/utils";

/**
 * The floating primary action.
 *
 * It used to be a solid violet lozenge, and on the goal-detail page the same
 * job was done by a full-width solid violet bar. Stacked above the glass nav
 * pill, that put two large objects and ~200px of saturated colour at the
 * bottom of every screen — the heaviest thing in an otherwise pale app, and in
 * three different shapes for one job.
 *
 * Now it is the same material as the nav (level 3 glass), at the same inset
 * and the same radius, so the two read as one docked cluster rather than two
 * accidents. The isolation that makes it the obvious primary action comes from
 * a single saturated violet disc holding the icon, not from mass (Von Restorff
 * by contrast, not by volume) — which also leaves the label as ink on glass,
 * legible without a slab behind it.
 *
 * Two behaviours the old one lacked:
 *  - it collapses to a disc while you scroll down and re-extends when you stop
 *    or scroll back, so it stops sitting on top of the row you're reading;
 *  - `.bottom-fade` (bottom-nav.css) dissolves content under the cluster
 *    instead of letting it run behind a hard edge.
 */
type FabProps = {
  label: string;
  icon?: LucideIcon;
} & ({ to: string; onClick?: never } | { onClick: () => void; to?: never });

const WRAPPER =
  "pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-sticky)] mx-auto flex max-w-md justify-end px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom)+0.75rem)]";

export function Fab({ label, icon: Icon = Plus, ...action }: FabProps) {
  const expanded = useExpandOnRest();

  const className = cn(
    "glass-3 pointer-events-auto group inline-flex h-14 items-center rounded-full pr-1.5 pl-1.5 outline-none",
    "transition-[padding] duration-[var(--dur-3)] ease-[var(--ease-glide)]",
    "focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97]",
    expanded && "pr-5",
  );

  const body = (
    <>
      {/* The one saturated element. Sized to stay a 44px target on its own, so
          the control is comfortably tappable while collapsed. Its shadow is
          deliberately tight — the glass around it is already doing the
          floating, and a second soft cast underneath just reads as glow. */}
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_1px_2px_rgb(var(--glass-ink)/0.16)]"
      >
        <Icon className="size-5" />
      </span>
      {/* Collapsed, the label is clipped to zero width rather than unmounted —
          the accessible name comes from aria-label either way, and animating
          width keeps the disc from jumping as the text goes. */}
      <span
        aria-hidden="true"
        className={cn(
          "overflow-hidden text-sm font-semibold whitespace-nowrap text-foreground",
          "transition-[max-width,opacity,margin] duration-[var(--dur-3)] ease-[var(--ease-glide)]",
          expanded ? "ml-2.5 max-w-[12rem] opacity-100" : "ml-0 max-w-0 opacity-0",
        )}
      >
        {label}
      </span>
    </>
  );

  return (
    <div className={WRAPPER}>
      {"to" in action && action.to ? (
        <Link to={action.to} aria-label={label} className={className}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={action.onClick} aria-label={label} className={className}>
          {body}
        </button>
      )}
    </div>
  );
}

/**
 * True at rest, false while the page is being scrolled down.
 *
 * A labelled control parked over a list covers the row underneath it — on
 * Goals it sat squarely on a card's figures. Collapsing while you scroll down
 * hands that space back, and re-extending the moment you stop (or reverse)
 * means the label is there whenever you are actually looking for the action.
 *
 * Stays expanded for anyone who asks for reduced motion: the collapse is a
 * width animation, and without it the label would simply blink in and out.
 */
function useExpandOnRest(): boolean {
  const [expanded, setExpanded] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let restTimer: number | undefined;
    lastY.current = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastY.current;
      // A small threshold keeps rubber-banding and one-pixel jitter from
      // toggling the control.
      if (delta > 6) setExpanded(false);
      else if (delta < -6 || y < 24) setExpanded(true);
      lastY.current = y;

      window.clearTimeout(restTimer);
      restTimer = window.setTimeout(() => setExpanded(true), 900);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(restTimer);
    };
  }, []);

  return expanded;
}
