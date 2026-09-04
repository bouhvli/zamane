import { useEffect, useState } from "react";
import { Outlet, useNavigation } from "react-router";
import { ThinkingOrb } from "thinking-orbs";

import { BottomNav } from "./BottomNav";
import { AmbientField } from "./AmbientField";

// thinking-orbs ships strictly monochrome ink (dark dots for `theme="light"`,
// light dots for `theme="dark"`) — this filter recolors the pinned dark ink
// to the app's --primary purple (#7B52FF) regardless of the active theme.
// Values solved for black -> #7B52FF via the standard CSS filter technique
// (https://codepen.io/sosuke/pen/Pjoqqp).
const ORB_PURPLE_FILTER =
  "brightness(0) saturate(100%) invert(37%) sepia(62%) saturate(529%) hue-rotate(210deg) brightness(1.09) contrast(2)";

// A warm Neon query resolves in ~50ms; only a cold compute wake (~3s) or a
// genuinely slow connection should ever show this. Without the delay, every
// tab switch — even a warm one — flashes the full-screen loader for a single
// frame, which reads as the app stuttering rather than the tap registering.
const LOADER_DELAY_MS = 300;

function useDelayedFlag(active: boolean, delay: number) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const id = window.setTimeout(() => setShow(true), delay);
    return () => window.clearTimeout(id);
  }, [active, delay]);

  return show;
}

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
  const isNavigating = navigation.state === "loading";
  const showLoader = useDelayedFlag(isNavigating, LOADER_DELAY_MS);

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
          className="pointer-events-none fixed inset-0 z-[var(--z-toast)] flex items-center justify-center bg-white"
        >
          <ThinkingOrb state="searching" size={64} theme="light" style={{ filter: ORB_PURPLE_FILTER }} />
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
