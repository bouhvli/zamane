import { useEffect, useState } from "react";
import { Outlet, useNavigation } from "react-router";

import { BottomNav } from "./BottomNav";
import { AmbientField } from "./AmbientField";
import { Loader } from "@/components/Loader";
import { warmAppOnIdle } from "@/lib/prefetch";

// Zamane is phone-only by deliberate choice, not oversight: every page caps
// its content at max-w-md and there are no md:/lg: breakpoints anywhere in
// the app. It's built and tested as a mobile PWA; on a tablet or desktop
// browser it renders as a fixed-width column rather than adapting. Revisit
// this comment before adding responsive layout work rather than assuming
// the narrow width is a bug.
export function AppLayout() {
  // createBrowserRouter blocks a navigation on its loader promise — without
  // this, tapping a nav tab on a slow connection leaves the previous page
  // sitting frozen on screen with zero feedback until the new page's data
  // arrives.
  const navigation = useNavigation();
  const showLoader = useDelayed(navigation.state === "loading", 200);

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
 * Most navigations are now served from the route cache and finish inside a
 * frame or two (see src/lib/route-cache.ts). Rendering the spinner the instant
 * the router reports "loading" made those flash a pill on and off again, which
 * reads as jank rather than as speed — a navigation that's already done needs
 * no reassurance. Anything genuinely waiting on the network still crosses the
 * threshold and gets its feedback.
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
