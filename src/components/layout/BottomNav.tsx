import type { CSSProperties } from "react";
import { Link, useLocation } from "react-router";

import { cn } from "@/components/ui/utils";
// `?url` + build.assetsInlineLimit:0 (vite.config.ts) guarantee these
// resolve to real file URLs rather than base64 data URIs — inlined data
// URIs silently fail as a CSS mask-image source, while real URLs work.
import homeIcon from "@/assets/icons/home.svg?url";
import tripsIcon from "@/assets/icons/trips.svg?url";
import financeIcon from "@/assets/icons/finance.svg?url";
import shoppingIcon from "@/assets/icons/shopping.svg?url";
import goalsIcon from "@/assets/icons/goals.svg?url";

type BottomNavTab = {
  id: string;
  label: string;
  href: string;
  icon: string;
};

export const DEFAULT_BOTTOM_NAV_TABS: BottomNavTab[] = [
  { id: "home", label: "Home", href: "/home", icon: homeIcon },
  { id: "trips", label: "Trips", href: "/trips", icon: tripsIcon },
  { id: "finance", label: "Finance", href: "/finance", icon: financeIcon },
  { id: "shopping", label: "Shopping", href: "/shopping", icon: shoppingIcon },
  { id: "goals", label: "Goals", href: "/goals", icon: goalsIcon },
];

export function BottomNav({ tabs = DEFAULT_BOTTOM_NAV_TABS }: { tabs?: BottomNavTab[] }) {
  const { pathname } = useLocation();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-nav)] flex justify-center">
      <div className="bottom-nav pb-safe-bottom pointer-events-auto flex w-full max-w-md bg-card/95 backdrop-blur-sm">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.id}
            to={tab.href}
            className={cn(
              "bottom-nav-link relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
              isActive ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "bottom-nav-indicator pointer-events-none absolute inset-x-4 -top-px h-[3px] rounded-full transition-opacity duration-300",
                isActive ? "opacity-100" : "opacity-0",
              )}
            />
            <span
              role="img"
              aria-label={tab.label}
              className={cn("doodle-icon", isActive && "is-active")}
              style={{ "--icon-mask": `url(${tab.icon})` } as CSSProperties}
            />
            <span className="text-xs font-medium">{tab.label}</span>
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
