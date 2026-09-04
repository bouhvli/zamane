import { useEffect, useRef } from "react";

import type { TripDay } from "./trip-plan";
import { cn } from "@/components/ui/utils";

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const MONTH = new Intl.DateTimeFormat(undefined, { month: "short" });

/**
 * The day strip under the hero.
 *
 * It does two jobs at once, which is what earns it the space a decorative
 * countdown wouldn't: it's a read of where the trip is (today filled, days
 * behind you quiet, days ahead outlined) and it's the navigation — tapping a
 * day scrolls its section into view. A 12-day trip is otherwise a very long
 * scroll with no way to get to Thursday.
 *
 * `selected` follows the section actually on screen, so the strip and the
 * timeline never disagree about which day you're looking at.
 */
export function TripDayRail({
  days,
  selectedKey,
  onSelect,
}: {
  days: TripDay[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Bring the current day into view on arrival, and keep it there as the
  // selection follows the scroll. `nearest`/`center` rather than a full
  // scrollIntoView so the page itself never jumps under the user.
  useEffect(() => {
    const el = activeRef.current;
    const rail = railRef.current;
    if (!el || !rail) return;
    const target = el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2;
    rail.scrollTo({
      left: Math.max(0, target),
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [selectedKey]);

  if (days.length === 0) return null;

  return (
    <div
      ref={railRef}
      className="day-rail"
      role="tablist"
      aria-label="Days of this trip"
      aria-orientation="horizontal"
    >
      {days.map((day) => {
        const selected = day.key === selectedKey;
        const count = day.items.length;
        const allDone = count > 0 && day.items.every((p) => p.item.isDone);

        return (
          <button
            key={day.key}
            ref={selected ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(day.key)}
            aria-label={`${day.dayNumber ? `Day ${day.dayNumber}, ` : ""}${WEEKDAY.format(day.date)} ${day.date.getDate()} ${MONTH.format(day.date)}${
              count === 0 ? ", nothing planned" : `, ${count} ${count === 1 ? "stop" : "stops"}`
            }`}
            className={cn(
              "day-chip",
              selected
                ? "bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_rgb(var(--glass-cast)/0.7)]"
                : day.isToday
                  ? "border-primary/40 bg-card text-foreground"
                  : day.isPast
                    ? "text-muted-foreground/70 hover:bg-card/70"
                    : "text-muted-foreground hover:bg-card/70",
            )}
          >
            <span
              className={cn(
                "text-[0.625rem] font-semibold uppercase leading-none tracking-wide",
                selected ? "text-primary-foreground/75" : "text-muted-foreground",
              )}
            >
              {/* Today is worth naming outright — "TODAY" is read faster than
                  a weekday you then have to compare against your own. */}
              {day.isToday ? "Today" : WEEKDAY.format(day.date)}
            </span>

            <span className="font-numeric mt-0.5 text-lg font-bold leading-none">{day.date.getDate()}</span>

            {/* The state line: how much is planned, or a tick once the day is
                fully done. Fixed height so chips never change size between
                states and the strip can't reflow as you tick things off. */}
            <span className="mt-1 flex h-1.5 items-center justify-center gap-[3px]">
              {allDone ? (
                <span
                  className={cn(
                    "h-1.5 w-4 rounded-full",
                    selected ? "bg-primary-foreground/80" : "bg-success",
                  )}
                />
              ) : count > 0 ? (
                Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-1.5 rounded-full",
                      selected ? "bg-primary-foreground/70" : day.isPast ? "bg-muted-foreground/35" : "bg-primary/45",
                    )}
                  />
                ))
              ) : (
                <span className={cn("h-px w-3 rounded-full", selected ? "bg-primary-foreground/40" : "bg-border")} />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
