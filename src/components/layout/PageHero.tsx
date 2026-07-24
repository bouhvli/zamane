import { formatAmount } from "@/lib/format";
import { cn } from "@/components/ui/utils";

export type HeroMember = { id: string; name: string };

export type HeroMetric = {
  /** Combined amount saved across active financial goals. */
  saved: number;
  /** Combined target across active financial goals (0 = no target set). */
  target: number;
  /** How many active financial goals the money is spread across. */
  goalCount: number;
  /** Net saved this month, for the momentum pill (0 = hide it). */
  savedThisMonth: number;
};

export type PageHeroProps = {
  /** Warm greeting, e.g. "Hi, Hamza". */
  greeting: string;
  /** Sub-line for the empty (greeting) mode, e.g. the date or "You and Sam". */
  subline: string;
  /** The couple, for the overlapping avatar pair. */
  members: HeroMember[];
  /**
   * When present, the hero leads with the shared savings figure (the app's
   * headline metric). When absent — a brand-new couple with no financial data
   * yet — it falls back to the warm greeting as the headline so a hollow "$0"
   * never greets a first-time user. (Refactoring UI: design the empty state
   * first.)
   */
  metric?: HeroMetric;
  className?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

// The dark, glowing "hero card" — deliberately the app's ONE loud, drenched
// brand surface, used only on Home. Every other page uses the quiet
// PageHeader.
//
// Metric-first by design: the couple's shared savings figure is the single
// loudest element on the screen (hierarchy = emphasize by de-emphasizing,
// Refactoring UI), rendered in the display serif as the one sanctioned
// per-page "signature" moment (see the .font-display rationale in theme.css).
// Leading with a cumulative, growing number is the emotional peak the whole
// product is built around (Peak-End / Goal-Gradient / Zeigarnik, Laws of UX).
export function PageHero({ greeting, subline, members, metric, className }: PageHeroProps) {
  const pct =
    metric && metric.target > 0 ? Math.min(100, Math.round((metric.saved / metric.target) * 100)) : null;

  return (
    <div className={cn("mx-auto max-w-md px-4 pt-4 pb-5", className)}>
      <div className="page-hero relative overflow-hidden rounded-lg">
        <div className="page-hero-glow-tr pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full" />
        <div className="page-hero-glow-bl pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full" />
        <div className="page-hero-dots pointer-events-none absolute inset-0" />

        <div className="relative px-5 pt-5 pb-6">
          {/* Identity row. In metric mode the greeting is a quiet supporting
              line (the number is the headline); the avatar pair anchors "this
              is ours, not mine". */}
          <div className="mb-5 flex items-start justify-between gap-3">
            {metric ? (
              <p className="min-w-0 truncate text-sm font-medium text-white/70">{greeting}</p>
            ) : (
              <span aria-hidden="true" />
            )}
            {members.length > 0 && (
              <div className="flex shrink-0 -space-x-2" aria-hidden="true">
                {members.slice(0, 2).map((member) => (
                  <span
                    key={member.id}
                    className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-semibold text-white"
                  >
                    {initials(member.name)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {metric ? (
            <div aria-live="polite" aria-atomic="true">
              <p className="page-hero-label mb-1.5 text-xs font-semibold uppercase tracking-wider">
                Saved together
              </p>
              <p className="page-hero-value font-display text-[2.75rem] font-semibold leading-none tracking-tight [font-variant-numeric:tabular-nums]">
                {formatAmount(metric.saved)}
              </p>

              {pct !== null ? (
                <>
                  <div
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Combined savings progress"
                    className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15"
                  >
                    <div
                      // Mid-sage → lime, not --primary → --accent: the deep
                      // forest --primary would vanish against the dark hero, so
                      // the fill starts at a lighter green that reads here.
                      className="h-full rounded-full bg-[linear-gradient(90deg,#5F9E6B,var(--accent))] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="page-hero-description mt-2 text-sm">
                    <span className="font-semibold text-white">{pct}%</span> of {formatAmount(metric.target)} ·{" "}
                    {metric.goalCount} active {metric.goalCount === 1 ? "goal" : "goals"}
                  </p>
                </>
              ) : (
                <p className="page-hero-description mt-3 text-sm">
                  across {metric.goalCount} active {metric.goalCount === 1 ? "goal" : "goals"}
                </p>
              )}

              {metric.savedThisMonth > 0 && (
                <span className="mt-3 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white">
                  +{formatAmount(metric.savedThisMonth)} this month
                </span>
              )}
            </div>
          ) : (
            <div>
              <h1 className="page-hero-value text-balance font-display text-[2rem] font-semibold leading-snug tracking-tight sm:text-[2.5rem]">
                {greeting}
              </h1>
              <p className="page-hero-description mt-2 text-sm">{subline}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
