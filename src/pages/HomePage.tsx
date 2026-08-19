import { Suspense, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Await, Link, useLoaderData, useRevalidator } from "react-router";
import { Check, ChevronRight, CircleDot, Copy, Heart, Map, Plus, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import type { Goal, GoalsSummary } from "@/lib/goals-api";
import type { Group } from "@/lib/groups-api";
import type { Trip, TripsSummary } from "@/lib/trips-api";
import type { ShoppingItem, ShoppingSummary } from "@/lib/shopping-api";
import { friendlyName, formatAmount } from "@/lib/format";
import { cn } from "@/components/ui/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fab } from "@/components/layout/Fab";
import { PageHero } from "@/components/layout/PageHero";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalPickerSheet, goalProgress } from "@/components/goals/GoalPickerSheet";
import { ContributionSheet } from "@/components/goals/ContributionSheet";
import { TripCard } from "@/components/trips/TripCard";
import { tripStatus } from "@/components/trips/trip-visuals";
import { ShoppingPreviewCard } from "@/components/shopping/ShoppingPreviewCard";
import { InstrumentTile } from "@/components/layout/InstrumentTile";
import { Skeleton, SkeletonRow } from "@/components/layout/Skeleton";

type HomeData = {
  goals: Goal[];
  goalsSummary: GoalsSummary;
  group: Group | null;
  /** Streamed behind <Await> — see homeLoader in router.tsx. */
  trips: Promise<{ trips: Trip[]; summary: TripsSummary }>;
  shopping: Promise<{ items: ShoppingItem[]; summary: ShoppingSummary }>;
};

/** localStorage key for a dismissed invite prompt, scoped per group so a new
 *  pairing starts fresh. */
const inviteDismissKey = (groupId: string) => `zamane:invite-dismissed:${groupId}`;

