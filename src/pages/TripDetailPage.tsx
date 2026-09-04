import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { CalendarRange, ListChecks, MapPinned, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ItineraryItem, TripDetail, TripPlace } from "@/lib/trips-api";
import { deleteTrip } from "@/lib/trips-api";
import { ApiError } from "@/lib/api";
import { Fab } from "@/components/layout/Fab";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedTabs, SegmentedPanel } from "@/components/ui/segmented-tabs";
import type { SegmentedTab } from "@/components/ui/segmented-tabs";
import { TripHero } from "@/components/trips/TripHero";
import { TripPulse } from "@/components/trips/TripPulse";
import { TripDayRail } from "@/components/trips/TripDayRail";
import { TripTimeline } from "@/components/trips/TripTimeline";
import { PlacesBoard } from "@/components/trips/PlacesBoard";
import { TripPrep } from "@/components/trips/TripPrep";
import { ActivitySheet } from "@/components/trips/ActivitySheet";
import type { ActivityDraft } from "@/components/trips/ActivitySheet";
import { PlaceSheet } from "@/components/trips/PlaceSheet";
import type { PlaceDraft } from "@/components/trips/PlaceSheet";
import { buildBudget, buildTripPlan, toDayKey, useNow } from "@/components/trips/trip-plan";
import { cn } from "@/components/ui/utils";

type Section = "plan" | "places" | "prep";

const SECTION_ORDER: Section[] = ["plan", "places", "prep"];

/**
 * A trip, as a place you plan from rather than a record you read.
 *
 * Three sections behind one segmented control:
 *   plan   — the day-by-day spine, with a live marker for where you are
 *   places — the board of candidates, before any of them is a commitment
 *   prep   — what it will cost, and what has to be done before leaving
 *
 * All four datasets arrive in a single loader request (see api/trips/detail),
 * so switching sections costs nothing and every derived figure on the page —
 * budget, progress, counts — is computed from one consistent snapshot.
 */
