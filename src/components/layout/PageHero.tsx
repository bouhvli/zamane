import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";

import { cn } from "@/components/ui/utils";

export type PageHeroStat = { label: string; value: string };
export type PageHeroAction = { label: string; to?: string; onClick?: () => void; variant?: "primary" | "ghost" };
export type PageHeroStatus = { text: string; tone?: "primary" | "accent" | "neutral" };

export type PageHeroProps = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  status?: PageHeroStatus;
  stats?: PageHeroStat[];
  actions?: PageHeroAction[];
  /** ?url doodle icon — only used by the minimal placeholder-page variant (icon, no stats/actions). */
  icon?: string;
  className?: string;
};

export function PageHero({ label, value, description, status, stats, actions, icon, className }: PageHeroProps) {
  const isMinimal = Boolean(icon) && !stats?.length && !actions?.length;

  return (
    <div className={cn("mx-auto max-w-md px-4 pt-4 pb-5", className)}>
      <div className="page-hero relative overflow-hidden rounded-lg">
        <div className="page-hero-glow-tr pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full" />
        <div className="page-hero-glow-bl pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full" />
        <div className="page-hero-dots pointer-events-none absolute inset-0" />

        <div className="relative px-5 pt-5 pb-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="page-hero-label text-xs font-semibold uppercase tracking-wider">{label}</p>
            {status && (
              <div
                className={cn(
                  "page-hero-pill flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                  `page-hero-pill-${status.tone ?? "neutral"}`,
                )}
              >
                <span className="size-1.5 animate-pulse rounded-full bg-current" />
                {status.text}
              </div>
            )}
          </div>

          {isMinimal ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <span
                role="img"
                aria-label={label}
                className="page-hero-icon"
                style={{ "--icon-mask": `url(${icon})` } as CSSProperties}
              />
              <h1 className="page-hero-value font-heading text-2xl font-semibold">{value}</h1>
              {description && <p className="page-hero-description text-sm">{description}</p>}
            </div>
          ) : (
            <>
              <h1 className="page-hero-value mb-1.5 text-balance font-heading text-[2rem] font-semibold leading-tight tracking-tight sm:text-[2.5rem]">
                {value}
              </h1>
              {description && <p className="page-hero-description mb-5 text-sm">{description}</p>}

              {stats && stats.length > 0 && (
                <div
                  className="mb-4 grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
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

              {actions && actions.length > 0 && (
                <div className="flex gap-2.5">
                  {actions.map((action) =>
                    action.to ? (
                      <Link
                        key={action.label}
                        to={action.to}
                        className={cn(
                          "page-hero-action flex-1 rounded-lg py-3 text-center text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-white/50",
                          `page-hero-action-${action.variant ?? "primary"}`,
                        )}
                      >
                        {action.label}
                      </Link>
                    ) : (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        className={cn(
                          "page-hero-action flex-1 rounded-lg py-3 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-white/50",
                          `page-hero-action-${action.variant ?? "primary"}`,
                        )}
                      >
                        {action.label}
                      </button>
                    ),
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
