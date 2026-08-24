/**
 * Starting a navigation before the tap finishes.
 *
 * A route needs two things before it can paint: its JS chunk and its data.
 * React Router asks for both when the navigation begins, so the visitor waits
 * out whichever is slower — and on a phone, a pointerdown lands 100-300ms
 * before the click does. That window is free, and it's enough to have a small
 * page chunk already in the module registry and a warm answer already in the
 * route cache by the time the router asks.
 *
 * Everything here is idempotent and failure-tolerant: a prefetch that misses
 * costs one request nobody reads, and a prefetch that errors is swallowed —
 * the real navigation will surface the error properly a moment later.
 */
import { pageModules, type PageKey } from "./page-modules";
import { requestRoute, hasRoute } from "./route-cache";
import { routeKey, routeFetcher } from "./route-data";

type Target = { page: PageKey; warm?: () => void };

/** Maps a pathname to the chunk and the cache entry that rendering it needs. */
function resolve(pathname: string): Target | null {
  const [section, second, third] = pathname.replace(/^\/+|\/+$/g, "").split("/");

  switch (section) {
    case "home":
      return { page: "home", warm: () => requestRoute(routeKey.home, routeFetcher.home) };

    case "shopping":
      return { page: "shopping", warm: () => requestRoute(routeKey.shopping, routeFetcher.shopping) };

    case "profile":
      return { page: "profile", warm: () => requestRoute(routeKey.group, routeFetcher.group) };

    case "goals": {
      if (!second) return { page: "goals", warm: () => requestRoute(routeKey.goals, routeFetcher.goals) };
      if (second === "new") return { page: "newGoal" };
      const warm = () => requestRoute(routeKey.goal(second), routeFetcher.goal(second));
      if (third === "history") return { page: "goalHistory", warm };
      if (third === "edit") return { page: "newGoal", warm };
      return { page: "goalDetail", warm };
    }

    case "trips": {
      if (!second) return { page: "trips", warm: () => requestRoute(routeKey.trips, routeFetcher.trips) };
      if (second === "new") return { page: "newTrip" };
      const warm = () => requestRoute(routeKey.trip(second), routeFetcher.trip(second));
      if (third === "edit") return { page: "newTrip", warm };
      return { page: "tripDetail", warm };
    }

    default:
      return null;
  }
}

/** Warms the chunk and data for `pathname`. Safe to call repeatedly. */
export function prefetchPath(pathname: string): void {
  const target = resolve(pathname);
  if (!target) return;
  void pageModules[target.page]().catch(() => {});
  target.warm?.();
}

/**
 * Handlers to spread onto a `<Link>`. `onPointerDown` is the one that matters
 * on a phone; the hover and focus variants cover a mouse and a keyboard.
 */
export function prefetchOn(pathname: string) {
  const start = () => prefetchPath(pathname);
  return { onPointerDown: start, onPointerEnter: start, onFocus: start };
}

let warmed = false;

/**
 * Called once from the app shell, after the first page has rendered.
 *
 * Two jobs, both in idle time so neither competes with the page that's
 * actually on screen:
 *
 *  - Pull down every page chunk. All of them together are smaller than the
 *    shared vendor bundle the app has already downloaded, and it means no tab
 *    switch for the rest of the session ever waits on a chunk.
 *  - If the dashboard payload isn't cached yet, fetch it once. It normally
 *    already is — every signed-in entry point resolves through the same
 *    `/api/home` request (see dashboard.ts) — so this is the safety net for
 *    the case where that bootstrap failed, not the usual path.
 */
export function warmAppOnIdle(): void {
  if (warmed) return;
  warmed = true;

  // Data first — it's what a tap actually blocks on.
  afterIdle(800, () => {
    if (!hasRoute(routeKey.home)) requestRoute(routeKey.home, routeFetcher.home);
  });

  afterIdle(2000, () => {
    for (const load of Object.values(pageModules)) void load().catch(() => {});
  });
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
};

/**
 * Runs `task` no sooner than `delay`, and then at the next idle moment.
 *
 * The delay is the part that matters: requestIdleCallback's own `timeout` is a
 * deadline, not a floor, and the main thread counts as idle while the page's
 * own first request is still in flight — so calling it directly would have
 * these speculative fetches racing the data the visitor is actually waiting
 * for.
 */
function afterIdle(delay: number, task: () => void): void {
  window.setTimeout(() => {
    const idle = (window as IdleWindow).requestIdleCallback;
    if (idle) idle(task, { timeout: 2000 });
    else task();
  }, delay);
}
