import { useEffect, useState } from "react";

import type { ChecklistItem, ItineraryItem, Trip, TripPlace } from "@/lib/trips-api";
import { parseDay } from "@/lib/format";

/**
 * The planning model behind the trip organizer.
 *
 * Everything here is a pure function of (trip, items, now) — no component
 * state, no dates read from the clock inside a render. `now` is passed in from
 * `useNow` so the whole page recomputes on one tick and every "happening now"
 * on screen agrees with every other. A component calling `new Date()` for
 * itself is how a timeline ends up with two different ideas of the present.
 */

const DAY_MS = 86_400_000;

/** Local midnight of a Date — the granularity every day-level comparison uses. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "YYYY-MM-DD" for a Date, in LOCAL time. `toISOString()` would shift the day
 *  for anyone east or west of UTC, which is exactly the bug parseDay exists to
 *  avoid on the way in. */
export function toDayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Postgres returns a `time` column as "09:00:00". Render it in the viewer's
 * own clock convention (12h or 24h) rather than printing the raw column, which
 * is what the old itinerary list did — seconds and all.
 */
export function formatClock(time: string | null): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
}

/** A stop's start as a real instant. An item with a date but no time is
 *  treated as starting at midnight so it sorts to the head of its day. */
export function itemStart(item: ItineraryItem): Date | null {
  if (!item.itemDate) return null;
  const day = parseDay(item.itemDate);
  if (!item.itemTime) return day;
  const [h, m] = item.itemTime.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0);
}

/** A stop's end. Without an end time a stop is an instant, not a span — so
 *  "happening now" is only ever true for something that actually declared how
 *  long it lasts, rather than guessed from the next item's start. */
export function itemEnd(item: ItineraryItem): Date | null {
  const start = itemStart(item);
  if (!start || !item.endTime) return start;
  const [h, m] = item.endTime.split(":").map(Number);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), h || 0, m || 0);
  // An end before the start means the stop runs past midnight (a red-eye, a
  // late dinner) — roll it to the next day rather than rendering a negative span.
  return end < start ? new Date(end.getTime() + DAY_MS) : end;
}

/** Where a stop sits relative to right now. `next` is assigned by the caller
 *  (only one stop in the whole trip can be next), never derived per item. */
export type ItemPhase = "done" | "past" | "now" | "next" | "ahead" | "undated";

export type PlannedItem = {
  item: ItineraryItem;
  phase: ItemPhase;
  start: Date | null;
  end: Date | null;
};

export type TripDay = {
  /** "YYYY-MM-DD" — also the anchor id the day rail scrolls to. */
  key: string;
  date: Date;
  /** 1-based position in the trip. Null for a dated stop that falls outside
   *  the trip's own start/end (someone dated something before departure). */
  dayNumber: number | null;
  isToday: boolean;
  isPast: boolean;
  items: PlannedItem[];
};

export type TripPlan = {
  days: TripDay[];
  /** Stops with no date yet — real plan content, kept out of the day spine so
   *  it can't pretend to a position in time it doesn't have. */
  unscheduled: PlannedItem[];
  /** Total days in the trip's own span, or null when it has no dates. */
  totalDays: number | null;
  /** 1-based day the trip is on right now; null before it starts or after it ends. */
  currentDayNumber: number | null;
  /** 0-1 through the trip's span. Drives the fill on the day rail and the spine. */
  progress: number;
  phase: "unscheduled" | "upcoming" | "live" | "past";
  /** Whole days until departure. Null unless the trip is still ahead. */
  daysUntilStart: number | null;
  /** The stop to do next — the single most actionable fact on the page. */
  nextItem: PlannedItem | null;
  /** The stop underway right now, if any declared a span covering it. */
  currentItem: PlannedItem | null;
  doneCount: number;
  totalScheduled: number;
};

/**
 * Builds the day-by-day plan.
 *
 * Days come from the trip's own start/end span, unioned with any dated stop
 * that falls outside it — a flight booked the night before departure is still
 * part of the plan, and dropping it because it sits one day before `startDate`
 * would silently hide real content.
 */
