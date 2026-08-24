import { Link, useLocation, useNavigation } from "react-router";
import {
  Home09Icon,
  MapsGlobal01Icon,
  ShoppingCart02Icon,
  Target03Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";

import { cn } from "@/components/ui/utils";
import { TwotoneIcon } from "@/components/TwotoneIcon";
import { prefetchOn } from "@/lib/prefetch";

type BottomNavTab = {
  id: string;
  label: string;
  href: string;
  icon: Parameters<typeof TwotoneIcon>[0]["icon"];
  /** Which of the glyph's nodes carry the meaning — see TwotoneIcon. */
  primary: readonly number[];
};

/**
 * The tabs — Hugeicons, rendered twotone (see TwotoneIcon for why the twotone
 * reading is applied here rather than imported).
 *
 * They were five hand-drawn solid-fill SVGs painted through a CSS mask, then
 * briefly lucide strokes. Hugeicons' rounded geometry sits better against Plus
 * Jakarta's humanist curves than lucide's squarer terminals did, and the
 * twotone reading gives the row a softness a single-weight outline can't: the
 * container recedes, the subject stays.
 *
 * `primary` picks the node that carries the meaning, which differs per glyph —
 * on the map it's the pin (the globe is the container), on the target it's the
 * centre (the rings are), on the house it's the outline (the door is detail).
 *
 * Only the active tab is labelled. Five permanent labels is five words of
 * chrome for a destination the user learned on day two; spending that width on
 * the one tab that is actually speaking lets it say its name properly and lets
 * the other four breathe as icons.
 */
export const DEFAULT_BOTTOM_NAV_TABS: BottomNavTab[] = [
  { id: "home", label: "Home", href: "/home", icon: Home09Icon, primary: [0] },
  { id: "trips", label: "Trips", href: "/trips", icon: MapsGlobal01Icon, primary: [3] },
  { id: "shopping", label: "Shopping", href: "/shopping", icon: ShoppingCart02Icon, primary: [1] },
  { id: "goals", label: "Goals", href: "/goals", icon: Target03Icon, primary: [2] },
  { id: "profile", label: "Profile", href: "/profile", icon: UserCircleIcon, primary: [0, 2] },
];

export function BottomNav({ tabs = DEFAULT_BOTTOM_NAV_TABS }: { tabs?: BottomNavTab[] }) {
  const { pathname } = useLocation();
  const navigation = useNavigation();

  // The tab the visitor is heading *to*, not the one they are still on.
  //
  // The pill used to wait for the navigation to commit, which meant that on any
  // switch that wasn't instant the whole bar sat unchanged — nothing anywhere on
  // screen acknowledged the tap. That is what made a slow switch read as a dead
  // button rather than as a wait, and it's why the fix belongs here as well as
  // in the loaders: the pill now moves on the tap and the destination catches
  // up, instead of the other way round.
  const target = navigation.location?.pathname ?? pathname;

  return (
    // A floating rounded-rectangle bar, inset from the screen edges and lifted
    // above the safe area. The outer wrapper is click-through; only the bar
    // itself takes pointer events.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-nav)] flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <nav
        // Names the landmark. Without it a screen reader's landmark list just
        // reads "navigation" with nothing to distinguish it.
        aria-label="Main"
        className="glass-3 pointer-events-auto flex w-full max-w-md items-stretch rounded-lg p-1.5"
      >
        {tabs.map((tab) => {
          // Match nested routes too, so /goals/123 and /goals/123/edit keep the
          // Goals tab lit — exact-match left detail pages with no active tab.
          const isActive = target === tab.href || target.startsWith(`${tab.href}/`);
          // Where the visitor actually *is* — the scroll-to-top shortcut below
          // is about the page under their thumb, not the one being navigated to.
          const isCurrent = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.id}
              to={tab.href}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              // Starts the destination's chunk and data on pointerdown, which
              // lands 100-300ms before the click does on a phone — see
              // src/lib/prefetch.ts. By the time the router asks for either,
              // it's usually already there.
              {...prefetchOn(tab.href)}
              onClick={() => {
                // Tapping the tab you're already on scrolls that page back to
                // the top rather than re-running a no-op navigation — the
                // convention every native tab bar follows (Jakob's Law), and
                // the only way back up a long list without a manual swipe.
                if (isCurrent) window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={cn(
                // min-h-11 holds the app's 44px tap floor. Dropping the label
                // from four of the five tabs took ~11px of height out of them,
                // which quietly put every inactive target under it.
                "group/tab relative flex min-h-11 items-center justify-center gap-1.5 outline-none",
                // Nested radius derived rather than guessed: the bar is
                // --radius-lg and carries 6px of padding, so its children are
                // 6px tighter.
                "rounded-[calc(var(--radius-lg)-0.375rem)]",
                // The active tab takes only the width its label needs; the
                // other four share what's left equally. Both sides of that
                // split move at once as the label opens, which is what makes
                // the pill look like it travels along the bar rather than
                // blinking out in one place and in again in another.
                // px-2.5 rather than px-3 on the pill: at 320px the wider
                // padding left the four inactive tabs 43px each, just under
                // the same floor. Measured 44.7px at 320 and 63px at 390.
                isActive ? "flex-none px-2.5" : "min-w-0 flex-1 px-1",
                "transition-colors duration-[var(--dur-2)] ease-[var(--ease-glide)]",
                "focus-visible:ring-[3px] focus-visible:ring-[var(--nav-fg-active)]/50",
                isActive ? "text-[var(--nav-fg-active)]" : "text-[var(--nav-fg-inactive)]",
              )}
            >
              {/*
                The pill sits behind the content rather than wrapping it, so it
                can fade without nudging what it holds. It fades faster than
                the label opens (--dur-1 against --dur-3): by the time the row
                has finished reflowing, the shape has already committed to its
                new home, which reads as one object moving instead of two
                objects swapping.
              */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 rounded-[calc(var(--radius-lg)-0.375rem)] bg-violet-100",
                  "transition-opacity duration-[var(--dur-1)] ease-[var(--ease-glide)]",
                  // The pressed state is the earliest acknowledgement available:
                  // :active lands on pointerdown, ahead of the click, ahead of
                  // the router. It is deliberately fainter than the committed
                  // pill so the two never read as the same thing.
                  isActive ? "opacity-100" : "opacity-0 group-active/tab:opacity-55",
                )}
              />

              <TwotoneIcon
                icon={tab.icon}
                primary={tab.primary}
                size={22}
                // The secondary tone has to survive being drawn in the muted
                // inactive colour as well as the brand violet, so it sits a
                // little stronger than a pure decorative dim would.
                secondaryOpacity={isActive ? 0.4 : 0.45}
                strokeWidth={1.6}
                // Sinks a little under the finger. Transform only, so it runs
                // on the compositor and can't be delayed by whatever the tap
                // has just set in motion on the main thread.
                className="relative transition-transform duration-[var(--dur-1)] ease-[var(--ease-glide)] group-active/tab:scale-90 motion-reduce:transition-none"
              />

              {/*
                Only the active tab is labelled — four words the user has
                already learned are four words of noise, and dropping them is
                what buys the active tab room to say its own out loud.

                The label is clipped to zero width rather than unmounted: an
                element that leaves the DOM cannot animate out, and the width
                is exactly what the reflow above is riding on. The spring
                easing gives the opening a small overshoot, so the pill settles
                rather than stopping dead.

                aria-hidden because the Link already carries the same text as
                its aria-label, which is what keeps every tab named for a
                screen reader whether or not it is showing a label.
              */}
              <span
                aria-hidden="true"
                className={cn(
                  "relative overflow-hidden text-2xs leading-none font-semibold tracking-tight whitespace-nowrap",
                  "transition-[max-width,opacity] duration-[var(--dur-3)] ease-[var(--ease-spring)]",
                  isActive ? "max-w-[7rem] opacity-100" : "max-w-0 opacity-0",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
