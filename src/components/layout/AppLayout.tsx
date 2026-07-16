import { Outlet, useNavigation } from "react-router";

import { BottomNav } from "./BottomNav";
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
      {isNavigating && (
        <div
          role="status"
          aria-label="Loading"
          className="fixed inset-x-0 top-0 z-[var(--z-toast)] flex justify-center pt-3"
        >
          <div className="rounded-full bg-card px-3 py-2 shadow-md">
            <Loader size={20} />
          </div>
        </div>
      )}
      <main className="pb-bottom-nav">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