export default function HomePage() {
  const { user } = useAuth();
  const { goals, goalsSummary: summary, group, trips, shopping } = useLoaderData() as HomeData;
  const [copied, setCopied] = useState(false);
  const [inviteDismissed, setInviteDismissed] = useState(() =>
    Boolean(group && localStorage.getItem(inviteDismissKey(group.id))),
  );
  const [picking, setPicking] = useState(false);
  const [contributeTo, setContributeTo] = useState<Goal | null>(null);

  const revalidator = useRevalidator();
  // The two of them share this data from two phones. Without this, a
  // contribution logged by the partner sits invisible behind a stale dashboard
  // — including a stale headline figure — until a full navigation. Refresh when
  // the tab returns to the foreground, throttled so app-switching doesn't
  // hammer the API. Refs keep the effect from re-subscribing (and resetting the
  // throttle) on every revalidator state change.
  const revalidateRef = useRef(revalidator.revalidate);
  revalidateRef.current = revalidator.revalidate;
  const lastRefreshRef = useRef(Date.now());
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshRef.current < 30_000) return;
      lastRefreshRef.current = Date.now();
      revalidateRef.current();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  async function handleCopy() {
    if (!group) return;
    await navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 2000);
  }

  function dismissInvite() {
    if (!group) return;
    localStorage.setItem(inviteDismissKey(group.id), "1");
    setInviteDismissed(true);
  }

  if (!user) return null;

  const members = group?.members ?? [];
  const partner = members.find((member) => member.id !== user.id);
  const greetName = friendlyName(user);
  const formattedDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // The app's headline figure, computed from the goals already loaded (no extra
  // API call).
  //
  // `saved` is LIFETIME: every financial goal, reached ones included. It used to
  // exclude completed goals, which meant reaching a goal — the moment the whole
  // product exists for — made the hero number drop. `towardTarget`/`target`
  // carry the "how close are we" job, and those legitimately look at open goals
  // only so a finished goal can't drag the percentage down.
  const financial = goals.filter((goal) => goal.goalType === "financial");
  const openFinancial = financial.filter((goal) => !goal.isCompleted);
  const lifetimeSaved = financial.reduce((sum, goal) => sum + Number(goal.currentAmount), 0);
  const towardTarget = openFinancial.reduce((sum, goal) => sum + Number(goal.currentAmount), 0);
  const openTarget = openFinancial.reduce((sum, goal) => sum + Number(goal.targetAmount ?? 0), 0);

  // Lead with the number only once there's a real figure to show. A brand-new
  // couple (or one tracking only non-financial goals) sees the warm greeting
  // as the headline instead of a hollow "MAD 0". The Goals CTA card below
  // carries the "here's what to do next" job.
  const metric =
    lifetimeSaved > 0 || openTarget > 0
      ? {
          saved: lifetimeSaved,
          target: openTarget,
          towardTarget,
          openCount: openFinancial.length,
          reachedCount: financial.length - openFinancial.length,
          savedThisMonth: Number(summary.totalSavedThisMonth) || 0,
        }
      : undefined;

  const heroMembers = (members.length > 0 ? members : [user]).map((member) => ({
    id: member.id,
    name: friendlyName(member),
  }));

  // Every unfinished goal — general ones included, since the contribution sheet
  // handles a progress update just as well as a payment.
  const openGoals = goals.filter((goal) => !goal.isCompleted);
  // Goal-Gradient effect: the goal closest to done is the motivating one, so
  // the preview leads with it rather than with whatever was created last. Falls
  // back to reached goals so a couple who finished everything still sees their
  // history instead of an empty-looking section.
  //
  // Three rather than two: the compact row is ~96px against the full card's
  // ~218px, so three of them still take less than half the space two used to,
  // and the extra slot means a couple with three goals sees all of them.
  const previewGoals =
    openGoals.length > 0
      ? [...openGoals].sort((a, b) => goalProgress(b) - goalProgress(a)).slice(0, 3)
      : goals.slice(0, 3);

  const showInvite = Boolean(group) && members.length < 2 && !inviteDismissed;

  return (
    <div>
      <PageHero
        greeting={`Hi, ${greetName}`}
        subline={partner ? `You and ${friendlyName(partner)}` : formattedDate}
        members={heroMembers}
        metric={metric}
        // The figure's referent was unreachable from the figure itself.
        href={metric ? "/goals" : undefined}
      />

      <div className="mx-auto max-w-md space-y-6 px-4 pb-20">
        {showInvite && group && (
          <Card className="relative gap-3 overflow-hidden p-6 text-center">
            <div className="pointer-events-none absolute -top-12 right-0 h-32 w-32 rounded-full bg-violet-200/60 blur-2xl" />
            {/* Dismissable: unpaired, this was the loudest thing on the
                dashboard permanently. The code stays available on Profile. */}
            <button
              type="button"
              onClick={dismissInvite}
              aria-label="Hide invite code"
              className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X className="size-4" />
            </button>
            <div className="relative flex flex-col items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-violet-100 text-primary">
                <Heart className="size-5" fill="currentColor" />
              </span>
              <p className="text-sm font-medium text-foreground">Share this code with your partner</p>
              <p className="w-full rounded-md bg-muted px-4 py-3 font-numeric text-2xl font-bold tracking-[0.28em] text-foreground">
                {group.inviteCode}
              </p>
              <p className="text-xs text-muted-foreground">
                They enter it when they sign up. You can find it again on your profile.
              </p>
              <Button type="button" className="w-full" onClick={handleCopy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy code"}
              </Button>
            </div>
          </Card>
        )}

        {/* The glance row. Home used to be a stack of same-width, same-weight
            sections — every element at one scale, which reads as a list rather
            than a dashboard. These two readouts sit between the hero and the
            feed and answer, without opening a tab, the only two questions that
            change day to day: how much is left to buy, and how soon is the
            next trip. */}
        <Suspense fallback={<TileSkeleton />}>
          <Await resolve={shopping} errorElement={null}>
            {({ items: shoppingItems, summary: shoppingSummary }) => (
              <Suspense fallback={<TileSkeleton />}>
                <Await resolve={trips} errorElement={null}>
                  {({ trips: allTrips }) => (
                    <BentoRow
                      uncheckedCount={shoppingSummary.uncheckedCount}
                      estimatedTotal={Number(shoppingSummary.estimatedTotal)}
                      itemCount={shoppingItems.length}
                      trips={allTrips}
                    />
                  )}
                </Await>
              </Suspense>
            )}
          </Await>
        </Suspense>

        {/* Reordered for daily use rather than narrative order: of the three,
            Shopping is the only one that's genuinely a recurring TASK — a
            couple checks "what do we need" every grocery run, while Goals and
            Trips are progress *readouts* that don't change most days. Leads
            now, ahead of Goals, even though that costs the previous
            hero-to-detail adjacency (the savings figure's own section used to
            sit right under it). */}
        <Section title="Shopping" icon={ShoppingCart} viewAllTo="/shopping">
          <Suspense fallback={<SkeletonRow />}>
            <Await resolve={shopping} errorElement={<SectionError>Couldn't load the shopping list.</SectionError>}>
              {({ items, summary: shoppingSummary }) =>
                items.length === 0 ? (
                  <CtaLink to="/shopping" label="Start your shared list" />
                ) : (
                  <ShoppingPreviewCard items={items} summary={shoppingSummary} />
                )
              }
            </Await>
          </Suspense>
        </Section>

        {/* Second, not first: still the app's premise and what the hero above
            is about, but a savings figure moves on its own pace (a payday, a
            transfer) rather than daily, so it no longer needs the single
            top slot. */}
        <Section title="Goals" icon={CircleDot} viewAllTo="/goals">
          {goals.length === 0 ? (
            <CtaCard
              to="/goals/new"
              icon={CircleDot}
              title="Create your first goal together"
              description="Start saving toward something as a team"
            />
          ) : (
            <div className="stagger space-y-2">
              {previewGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} variant="compact" />
              ))}
            </div>
          )}
        </Section>

        {/* Last: the one section with nothing to check most days at all — no
            trip is ever "due" the way an item needs buying or a goal wants
            money, only occasionally imminent. Still gets its own section
            (not folded away) so a live or soon trip is never more than one
            scroll from the top. */}
        <Section title="Trips" icon={Map} viewAllTo="/trips">
          <Suspense fallback={<SkeletonRow count={2} />}>
            <Await resolve={trips} errorElement={<SectionError>Couldn't load trips.</SectionError>}>
              {/* Param types are inferred from `resolve` — annotating them here
                  makes TS infer Await's generic from the callback instead. */}
              {({ trips: allTrips }) => {
                // "What's next": everything except trips already in the past
                // (undated trips still count — they just aren't scheduled yet).
                const upcoming = allTrips.filter((trip) => tripStatus(trip)?.tone !== "past").slice(0, 2);
                if (upcoming.length > 0) {
                  return (
                    <div className="stagger space-y-2">
                      {upcoming.map((trip) => (
                        <TripCard key={trip.id} trip={trip} variant="compact" />
                      ))}
                    </div>
                  );
                }
                // An empty *upcoming* list is not an empty history — a couple
                // with five finished trips was being told to plan their first.
                return allTrips.length === 0 ? (
                  <CtaLink to="/trips/new" label="Plan your first trip together" />
                ) : (
                  <CtaLink to="/trips/new" label="Nothing planned — start the next trip" />
                );
              }}
            </Await>
          </Suspense>
        </Section>
      </div>

      {/* The dashboard's one primary action. It had none: three "View all"
          links and up to three CTA cards all sat at equal weight, while the
          core loop — putting money toward a goal — was three screens away with
          no affordance here at all (Hick / Von Restorff / Fitts). */}
      {openGoals.length === 0 ? (
        <Fab to="/goals/new" label="New goal" />
      ) : (
        <Fab
          label="Add to a goal"
          onClick={() => {
            // One open goal is not a choice worth presenting.
            if (openGoals.length === 1) setContributeTo(openGoals[0]);
            else setPicking(true);
          }}
        />
      )}

      <GoalPickerSheet
        open={picking}
        goals={openGoals}
        onClose={() => setPicking(false)}
        onPick={(goal) => {
          setPicking(false);
          setContributeTo(goal);
        }}
      />

      <ContributionSheet
        open={contributeTo !== null}
        onClose={() => setContributeTo(null)}
        goalId={contributeTo?.id ?? ""}
        goalType={contributeTo?.goalType ?? "financial"}
        goalTitle={contributeTo?.title}
        currentProgressPct={contributeTo?.currentProgressPct ?? 0}
        onContributed={() => {
          setContributeTo(null);
          revalidator.revalidate();
        }}
      />
    </div>
  );
}

