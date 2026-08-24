import { useEffect, useState } from "react";
import { Outlet, useNavigation } from "react-router";

import { BottomNav } from "./BottomNav";
import { AmbientField } from "./AmbientField";
import { Loader } from "@/components/Loader";
import { warmAppOnIdle } from "@/lib/prefetch";
import { useRouteSyncing } from "@/lib/use-route-data";

// Zamane is phone-only by deliberate choice, not oversight: every page caps
// its content at max-w-md and there are no md:/lg: breakpoints anywhere in
// the app. It's built and tested as a mobile PWA; on a tablet or desktop
// browser it renders as a fixed-width column rather than adapting. Revisit
// this comment before adding responsive layout work rather than assuming
// the narrow width is a bug.
export function AppLayout() {
  // Two different waits, one indicator.
  //
  // `navigation.state` is now only ever "loading" while a page's *chunk* is
  // still downloading — the data loaders stopped awaiting anything, so the
  // router commits a tab before its payload exists (see route-cache.ts).
  // `useRouteSyncing` is the other half: a request actually in flight, which is
  // the case with no other feedback on screen, because the page is busy
  // rendering perfectly good stale data while it happens.
  const navigation = useNavigation();
  const syncing = useRouteSyncing();
  const showLoader = useDelayed(navigation.state === "loading" || syncing, 500);

  // Chunks for the other tabs, and one dashboard request that seeds all of
  // them, fetched in idle time — see src/lib/prefetch.ts. Runs once per app
  // launch, from here rather than main.tsx because this layout only mounts
  // once the visitor is known to be signed in and in a group.
  useEffect(warmAppOnIdle, []);

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* The one lit backdrop, shared by all five tabs. It used to live inside
          Home's card stack, which is why the frosted rows only read as glass
          there — everywhere else backdrop-filter was blurring a flat colour. */}
      <AmbientField />

      {showLoader && (
        <div
          role="status"
          aria-label="Loading"
          className="fixed inset-x-0 top-0 z-[var(--z-toast)] flex justify-center pt-3"
        >
          <div className="glass-3 rounded-full px-3 py-2">
            <Loader size={20} />
          </div>
        </div>
      )}
      <main className="ambient-content pb-bottom-nav">
        <Outlet />
      </main>
      {/* Dissolves the end of the page under the floating cluster — see
          .bottom-fade in bottom-nav.css. */}
      <div aria-hidden="true" className="bottom-fade" />
      <BottomNav />
    </div>
  );
}

/**
 * True only once `active` has held for `delay` ms.
 *
 * Most navigations resolve inside a frame or two and most refreshes answer in
 * ~50ms once Neon is warm. Rendering the pill the instant either starts made
 * those flash on and off again, which reads as jank rather than as speed — work
 * that is already done needs no reassurance. Anything genuinely waiting still
 * crosses the threshold and gets its feedback.
 */
function useDelayed(active: boolean, delay: number): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timer = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(timer);
  }, [active, delay]);

  return shown;
}
