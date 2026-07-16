import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Plus } from "lucide-react";

// Floating action button for a page's primary create action. Anchored bottom-
// right within the content column and lifted clear of the bottom nav so it
// sits squarely in the one-handed thumb zone — where the create CTA used to
// live (inside the top hero) was the least reachable spot on the screen.
export function Fab({ to, label, icon: Icon = Plus }: { to: string; label: string; icon?: LucideIcon }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-sticky)] mx-auto flex max-w-md justify-end px-4 pb-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)]">
      <Link
        to={to}
        className="pointer-events-auto inline-flex h-14 items-center gap-2 rounded-full bg-primary pr-6 pl-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 outline-none transition-transform active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Icon className="size-5" />
        {label}
      </Link>
    </div>
  );
}