// A dashboard section. The title is a real `h2` — these were styled `<p>`s, so
// in metric mode the entire dashboard exposed no headings at all and a screen
// reader had nothing to navigate by. No `px-1` inset either: the label now
// aligns to the same edge as the cards beneath it (Gestalt continuity).
function Section({
  title,
  icon: Icon,
  viewAllTo,
  children,
}: {
  title: string;
  icon: LucideIcon;
  viewAllTo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-violet-100 text-primary"
          >
            <Icon className="size-3.5" />
          </span>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
        {/* min-h-11 restores the project's own 44px tap floor — as a `size="sm"`
            link button this was 36px, and it's the section's only navigation
            affordance (Fitts). Negative margin keeps the enlarged target from
            pushing the text off the content edge. */}
        <Link
          to={viewAllTo}
          className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-md px-2 text-sm font-semibold text-primary underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          View all
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

// The one emphasized empty-state card on the dashboard. A brand-new couple used
// to get three of these stacked — identical icon, copy shape and weight — which
// is three equal "first steps" and therefore none (Hick's Law). Only Goals, the
// product's premise, gets the full treatment now; the other sections fall back
// to CtaLink.
function CtaCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-3 rounded-lg bg-card p-4 transition-[color,background-color,border-color,transform] active:scale-[0.98] motion-reduce:active:scale-100",
        // border-violet-300 measures ~3.7:1 against the card. At /30 it was
        // ~1.9:1 — and since --card sits only ~1.05:1 from the page
        // background, this dashed edge is the *only* thing that identifies the
        // card as a control, which WCAG 1.4.11 asks to clear 3:1.
        "border border-dashed border-violet-300 hover:border-primary hover:bg-violet-50",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col items-start">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </Link>
  );
}

