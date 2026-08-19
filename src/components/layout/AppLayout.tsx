import { Outlet, useNavigation } from "react-router";

import { BottomNav } from "./BottomNav";
import { AmbientField } from "./AmbientField";
import { Loader } from "@/components/Loader";

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

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* The one lit backdrop, shared by all five tabs. It used to live inside
          Home's card stack, which is why the frosted rows only read as glass
          there — everywhere else backdrop-filter was blurring a flat colour. */}
      <AmbientField />

      {isNavigating && (
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