export function buildTripPlan(trip: Trip, items: ItineraryItem[], now: Date): TripPlan {
  const today = startOfDay(now);

  const planned: PlannedItem[] = items.map((item) => ({
    item,
    phase: "ahead",
    start: itemStart(item),
    end: itemEnd(item),
  }));

  const byDay = new Map<string, PlannedItem[]>();
  const unscheduled: PlannedItem[] = [];
  for (const p of planned) {
    if (!p.start) {
      p.phase = "undated";
      unscheduled.push(p);
      continue;
    }
    const key = toDayKey(p.start);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(p);
    else byDay.set(key, [p]);
  }

  const tripStart = trip.startDate ? parseDay(trip.startDate) : null;
  const tripEnd = trip.endDate ? parseDay(trip.endDate) : tripStart;

  // The set of day keys to render: the trip's span (so empty days still show
  // as empty days you can plan into) plus any outlier a stop landed on.
  const keys = new Set<string>(byDay.keys());
  if (tripStart && tripEnd) {
    for (let d = new Date(tripStart); d <= tripEnd; d = new Date(d.getTime() + DAY_MS)) {
      keys.add(toDayKey(d));
    }
  }

  const days: TripDay[] = [...keys]
    .sort()
    .map((key) => {
      const date = parseDay(key);
      const dayNumber =
        tripStart && date >= tripStart
          ? Math.round((startOfDay(date).getTime() - startOfDay(tripStart).getTime()) / DAY_MS) + 1
          : null;
      const dayItems = (byDay.get(key) ?? []).sort(byStartThenCreated);
      return {
        key,
        date,
        // Only number days inside the trip's own span; a stop dated a week
        // after the return flight isn't "Day 14".
        dayNumber: dayNumber !== null && tripEnd && date <= tripEnd ? dayNumber : null,
        isToday: key === toDayKey(today),
        isPast: startOfDay(date) < today,
        items: dayItems,
      };
    });

  // Phase assignment. Done is user-declared and outranks the clock: a stop the
  // couple ticked off reads as done even if its window hasn't closed yet.
  for (const p of planned) {
    if (p.phase === "undated") continue;
    if (p.item.isDone) {
      p.phase = "done";
      continue;
    }
    if (p.start && p.end && p.start <= now && now <= p.end && p.end > p.start) {
      p.phase = "now";
      continue;
    }
    p.phase = p.end && p.end < now ? "past" : "ahead";
  }

  const currentItem = planned.find((p) => p.phase === "now") ?? null;
  // The next stop is the earliest one still ahead of us anywhere in the trip —
  // found across days, not within one, so it stays correct when today is
  // already finished and the next thing is tomorrow morning.
  const nextItem =
    planned
      .filter((p) => p.phase === "ahead" && p.start && p.start >= now)
      .sort((a, b) => (a.start as Date).getTime() - (b.start as Date).getTime())[0] ?? null;
  if (nextItem) nextItem.phase = "next";

  const totalDays =
    tripStart && tripEnd ? Math.round((tripEnd.getTime() - tripStart.getTime()) / DAY_MS) + 1 : null;

  let phase: TripPlan["phase"] = "unscheduled";
  let currentDayNumber: number | null = null;
  let daysUntilStart: number | null = null;
  let progress = 0;

  if (tripStart && tripEnd) {
    if (today < tripStart) {
      phase = "upcoming";
      daysUntilStart = Math.round((tripStart.getTime() - today.getTime()) / DAY_MS);
    } else if (today > tripEnd) {
      phase = "past";
      progress = 1;
    } else {
      phase = "live";
      currentDayNumber = Math.round((today.getTime() - tripStart.getTime()) / DAY_MS) + 1;
      // Fractional so the spine fills through the day, not in daily jumps —
      // the difference between a progress bar and a clock.
      const spanMs = tripEnd.getTime() + DAY_MS - tripStart.getTime();
      progress = clamp01((now.getTime() - tripStart.getTime()) / spanMs);
    }
  }

  const scheduled = planned.filter((p) => p.phase !== "undated");

  return {
    days,
    unscheduled: unscheduled.sort(byCreated),
    totalDays,
    currentDayNumber,
    progress,
    phase,
    daysUntilStart,
    nextItem,
    currentItem,
    // Counted over the same set as the denominator. Counting done across ALL
    // items while dividing by the scheduled ones could print "8/7 done".
    doneCount: scheduled.filter((p) => p.item.isDone).length,
    totalScheduled: scheduled.length,
  };
}

