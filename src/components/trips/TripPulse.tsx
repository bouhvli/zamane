import { ArrowRight, CalendarClock, Check } from "lucide-react";

import { ProgressTrack } from "@/components/ProgressOrbit";
import { cn } from "@/components/ui/utils";
import { categoryIcon } from "./trip-categories";
import { formatClock, toDayKey } from "./trip-plan";
import type { TripPlan } from "./trip-plan";

const DAY_SHORT = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });

/**
 * The one-line answer to "where are we", directly under the hero.
 *
 * Deliberately a status line rather than a stat block: a big number with a
 * caption tells you a fact you then have to act on somewhere else. This tells
 * you the fact AND takes you to the thing — the "next up" row is a control
 * that scrolls the timeline to that stop.
 *
 * Every branch below is a real state the page has to survive: a trip with no
 * dates at all, one still weeks away, one underway, and one already over.
 */
export function TripPulse({ plan, onJump }: { plan: TripPlan; onJump: (dayKey: string) => void }) {
  const highlight = plan.currentItem ?? plan.nextItem;

  if (plan.phase === "unscheduled") {
    return (
      <div className="glass-2 flex items-center gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-primary">
          <CalendarClock className="size-[1.125rem]" />
        </span>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">No dates yet.</span> Add them to the trip and the plan
          builds itself a day at a time.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-2 overflow-hidden">
      <div className="p-4 pb-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-numeric text-sm font-bold text-foreground">
            {plan.phase === "live"
              ? `Day ${plan.currentDayNumber} of ${plan.totalDays}`
              : plan.phase === "upcoming"
                ? plan.daysUntilStart === 0
                  ? "Starts today"
                  : plan.daysUntilStart === 1
                    ? "Leaving tomorrow"
                    : `${plan.daysUntilStart} days to go`
                : `${plan.totalDays} ${plan.totalDays === 1 ? "day" : "days"}, wrapped`}
          </p>

          {plan.totalScheduled > 0 && (
            <p className="font-numeric text-xs text-muted-foreground">
              {plan.doneCount}/{plan.totalScheduled} done
            </p>
          )}
        </div>

        <ProgressTrack
          percent={plan.progress * 100}
          label="Trip progress"
          className="mt-2.5"
        />
      </div>

      {highlight && (
        <button
          type="button"
          onClick={() => highlight.start && onJump(toDayKey(highlight.start))}
          className="group flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left outline-none transition-colors hover:bg-card/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <HighlightIcon planned={highlight} />

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "text-[0.625rem] font-bold uppercase tracking-wide",
                  plan.currentItem ? "text-success" : "text-primary",
                )}
              >
                {plan.currentItem ? "Happening now" : "Next up"}
              </span>
              {!plan.currentItem && highlight.start && (
                <span className="font-numeric text-[0.6875rem] text-muted-foreground">
                  {formatClock(highlight.item.itemTime) ?? DAY_SHORT.format(highlight.start)}
                  {/* Only name the day when it isn't today — "today 19:30" is
                      noise while you're standing in the middle of it. */}
                  {!isSameDay(highlight.start, new Date()) && ` · ${DAY_SHORT.format(highlight.start)}`}
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
              {highlight.item.title}
            </span>
          </span>

          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--dur-2)] ease-[var(--ease-glide)] group-hover:translate-x-0.5" />
        </button>
      )}

      {!highlight && plan.phase === "past" && plan.totalScheduled > 0 && (
        <p className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
          {plan.doneCount === plan.totalScheduled
            ? "Every stop ticked off."
            : `${plan.totalScheduled} stops planned, ${plan.doneCount} ticked off.`}
        </p>
      )}
    </div>
  );
}

function HighlightIcon({ planned }: { planned: NonNullable<TripPlan["nextItem"]> }) {
  const Icon = categoryIcon(planned.item.category);
  const live = planned.phase === "now";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full",
        live ? "bg-success text-white" : "bg-violet-100 text-primary",
      )}
    >
      <Icon className="size-[1.125rem]" />
    </span>
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return toDayKey(a) === toDayKey(b);
}