export default function TripDetailPage() {
  const { trip, itineraryItems, places, checklist } = useLoaderData() as TripDetail;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const now = useNow();

  const [section, setSection] = useState<Section>("plan");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activityDraft, setActivityDraft] = useState<ActivityDraft | null>(null);
  const [placeDraft, setPlaceDraft] = useState<PlaceDraft>(null);

  const plan = useMemo(() => buildTripPlan(trip, itineraryItems, now), [trip, itineraryItems, now]);
  const budget = useMemo(() => buildBudget(trip, itineraryItems, places), [trip, itineraryItems, places]);

  const revalidate = useCallback(() => revalidator.revalidate(), [revalidator]);

  // Which day is on screen. Starts on today when the trip is underway, on the
  // first day otherwise — the day you most likely came here to look at.
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const defaultDay = plan.days.find((d) => d.isToday)?.key ?? plan.days[0]?.key ?? null;
  const selectedDay = activeDay ?? defaultDay;

  // A zero-height marker sitting immediately above the sticky tab strip, used
  // to find where the strip belongs in the document on a section change.
  //
  // It exists because the strip itself cannot be measured. Both of the obvious
  // readings lie once `position: sticky` has pinned it: getBoundingClientRect()
  // reports top 0 (it is glued to the viewport), and offsetTop tracks the
  // sticky offset too — at scroll 2122 the strip reported offsetTop 2122. Only
  // a statically positioned sibling reports the real layout position.
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  const sectionEls = useRef(new Map<string, HTMLElement>());
  const registerSection = useCallback((key: string, el: HTMLElement | null) => {
    if (el) sectionEls.current.set(key, el);
    else sectionEls.current.delete(key);
  }, []);

  const jumpToDay = useCallback(
    (key: string) => {
      setSection((current) => {
        if (current !== "plan") setDirection(-1);
        return "plan";
      });
      setActiveDay(key);
      // One frame's grace so the panel is mounted before we scroll to something
      // inside it — jumping from Places to a day would otherwise scroll a
      // section that doesn't exist yet.
      requestAnimationFrame(() => {
        sectionEls.current.get(key)?.scrollIntoView({
          behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "start",
        });
      });
    },
    [],
  );

  // Keep the day rail pointing at whatever day is actually on screen. An
  // IntersectionObserver rather than a scroll handler: it fires only on
  // crossings, so a long timeline doesn't run layout work on every frame.
  useEffect(() => {
    if (section !== "plan") return;
    const els = [...sectionEls.current.entries()];
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost section currently intersecting the band just under the
        // sticky chrome wins — several can be visible at once on a short day.
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActiveDay(hit.target.id.replace("trip-day-", ""));
      },
      // Top inset clears the tabs + day header; the deep bottom inset keeps
      // only the band near the top of the viewport eligible.
      { rootMargin: "-120px 0px -70% 0px", threshold: 0 },
    );

    for (const [, el] of els) observer.observe(el);
    return () => observer.disconnect();
  }, [section, plan.days.length]);

  /**
   * After a section change, bring the tab strip back to the top of the
   * viewport — but only when the page had already scrolled past it. Switching
   * tabs from halfway down a long timeline otherwise opened the new panel
   * mid-scroll, with its own filter row and header off screen; picking a tab
   * while already at the top must not yank the hero away.
   *
   * A layout effect rather than the click handler: leaving the Plan tab also
   * removes the day rail ABOVE the strip, so a measurement taken during the
   * click is one render out of date and the scroll lands short.
   */
  const firstRender = useRef(true);
  useLayoutEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const anchor = scrollAnchorRef.current;
    if (!anchor) return;
    const top = anchor.getBoundingClientRect().top + window.scrollY;
    if (window.scrollY <= top) return;
    window.scrollTo({
      top,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [section]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTrip(trip.id);
      toast.success("Trip deleted");
      navigate("/trips");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete the trip. Please try again.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  function changeSection(next: Section) {
    if (next === section) return;
    setDirection(SECTION_ORDER.indexOf(next) > SECTION_ORDER.indexOf(section) ? 1 : -1);
    setSection(next);
  }

  const tabs: SegmentedTab<Section>[] = [
    { value: "plan", label: "Plan", icon: CalendarRange, badge: itineraryItems.length },
    { value: "places", label: "Places", icon: MapPinned, badge: places.length },
    { value: "prep", label: "Prep", icon: ListChecks, badge: checklist.filter((c) => !c.isDone).length },
  ];

  // Whether the visible panel is showing its own empty state — the one that
  // already carries a full-width primary button.
  const panelIsEmpty =
    (section === "plan" && plan.days.length === 0 && plan.unscheduled.length === 0) ||
    (section === "places" && places.length === 0);

  /*
   * The FAB adds to whatever you're looking at, rather than opening a chooser
   * that asks a question the current tab already answered. It stands down in
   * two cases:
   *
   *  - Prep, whose primary action is the quick-add field sitting in the panel,
   *    always visible and ready to type into. A floating button offering a
   *    DIFFERENT action ("Add a stop") was both wrong and literally covering it.
   *  - An empty panel, whose empty state already offers the same action as a
   *    full-width button. Two identical primary buttons forty pixels apart is
   *    not a choice, it's a mistake.
   */
  const fab =
    section === "prep" || panelIsEmpty
      ? null
      : section === "places"
      ? { label: "Save a place", onClick: () => setPlaceDraft("new") }
      : {
          label: "Add a stop",
          onClick: () =>
            setActivityDraft({
              mode: "create",
              // Pre-dated to the day on screen: adding from Day 4 almost always
              // means adding to Day 4, and it stays editable in the sheet.
              dayKey: section === "plan" ? (selectedDay ?? undefined) : undefined,
            }),
        };

  return (
    <div>
      <TripHero
        trip={trip}
        backTo="/trips"
        menuItems={[
          { label: "Edit trip", icon: Pencil, onSelect: () => navigate(`/trips/${trip.id}/edit`) },
          { label: "Delete trip", icon: Trash2, destructive: true, onSelect: () => setConfirmingDelete(true) },
        ]}
      />

      <div className="mx-auto max-w-md px-4 pt-4">
        <TripPulse plan={plan} onJump={jumpToDay} />

        {/* Only on the Plan tab. "Which day?" is a question the timeline asks
            and the budget doesn't — parked over the prep list it was chrome. */}
        {section === "plan" && plan.days.length > 0 && (
          <div className="mt-3">
            <TripDayRail days={plan.days} selectedKey={selectedDay} onSelect={jumpToDay} />
          </div>
        )}
      </div>

      {/* The tabs pin to the top of the viewport so the section you're in is
          never a scroll away — the day headers below stick under them. */}
      <div ref={scrollAnchorRef} aria-hidden="true" className="mt-3 h-0" />
      <div className="sticky top-0 z-[var(--z-sticky)] mx-auto max-w-md px-4 pt-1 pb-2">
        <SegmentedTabs tabs={tabs} value={section} onChange={changeSection} label="Trip sections" />
      </div>

      <div className={cn(
          "mx-auto max-w-md px-4 pt-1",
          fab ? "pb-[calc(9rem+env(safe-area-inset-bottom))]" : "pb-[calc(6.5rem+env(safe-area-inset-bottom))]",
        )}>
        {/* Keyed on the section so React remounts the panel and its entrance
            replays — a crossfade between two live trees would animate nothing. */}
        <SegmentedPanel key={section} value={section} direction={direction}>
          {section === "plan" && (
            <TripTimeline
              plan={plan}
              now={now}
              onAddToDay={(dayKey) => setActivityDraft({ mode: "create", dayKey })}
              onEdit={(item: ItineraryItem) => setActivityDraft({ mode: "edit", item })}
              onChanged={revalidate}
              registerSection={registerSection}
            />
          )}

          {section === "places" && (
            <PlacesBoard
              places={places}
              onAdd={() => setPlaceDraft("new")}
              onEdit={(place: TripPlace) => setPlaceDraft(place)}
              onSchedule={(place: TripPlace) =>
                setActivityDraft({
                  mode: "create",
                  place,
                  // Scheduling from the board lands on the day the timeline was
                  // last looking at, or the trip's first day.
                  dayKey: selectedDay ?? (trip.startDate ? toDayKey(new Date(trip.startDate)) : undefined),
                })
              }
              onChanged={revalidate}
            />
          )}

          {section === "prep" && (
            <>
              <TripPrep budget={budget} checklist={checklist} tripId={trip.id} onChanged={revalidate} />
              {trip.notes && (
                <section className="mt-8 border-t border-border pt-5">
                  <h3 className="mb-2 text-sm font-bold text-foreground">Trip notes</h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{trip.notes}</p>
                </section>
              )}
            </>
          )}
        </SegmentedPanel>
      </div>

      {fab && <Fab label={fab.label} onClick={fab.onClick} />}

      <ActivitySheet
        tripId={trip.id}
        draft={activityDraft}
        onClose={() => setActivityDraft(null)}
        onSaved={revalidate}
      />

      <PlaceSheet tripId={trip.id} draft={placeDraft} onClose={() => setPlaceDraft(null)} onSaved={revalidate} />

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this trip?"
        description="This removes the trip, its whole plan, its places and its prep list for both of you. This can't be undone."
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