function byStartThenCreated(a: PlannedItem, b: PlannedItem): number {
  const at = a.start?.getTime() ?? 0;
  const bt = b.start?.getTime() ?? 0;
  if (at !== bt) return at - bt;
  return a.item.createdAt.localeCompare(b.item.createdAt);
}

function byCreated(a: PlannedItem, b: PlannedItem): number {
  return a.item.createdAt.localeCompare(b.item.createdAt);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * How far down today's column the "now" line sits, as a 0-1 fraction of the
 * day. Used to place the marker between the stop that just ended and the one
 * coming up, so the timeline literally shows where you are.
 */
export function dayFraction(now: Date): number {
  const start = startOfDay(now).getTime();
  return clamp01((now.getTime() - start) / DAY_MS);
}

/** Index in `day.items` the now-line should be inserted before. `-1` means the
 *  line belongs after every stop (the day's plan is finished). */
export function nowMarkerIndex(day: TripDay, now: Date): number {
  if (!day.isToday) return -2; // no marker on any day but today
  const idx = day.items.findIndex((p) => p.start && p.start > now);
  return idx === -1 ? -1 : idx;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export type BudgetLine = { label: string; amount: number };

export type TripBudget = {
  budget: number | null;
  /** Everything with a cost on it: committed stops plus estimates on places
   *  that aren't scheduled yet. Planning a trip means knowing what it will
   *  cost including the parts you haven't booked. */
  planned: number;
  committed: number;
  estimated: number;
  remaining: number | null;
  /** 0-1 of budget consumed, capped for the bar; `overBudget` carries the
   *  overflow so the UI can say so instead of silently clamping. */
  ratio: number;
  overBudget: boolean;
  lines: BudgetLine[];
};

export function buildBudget(trip: Trip, items: ItineraryItem[], places: TripPlace[]): TripBudget {
  const budget = trip.budget ? Number(trip.budget) : null;

  const buckets = new Map<string, number>();
  let committed = 0;
  for (const item of items) {
    const cost = Number(item.cost ?? 0);
    if (!cost) continue;
    committed += cost;
    const key = item.category ?? "other";
    buckets.set(key, (buckets.get(key) ?? 0) + cost);
  }

  let estimated = 0;
  for (const place of places) {
    // A place that's already on the timeline has its cost counted there —
    // adding the estimate too would double-charge the same museum ticket.
    if (place.isScheduled) continue;
    const cost = Number(place.estCost ?? 0);
    if (!cost) continue;
    estimated += cost;
    const key = place.category ?? "other";
    buckets.set(key, (buckets.get(key) ?? 0) + cost);
  }

  const planned = committed + estimated;
  const lines = [...buckets.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    budget,
    planned,
    committed,
    estimated,
    remaining: budget === null ? null : budget - planned,
    ratio: budget && budget > 0 ? Math.min(1, planned / budget) : 0,
    overBudget: budget !== null && budget > 0 && planned > budget,
    lines,
  };
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number; percent: number } {
  const total = items.length;
  const done = items.filter((i) => i.isDone).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// ---------------------------------------------------------------------------
// The clock
// ---------------------------------------------------------------------------

/**
 * A ticking `now`, shared by everything on the page.
 *
 * Once a minute is enough: the finest thing the timeline shows is a clock time
 * in minutes, so a faster tick would re-render the whole plan to change
 * nothing. The interval is aligned to the next whole minute so the displayed
 * time flips when the minute actually turns rather than up to 59 seconds late.
 *
 * It also re-reads the clock when the tab comes back to the foreground —
 * background timers are throttled hard on mobile, and a PWA resumed after an
 * hour must not paint an hour-old "now" line.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const tick = () => setNow(new Date());
    const align = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return now;
}
