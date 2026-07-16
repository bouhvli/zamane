import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/components/ui/utils";

export type PageHeaderStat = { label: string; value: string };
export type PageHeaderStatus = { text: string; tone?: "primary" | "accent" | "neutral" };

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Top-left back affordance for detail/form pages (top-level tabs omit it). */
  back?: { to: string; label?: string };
  status?: PageHeaderStatus;
  /** Rendered as a restrained plain-text row — no glass chips, no dark slab. */
  stats?: PageHeaderStat[];
  /** Top-right slot for page-level actions (e.g. an overflow menu). */
  actions?: ReactNode;
  className?: string;
};

// The compact, light page header. Replaces the full dark PageHero on every
// screen except Home, where the hero stays as the brand's one crown moment.
// Deliberately quiet: it names the page and gets out of the way so the task —
// not the chrome — owns the first viewport.
export function PageHeader({ title, description, back, status, stats, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("mx-auto max-w-md px-4 pt-5 pb-2", className)}>
      {back && (
        <Link
          to={back.to}
          className="-ml-1 mb-1 inline-flex min-h-11 items-center gap-1 rounded-md pr-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-4" />
          {back.label ?? "Back"}
        </Link>
      )}

      <div className="flex items-start justify-between gap-3">
        <h1 className="min-w-0 text-balance font-sans text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {(status || actions) && (
          <div className="flex shrink-0 items-center gap-1.5">
            {status && <HeaderStatus status={status} />}
            {actions}
          </div>
        )}
      </div>

      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}

      {stats && stats.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {stats.map((stat) => (
            <span key={stat.label} className="text-muted-foreground">
              <span className="font-semibold text-foreground">{stat.value}</span> {stat.label}
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

function HeaderStatus({ status }: { status: PageHeaderStatus }) {
  const tone = status.tone ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "primary" && "bg-primary/10 text-primary",
        // --accent-strong is the AA-safe rose for small text on light surfaces.
        tone === "accent" && "bg-accent/10 text-accent-strong",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      {/* Steady dot for a settled/terminal state; the pulse is reserved for
          "live / in progress" (accent), matching the hero pill's behavior. */}
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          tone === "accent" && "animate-pulse motion-reduce:animate-none",
        )}
      />
      {status.text}
    </span>
  );
}
