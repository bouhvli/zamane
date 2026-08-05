import type { CSSProperties } from "react";
import { Link, useLocation } from "react-router";

import { cn } from "@/components/ui/utils";
// `?url` + build.assetsInlineLimit:0 (vite.config.ts) guarantee these
// resolve to real file URLs rather than base64 data URIs — inlined data
// URIs silently fail as a CSS mask-image source, while real URLs work.
import homeIcon from "@/assets/icons/home.svg?url";
import tripsIcon from "@/assets/icons/trips.svg?url";
import shoppingIcon from "@/assets/icons/shopping.svg?url";
import goalsIcon from "@/assets/icons/goals.svg?url";
import profileIcon from "@/assets/icons/profile.svg?url";

type BottomNavTab = {
  id: string;
  label: string;
  href: string;
  icon: string;
};

export const DEFAULT_BOTTOM_NAV_TABS: BottomNavTab[] = [
  { id: "home", label: "Home", href: "/home", icon: homeIcon },
  { id: "trips", label: "Trips", href: "/trips", icon: tripsIcon },
  { id: "shopping", label: "Shopping", href: "/shopping", icon: shoppingIcon },
  { id: "goals", label: "Goals", href: "/goals", icon: goalsIcon },
  { id: "profile", label: "Profile", href: "/profile", icon: profileIcon },
];

export function BottomNav({ tabs = DEFAULT_BOTTOM_NAV_TABS }: { tabs?: BottomNavTab[] }) {
  const { pathname } = useLocation();

  return (
    // A floating rounded-rectangle bar, inset from the screen edges and
    // lifted above the safe area. The outer wrapper is click-through; only
    // the bar itself takes pointer events.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-nav)] flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {/* rounded-lg matches the same --radius token every Card in the app
          uses — a refined rounded-rectangle "island" instead of a full
          stadium pill. */}
      <nav
        // Names the landmark. Without it a screen reader's landmark list just
        // reads "navigation" with nothing to distinguish it.
        aria-label="Main"
        className="bottom-nav-pill pointer-events-auto flex w-full max-w-md items-stretch gap-1 rounded-lg p-1.5"
      >
        {tabs.map((tab) => {
          // Match nested routes too, so /goals/123 and /goals/123/edit keep the
          // Goals tab lit — exact-match left detail pages with no active tab.
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.id}
              to={tab.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                // Tapping the tab you're already on scrolls that page back to
                // the top rather than re-running a no-op navigation — the
                // convention every native tab bar follows (Jakob's Law), and
                // the only way back up a long list without a manual swipe.
                if (isActive) window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] py-1 outline-none transition-colors duration-150 active:scale-[0.96] focus-visible:ring-[3px] focus-visible:ring-[var(--nav-fg-active)]/60",
                isActive ? "text-[var(--nav-fg-active)]" : "text-[var(--nav-fg-inactive)]",
              )}
            >
              {/* Active state reads as a tinted icon "pill" — the same
                  bg-primary/10 treatment every icon-in-a-circle moment in the
                  app already uses (HomePage's quick actions, TripDetailPage's
                  header icon, EmptyState) — rather than a bespoke nav-only
                  indicator. The pill is a sibling behind the icon, not a
                  wrapper around it, so it can scale/fade in without shrinking
                  the icon it sits behind. Colour + pill is two active signals;
                  a third (e.g. the old underline bar) was redundant. */}
              <span aria-hidden="true" className="relative flex size-8 items-center justify-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-0 rounded-full bg-primary/10 transition-[opacity,transform] duration-200 ease-out",
                    isActive ? "scale-100 opacity-100" : "scale-75 opacity-0",
                  )}
                />
                <span
                  aria-hidden="true"
                  className="doodle-icon relative"
                  style={{ "--icon-mask": `url(${tab.icon})` } as CSSProperties}
                />
              </span>

              {/* Constant weight and tracking. The active label used to jump
                  400 → 600, which (a) animated font-weight — unreliable, and
                  janky even on a variable font — and (b) grew the widest label
                  to exactly its tab's width at 320px: "Shopping" measured 52px
                  of text in a 52px tab, with a font-fallback render or another
                  locale enough to tip it over. Weight was a third, redundant
                  active signal on top of colour and the icon pill, so it
                  costs nothing to drop. 500 rather than 400 also carries 11px
                  text better. */}
              <span className="text-[11px] leading-none font-medium tracking-tight whitespace-nowrap">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
