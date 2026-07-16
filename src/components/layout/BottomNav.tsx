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
    <nav className="bottom-nav pb-safe-bottom fixed inset-x-0 bottom-0 z-[var(--z-nav)] flex justify-center bg-card/95 backdrop-blur-sm">
      <div className="flex w-full max-w-md">
        {tabs.map((tab) => {
          // Match nested routes too, so /goals/123 and /goals/123/edit keep the
          // Goals tab lit — exact-match left detail pages with no active tab.
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.id}
              to={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2.5 outline-none transition-colors duration-150 active:opacity-70 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
                isActive ? "text-[var(--nav-active-foreground)]" : "text-muted-foreground",
              )}
            >
              {/* One flat top-edge bar marks the active tab — a plain
                  200ms fade tied to the route change, not a perpetual
                  animation. */}
              <span
                aria-hidden="true"
                className={cn(
                  "bottom-nav-indicator pointer-events-none absolute inset-x-0 top-0 h-0.5 transition-opacity duration-200 ease-out",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "bottom-nav-active-bg pointer-events-none absolute inset-x-1.5 inset-y-1 -z-10 transition-opacity duration-200 ease-out",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
              <span aria-hidden="true" className="doodle-icon" style={{ "--icon-mask": `url(${tab.icon})` } as CSSProperties} />
              <span className={cn("text-[11px] leading-none transition-[font-weight] duration-150", isActive && "font-semibold")}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