// The quiet empty state: a plain text link. Being text rather than a bordered
// box, it's self-evidently a control at any contrast (no 1.4.11 boundary to
// clear) and it keeps the visual weight for the one CTA that should own it.
function CtaLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md pr-2 text-sm font-semibold text-primary underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Plus aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}

function TileSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Skeleton className="h-[92px] rounded-md" />
      <Skeleton className="h-[92px] rounded-md" />
    </div>
  );
}

// The two glance readouts. Both degrade to a still-useful state rather than
// disappearing: an empty list says "all clear", and no scheduled trip points
// at planning one instead of showing a hollow countdown.
function BentoRow({
  uncheckedCount,
  estimatedTotal,
  itemCount,
  trips: allTrips,
}: {
  uncheckedCount: number;
  estimatedTotal: number;
  itemCount: number;
  trips: Trip[];
}) {
  // The soonest trip that hasn't finished — the only one with a countdown
  // worth reading. tripStatus already encodes "soon" vs "live" vs "past".
  const next = allTrips
    .filter((trip) => trip.startDate && tripStatus(trip)?.tone !== "past")
    .sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1))[0];
  const status = next ? tripStatus(next) : null;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <InstrumentTile
        to="/shopping"
        label="Shopping"
        value={String(uncheckedCount)}
        unit={uncheckedCount === 1 ? "item" : "items"}
        caption={
          uncheckedCount === 0
            ? itemCount === 0
              ? "Nothing on the list"
              : "All bought"
            : estimatedTotal > 0
              ? `${formatAmount(estimatedTotal)} estimated`
              : "Left to buy"
        }
      />
      {next && status ? (
        <InstrumentTile
          to={`/trips/${next.id}`}
          label="Next trip"
          value={status.tone === "live" ? "Now" : status.label.replace(/^In /, "").replace(/ days?$/, "")}
          unit={status.tone === "live" || !/^In \d/.test(status.label) ? undefined : "days"}
          caption={next.destination ?? next.title}
        />
      ) : (
        <InstrumentTile to="/trips/new" label="Next trip" value="—" caption="Nothing planned yet" />
      )}
    </div>
  );
}

// One section failing to load no longer takes the whole dashboard down with it.
function SectionError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
