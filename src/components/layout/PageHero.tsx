import { Link } from "react-router";
import { ChevronRight } from "lucide-react";

import { CURRENCY, initials } from "@/lib/format";
import { useCountUp } from "@/lib/use-count-up";
import { cn } from "@/components/ui/utils";
import { ProgressTrack } from "@/components/ProgressOrbit";

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

const groupedNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

// The Home instrument panel. Level 3 glass over the ambient field — the same
// material as the nav pill and the FAB, at the depth reserved for floating
// chrome. It replaced the app's one drenched dark surface; see page-hero.css
// for why that mattered.
//
// Metric-first by design: the couple's shared savings figure is the single
// loudest element on the screen (hierarchy = emphasize by de-emphasizing,
// Refactoring UI), set in the display face and carrying the app's only
// gradient. Leading with a cumulative, growing number is the emotional peak
// the whole product is built around (Peak-End / Goal-Gradient / Zeigarnik) —
// which only works if the number is genuinely cumulative; see HeroMetric.saved.
export function PageHero({ greeting, subline, members, metric, href, className }: PageHeroProps) {
  const pct =
    metric && metric.target > 0
      ? Math.min(100, Math.round((metric.towardTarget / metric.target) * 100))
      : null;

  // The figure counts up on arrival — the one "confirming" use of motion in
  // the app. It runs once per mount, not on every revalidation, so a partner's
  // contribution landing in the background doesn't restart it.
  const shown = useCountUp(metric?.saved ?? 0);

  const card = (
    <div className="glass-3 relative h-full overflow-hidden p-5">
      <div className="relative">
        {/* Identity row. In metric mode the greeting is a quiet supporting line
            (the number is the headline) but stays the page's `h1` — semantics
            track meaning, not font size. The avatar pair anchors "this is
            ours, not mine". */}
        <div className="mb-5 flex items-start justify-between gap-3">
          {metric ? (
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-foreground">{greeting}</h1>
              <p className="truncate text-xs text-muted-foreground">{subline}</p>
            </div>
          ) : (
            <span aria-hidden="true" />
          )}
          {members.length > 0 && (
            <div className="flex shrink-0 -space-x-2.5" aria-hidden="true">
              {members.slice(0, 2).map((member, index) => (
                <span
                  key={member.id}
                  className={cn(
                    // One circle per person, in the logo's two hues — the mark
                    // itself, standing in for the couple.
                    "flex size-9 items-center justify-center rounded-full border-2 border-card font-numeric text-xs font-bold text-white",
                    index === 0 ? "bg-violet-500" : "bg-rose-500",
                  )}
                >
                  {initials(member.name)}
                </span>
              ))}
            </div>
          )}
        </div>

        {metric ? (
          <div>
            <p className="mb-1.5 text-2xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Saved together
            </p>
            <p className="page-hero-figure font-display text-hero font-bold">
              <span className="page-hero-currency">{CURRENCY}</span>
              {groupedNumber.format(shown)}
            </p>

            {pct !== null && (
              <ProgressTrack
                percent={pct}
                label="Goals in progress"
                className="mt-4 h-1.5"
              />
            )}

            <p className="mt-2.5 flex items-center gap-1 text-sm text-muted-foreground">
              <span className="min-w-0 truncate">
                <MetricCaption metric={metric} pct={pct} />
              </span>
              {href && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
            </p>

            {metric.savedThisMonth > 0 && (
              <span className="mt-3 inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 font-numeric text-xs font-bold text-violet-700">
                +{CURRENCY} {groupedNumber.format(metric.savedThisMonth)} this month
              </span>
            )}
          </div>
        ) : (
          <div>
            <h1 className="font-display text-3xl text-balance text-foreground">{greeting}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subline}</p>
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
        className="block rounded-lg outline-none transition-transform duration-[var(--dur-2)] ease-[var(--ease-glide)] active:scale-[0.99] focus-visible:ring-[3px] focus-visible:ring-ring/60 motion-reduce:active:scale-100"
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
        <span className="font-numeric font-bold text-foreground">{pct}%</span> of{" "}
        <span className="font-numeric">
          {CURRENCY} {groupedNumber.format(metric.target)}
        </span>{" "}
        · {metric.openCount} in progress
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
