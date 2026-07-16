import type { ReactNode } from "react";

import { cn } from "@/components/ui/utils";

export type PageHeroStat = { label: string; value: string };

export type PageHeroProps = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  stats?: PageHeroStat[];
  className?: string;
};

// The dark, glowing "hero card" — deliberately the app's ONE loud, drenched
// brand surface, used only on Home. Every other page uses the quiet
// PageHeader. (The earlier icon / status-pill / actions variants were removed
// once Home became the sole consumer — see git history if they're needed
// again.)
export function PageHero({ label, value, description, stats, className }: PageHeroProps) {
  return (
    <div className={cn("mx-auto max-w-md px-4 pt-4 pb-5", className)}>
      <div className="page-hero relative overflow-hidden rounded-lg">
        <div className="page-hero-glow-tr pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full" />
        <div className="page-hero-glow-bl pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full" />
        <div className="page-hero-dots pointer-events-none absolute inset-0" />

        <div className="relative px-5 pt-5 pb-5">
          <p className="page-hero-label mb-4 text-xs font-semibold uppercase tracking-wider">{label}</p>

          <h1 className="page-hero-value mb-2 text-balance font-display text-[2rem] font-semibold leading-snug tracking-tight sm:text-[2.5rem]">
            {value}
          </h1>
          {description && <p className="page-hero-description mb-5 text-sm">{description}</p>}

          {stats && stats.length > 0 && (
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
              aria-live="polite"
              aria-atomic="true"
            >
              {stats.map((stat) => (
                <div key={stat.label} className="page-hero-chip rounded-lg px-3 py-2.5">
                  <p className="page-hero-chip-label mb-1 text-xs font-semibold uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="truncate font-mono text-sm font-bold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
