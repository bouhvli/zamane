import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";

import { cn } from "@/components/ui/utils";
import { buttonVariants } from "@/components/ui/button";

// A welcoming empty state — icon, a line of guidance, and an optional primary
// action — instead of a bare dashed "nothing here" box. Mirrors the teaching
// CTA card the Home page already uses so first-run screens feel consistent.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { to: string; label: string };
}) {
  return (
    // Level 2 glass with a dashed edge: the dashes say "nothing here yet" while
    // the material says "this is still part of the app" — the old solid card on
    // a solid page read as a placeholder someone forgot to remove.
    <div className="glass-2 flex flex-col items-center gap-3 border-dashed border-violet-200 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-violet-100 text-primary">
        <Icon className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && (
        <Link to={action.to} className={cn(buttonVariants({ variant: "default" }), "mt-1")}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
