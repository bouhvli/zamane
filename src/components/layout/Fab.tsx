import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Plus } from "lucide-react";

const WRAPPER =
  "pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-sticky)] mx-auto flex max-w-md justify-end px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom)+0.75rem)]";
const PILL =
  "pointer-events-auto inline-flex h-14 items-center gap-2 rounded-full bg-primary pr-6 pl-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 outline-none transition-transform active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/50";

// Floating action button for a page's primary create action. Anchored bottom-
// right within the content column and lifted clear of the bottom nav so it
// sits squarely in the one-handed thumb zone — where the create CTA used to
// live (inside the top hero) was the least reachable spot on the screen.
//
// Pass `to` for navigation (e.g. "New trip" → a form route) or `onClick` for
// an in-page action (e.g. opening the add-itinerary sheet).
type FabProps = {
  label: string;
  icon?: LucideIcon;
} & ({ to: string; onClick?: never } | { onClick: () => void; to?: never });

export function Fab({ label, icon: Icon = Plus, ...action }: FabProps) {
  return (
    <div className={WRAPPER}>
      {"to" in action && action.to ? (
        <Link to={action.to} className={PILL}>
          <Icon className="size-5" />
          {label}
        </Link>
      ) : (
        <button type="button" onClick={action.onClick} className={PILL}>
          <Icon className="size-5" />
          {label}
        </button>
      )}
    </div>
  );
}
