import { Link } from "react-router";
import { ChevronRight } from "lucide-react";

import { formatAmount } from "@/lib/format";
import { cn } from "@/components/ui/utils";

export type HeroMember = { id: string; name: string };

export type HeroMetric = {
  /**
   * Lifetime pooled across EVERY financial goal — reached ones included. This
   * figure must only ever grow: it previously counted active goals only, so
   * reaching a goal (the moment the whole product exists for) made the
   * headline number drop by that goal's full amount. `towardTarget` below
   * carries the "how close are we" job instead, which is what actually wants
   * completed goals excluded.
   */
  saved: number;
  /** Combined target across goals still in progress (0 = nothing to track). */
  target: number;
  /** How much of `saved` sits in goals still in progress — the bar's numerator. */
  towardTarget: number;
  /** Financial goals still in progress. */
  openCount: number;
  /** Financial goals already reached. */
  reachedCount: number;
  /**
   * Net saved this month. Spans every goal (the API counts all contributions),
   * which is why the headline above it is now lifetime too — the two figures
   * were computed over different sets and could contradict each other in the
   * same breath ("MAD 0" above "+MAD 5,000 this month").
   */
  savedThisMonth: number;
};

export type PageHeroProps = {
  /** Warm greeting, e.g. "Hi, Hamza". Always the page's single `h1`. */
  greeting: string;
  /** Quiet supporting line — "You and Sam", or today's date when solo. */
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
  /** Where the headline figure leads. Without it the card isn't interactive. */
  href?: string;
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
// product is built around (Peak-End / Goal-Gradient / Zeigarnik, Laws of UX) —
// which only works if the number is genuinely cumulative; see HeroMetric.saved.
export function PageHero({ greeting, subline, members, metric, href, className }: PageHeroProps) {
  const pct =
    metric && metric.target > 0
      ? Math.min(100, Math.round((metric.towardTarget / metric.target) * 100))
      : null;

  const card = (
    <div className="page-hero relative h-full overflow-hidden rounded-lg">
      <div className="page-hero-glow-tr pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full" />
      <div className="page-hero-glow-bl pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full" />
      <div className="page-hero-dots pointer-events-none absolute inset-0" />

      <div className="relative px-5 pt-5 pb-6">
        {/* Identity row. In metric mode the greeting is a quiet supporting
            line (the number is the headline) but stays the page's `h1` —
            semantics track meaning, not font size, and in metric mode this
            screen previously had no heading at all. The avatar pair anchors
            "this is ours, not mine". */}
        <div className="mb-5 flex items-start justify-between gap-3">
          {metric ? (
            <div className="min-w-0">
              <h1 className="truncate text-sm font-medium text-white/70">{greeting}</h1>
              <p className="truncate text-xs text-white/50">{subline}</p>
            </div>
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
          <div>
            <p className="page-hero-label mb-1.5 text-xs font-semibold uppercase tracking-wider">
              Saved together
            </p>
            <p className="page-hero-value font-display text-[2.75rem] font-semibold leading-none tracking-tight [font-variant-numeric:tabular-nums]">
              {formatAmount(metric.saved)}
            </p>

            {pct !== null && (
              <div
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress toward goals in progress"
                className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15"
              >
                <div
                  // The lighter dark-mode violet (#7B52FF) → --accent, not
                  // --primary → --accent: the deep light-mode --primary
                  // would sink into the dark hero, so the fill starts at
                  // the brighter violet that actually reads here.
                  className="h-full rounded-full bg-[linear-gradient(90deg,#7B52FF,var(--accent))] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            <p className="page-hero-description mt-2.5 flex items-center gap-1 text-sm">
              <span className="min-w-0 truncate">
                <MetricCaption metric={metric} pct={pct} />
              </span>
              {href && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-white/45" />}
            </p>

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
  );

  if (!href) {
    return <div className={cn("mx-auto max-w-md px-4 pt-4 pb-5", className)}>{card}</div>;
  }

  return (
    <div className={cn("mx-auto max-w-md px-4 pt-4 pb-5", className)}>
      {/* An explicit aria-label keeps the link's accessible name short — without
          it the name concatenates the greeting, the label, the figure and the
          caption into one run. The chevron in the caption is the visible
          signifier that the figure leads somewhere (Norman). */}
      <Link
        to={href}
        aria-label="View your goals"
        className="block rounded-lg outline-none transition-transform duration-200 active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring/60 motion-reduce:active:scale-100"
      >
        {card}
      </Link>
    </div>
  );
}

// The caption under the bar. It deliberately never says "active goals": the
// hero counts active *financial* goals while the Goals page's "N active"
// counts every unfinished goal, so the same word carried two different numbers
// one tap apart. "In progress" is scoped to what this figure actually measures.
function MetricCaption({ metric, pct }: { metric: HeroMetric; pct: number | null }) {
  const goalWord = (n: number) => (n === 1 ? "goal" : "goals");

  if (pct !== null) {
    return (
      <>
        <span className="font-semibold text-white">{pct}%</span> of {formatAmount(metric.target)} ·{" "}
        {metric.openCount} in progress
      </>
    );
  }

  // Nothing left in progress, but money has been pooled — the couple has
  // finished everything they set out to do. Say so instead of "across 0 goals".
  if (metric.openCount === 0 && metric.reachedCount > 0) {
    return (
      <>
        {metric.reachedCount} {goalWord(metric.reachedCount)} reached · nothing in progress
      </>
    );
  }

  return (
    <>
      across {metric.openCount} {goalWord(metric.openCount)} in progress
    </>
  );
}
