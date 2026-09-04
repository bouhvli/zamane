import { useState } from "react";
import { CalendarPlus, CalendarRange, ChevronDown, ExternalLink, Inbox, MapPin, Pencil, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ItineraryItem } from "@/lib/trips-api";
import { deleteItineraryItem, setItineraryItemDone } from "@/lib/trips-api";
import { formatAmount } from "@/lib/format";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { useOptimisticToggle } from "@/lib/use-optimistic-toggle";
import { cn } from "@/components/ui/utils";
import { TickBox } from "@/components/ui/tick-box";
import { categoryIcon, categoryLabel } from "./trip-categories";
import { formatClock, nowMarkerIndex } from "./trip-plan";
import type { ItemPhase, PlannedItem, TripDay, TripPlan } from "./trip-plan";

const DAY_LABEL = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "short" });

/**
 * The trip's day-by-day plan, drawn as one continuous spine.
 *
 * The core idea: the line IS the progress bar. It runs violet behind
 * everything that has already happened and drops to a hairline ahead of it,
 * with a live "now" marker slotted into today at the exact point between the
 * stop that just finished and the one coming up. Nothing on the page has to
 * say "you are here" in words, because the shape of the line already does.
 */
export function TripTimeline({
  plan,
  now,
  onAddToDay,
  onEdit,
  onChanged,
  registerSection,
}: {
  plan: TripPlan;
  now: Date;
  onAddToDay: (dayKey: string) => void;
  onEdit: (item: ItineraryItem) => void;
  onChanged: () => void;
  /** Hands each day section's element up so the page can keep the day rail in
   *  sync with whatever is actually on screen. */
  registerSection: (key: string, el: HTMLElement | null) => void;
}) {
  const { pendingIds, requestDelete } = useUndoableDelete({
    commit: (id) => deleteItineraryItem(id),
    onCommitted: onChanged,
    errorMessage: "Couldn't delete the stop. Please try again.",
  });

  // A trip with no dates has no days to lay out, and one with nothing captured
  // has no undated bucket either — so without this the Plan tab rendered an
  // empty <div> and the screen was simply blank.
  if (plan.days.length === 0 && plan.unscheduled.length === 0) {
    return <EmptyPlan hasDates={plan.phase !== "unscheduled"} onAdd={() => onAddToDay("")} />;
  }

  // One running index across every day, so the spine's draw-in sweeps down the
  // whole timeline as a single gesture instead of restarting at each day.
  let railIndex = 0;

  return (
    <div className="space-y-7">
      {plan.days.map((day) => {
        const visible = day.items.filter((p) => !pendingIds.has(p.item.id));
        const markerAt = nowMarkerIndex(day, now);
        const rows = buildRows(visible, markerAt);
        const startIndex = railIndex;
        railIndex += rows.length;

        return (
          <section
            key={day.key}
            id={`trip-day-${day.key}`}
            ref={(el) => registerSection(day.key, el)}
            // The rail lands under the sticky day header, which is itself
            // under the sticky section tabs; scroll-margin keeps a jumped-to
            // day from hiding beneath both.
            className="scroll-mt-[8rem]"
          >
            <DayHeader day={day} onAdd={() => onAddToDay(day.key)} />

            {rows.length === 0 ? (
              <EmptyDay onAdd={() => onAddToDay(day.key)} />
            ) : (
              <ol className="tl mt-1">
                {rows.map((row, i) =>
                  row.kind === "now" ? (
                    <NowMarker key="now" now={now} index={startIndex + i} />
                  ) : (
                    <TimelineRow
                      key={row.planned.item.id}
                      planned={row.planned}
                      rail={row.rail}
                      index={startIndex + i}
                      onEdit={() => onEdit(row.planned.item)}
                      onDelete={() =>
                        requestDelete(row.planned.item.id, `Removed "${row.planned.item.title}"`)
                      }
                      onChanged={onChanged}
                    />
                  ),
                )}
              </ol>
            )}
          </section>
        );
      })}

      {plan.unscheduled.length > 0 && (
        <UnscheduledSection
          items={plan.unscheduled.filter((p) => !pendingIds.has(p.item.id))}
          onEdit={onEdit}
          onDelete={(p) => requestDelete(p.item.id, `Removed "${p.item.title}"`)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

type Row =
  | { kind: "item"; planned: PlannedItem; rail: "behind" | "ahead" | "split" }
  | { kind: "now" };

/**
 * Interleaves the now-marker into a day's stops and decides, per row, which
 * side of "now" the rail segment is on.
 *
 * `markerAt` is -2 for any day that isn't today, -1 when now is past
 * everything planned today, otherwise the index the line goes before.
 */
function buildRows(items: PlannedItem[], markerAt: number): Row[] {
  const isToday = markerAt !== -2;
  const rows: Row[] = [];

  items.forEach((planned, i) => {
    // On a past day the whole rail is behind us; on a future day none of it
    // is; on today it flips at the marker.
    const behind = !isToday
      ? planned.phase === "done" || planned.phase === "past"
      : markerAt === -1 || i < markerAt;
    rows.push({ kind: "item", planned, rail: behind ? "behind" : "ahead" });
  });

  if (!isToday) return rows;

  if (markerAt === -1) {
    // Today's plan is finished — the line sits at the end, which is a true and
    // quietly satisfying thing to see.
    rows.push({ kind: "now" });
  } else {
    rows.splice(markerAt, 0, { kind: "now" });
  }
  return rows;
}

function DayHeader({ day, onAdd }: { day: TripDay; onAdd: () => void }) {
  return (
    <div className="sticky top-[3.9rem] z-[var(--z-sticky)] -mx-4 flex items-center gap-2 bg-background/72 px-4 py-2 backdrop-blur-md">
      <h3
        className={cn(
          "font-numeric text-sm font-bold",
          day.isToday ? "text-primary" : day.isPast ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {day.dayNumber ? `Day ${day.dayNumber}` : "Also planned"}
      </h3>
      <span className="truncate text-xs text-muted-foreground">{DAY_LABEL.format(day.date)}</span>
      {day.isToday && (
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-primary">
          Today
        </span>
      )}
      <span className="flex-1" />
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add a stop on ${DAY_LABEL.format(day.date)}`}
        className="-mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <CalendarPlus className="size-4" />
      </button>
    </div>
  );
}

/** The Plan tab with nothing in it yet. Teaches the two ways in — put dates on
 *  the trip so the days lay themselves out, or just start capturing ideas —
 *  rather than reporting that the list is empty. */
function EmptyPlan({ hasDates, onAdd }: { hasDates: boolean; onAdd: () => void }) {
  return (
    <div className="glass-2 flex flex-col items-center gap-3 border-dashed border-violet-200 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-violet-100 text-primary">
        <CalendarRange className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="font-medium text-foreground">Nothing planned yet</p>
        <p className="text-sm text-muted-foreground">
          {hasDates
            ? "Add your first stop and it'll land on the right day."
            : "Give the trip dates and the days lay themselves out. Until then, anything you add waits under “Not scheduled yet”."}
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Add the first stop
      </button>
    </div>
  );
}

function EmptyDay({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="mt-1 flex w-full items-center gap-3 rounded-md border border-dashed border-border px-4 py-4 text-left outline-none transition-colors hover:border-primary/40 hover:bg-card/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CalendarPlus className="size-4" />
      </span>
      <span className="text-sm text-muted-foreground">Nothing planned — a free day, or one to fill.</span>
    </button>
  );
}

function NowMarker({ now, index }: { now: Date; index: number }) {
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(now);
  return (
    <li className="tl-row" data-rail="split" style={{ ["--i" as string]: index }}>
      <div className="flex items-center py-2.5">
        <div className="tl-node">
          <span aria-hidden="true" className="tl-now-dot" />
        </div>
        <span aria-hidden="true" className="tl-now-line" />
        <span className="font-numeric ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[0.6875rem] font-bold text-primary">
          {/* Spelled out for assistive tech, which gets no help from a dashed
              line and a coloured dot. */}
          <span className="sr-only">You are here — it is now </span>
          {time}
        </span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------

function TimelineRow({
  planned,
  rail,
  index,
  onEdit,
  onDelete,
  onChanged,
}: {
  planned: PlannedItem;
  rail: "behind" | "ahead" | "split";
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { item } = planned;
  // The tick flips on tap and reconciles afterwards; `phase` follows it so a
  // stop reads as done the instant it's checked, not one round trip later.
  const [isDone, setDone] = useOptimisticToggle(
    item.isDone,
    (next) => setItineraryItemDone(item.id, next),
    onChanged,
    "Couldn't save that. Please try again.",
  );
  const phase: ItemPhase = isDone ? "done" : planned.phase;
  const Icon = categoryIcon(item.category);
  const start = formatClock(item.itemTime);
  const end = formatClock(item.endTime);
  const kind = categoryLabel(item.category);

  const detail = [item.location, item.placeName && item.placeName !== item.location ? item.placeName : null]
    .filter(Boolean)
    .join(" · ");
  const cost = item.cost && Number(item.cost) > 0 ? Number(item.cost) : null;

  return (
    <li className="tl-row" data-rail={rail} data-checked={isDone} style={{ ["--i" as string]: Math.min(index, 12) }}>
      <div className="flex items-start gap-2 py-1.5">
        <div className="tl-node pt-1">
          <NodeTile icon={Icon} phase={phase} />
        </div>

        <div
          className={cn(
            "min-w-0 flex-1 rounded-md border transition-[border-color,background-color,opacity] duration-[var(--dur-2)] ease-[var(--ease-glide)]",
            phase === "now"
              ? "border-primary/40 bg-card shadow-[0_2px_4px_rgb(var(--glass-ink)/0.04),0_18px_36px_-24px_rgb(var(--glass-cast)/0.45)]"
              : phase === "next"
                ? "border-primary/25 bg-card"
                : "glass-1 rounded-md",
            isDone && "opacity-[0.62]",
          )}
        >
          <div className="flex items-start gap-1.5 p-3">
            {/*
              The whole header is the disclosure control. This used to be a
              small "Details" link, with edit and delete floating on the page
              BELOW the card — two orphaned icons per row, attached to nothing.
              Everything a stop can do now lives inside the stop.
            */}
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="-m-1 min-w-0 flex-1 rounded-md p-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={cn(
                    "font-numeric text-xs font-bold",
                    phase === "now" || phase === "next" ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {start ? (end ? `${start} – ${end}` : start) : "Anytime"}
                </span>
                {phase === "now" && <PhasePill tone="live">Happening now</PhasePill>}
                {phase === "next" && <PhasePill tone="next">Next up</PhasePill>}
              </span>

              <span
                className={cn(
                  "mt-0.5 block text-sm font-semibold leading-snug",
                  isDone ? "text-muted-foreground" : "text-foreground",
                )}
              >
                <span className="strike">{item.title}</span>
              </span>

              {(detail || kind || cost) && (
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  {detail ? (
                    <>
                      <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="truncate">{detail}</span>
                    </>
                  ) : (
                    <span className="truncate">{kind}</span>
                  )}
                  {cost !== null && (
                    <span className="font-numeric shrink-0 whitespace-nowrap">· {formatAmount(cost)}</span>
                  )}
                </span>
              )}
            </button>

            <ChevronDown
              aria-hidden="true"
              className={cn(
                "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--dur-2)] ease-[var(--ease-glide)]",
                open && "rotate-180",
              )}
            />

            <TickBox
              checked={isDone}
              label={`Mark ${item.title} as done`}
              onChange={setDone}
              size="sm"
              className="mt-0.5"
            />
          </div>

          <div className="reveal" data-open={open}>
            <div>
              <div className="space-y-3 border-t border-border px-3 pt-3 pb-3">
                {item.notes ? (
                  <p className="whitespace-pre-line text-xs leading-relaxed text-foreground">{item.notes}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">No notes on this stop yet.</p>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-violet-100 px-3 text-xs font-semibold text-primary outline-none transition-colors hover:bg-violet-200 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                      Open booking
                    </a>
                  )}

                  <span className="flex-1" />

                  <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Pencil aria-hidden="true" className="size-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function NodeTile({ icon: Icon, phase }: { icon: LucideIcon; phase: ItemPhase }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 items-center justify-center rounded-full border transition-colors duration-[var(--dur-2)]",
        phase === "done" && "border-success/30 bg-success-surface text-success",
        phase === "now" &&
          "border-transparent bg-primary text-primary-foreground shadow-[0_0_0_4px_rgb(90_39_255/0.14)]",
        phase === "next" && "border-primary/45 bg-card text-primary",
        phase === "past" && "border-border bg-muted text-muted-foreground",
        (phase === "ahead" || phase === "undated") && "border-border bg-card text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

function PhasePill({ tone, children }: { tone: "live" | "next"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide",
        tone === "live" ? "bg-success text-white" : "bg-violet-100 text-primary",
      )}
    >
      {tone === "live" && <span className="size-1.5 rounded-full bg-current animate-pulse motion-reduce:animate-none" />}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------

/**
 * Stops with no date yet. They stay on the Timeline tab rather than moving to
 * Places, because they are already commitments — someone decided to do them,
 * they just haven't been slotted into a day. Burying them under Places would
 * lose that distinction and the plan with it.
 */
function UnscheduledSection({
  items,
  onEdit,
  onDelete,
}: {
  items: PlannedItem[];
  onEdit: (item: ItineraryItem) => void;
  onDelete: (planned: PlannedItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Inbox aria-hidden="true" className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-bold text-foreground">Not scheduled yet</h3>
        <span className="font-numeric text-xs text-muted-foreground">{items.length}</span>
      </div>

      <ul className="space-y-2">
        {items.map((planned) => {
          const Icon = categoryIcon(planned.item.category);
          return (
            <li
              key={planned.item.id}
              className="glass-1 flex items-center gap-3 rounded-md p-3"
            >
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-card text-muted-foreground"
              >
                <Icon className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{planned.item.title}</p>
                {planned.item.location && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{planned.item.location}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onEdit(planned.item)}
                className="shrink-0 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-primary outline-none transition-colors hover:bg-violet-200 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Pick a day
              </button>

              <button
                type="button"
                onClick={() => onDelete(planned)}
                aria-label={`Remove ${planned.item.title}`}
                className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
