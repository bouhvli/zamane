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
 * The order the page chunks are pulled in.
 *
 * They are fetched one at a time (see `pullPageChunks`), so order decides what
 * is ready first — and the object literal's own order was close to the worst
 * one available: the four auth screens came first, which a signed-in visitor
 * has already walked past and will most likely never see again, while the tabs
 * under their thumb waited behind them.
 *
 * Anything missing from this list is appended, so adding a page to
 * pageModules can never silently drop it out of the warm-up.
 */
const WARM_ORDER: PageKey[] = [
  // The tab bar first — these are one tap away at all times.
  "goals",
  "trips",
  "shopping",
  "profile",
  // Then what a tap on a card opens.
  "goalDetail",
  "tripDetail",
  "goalHistory",
  // Then the forms behind the FABs.
  "newGoal",
  "newTrip",
  // Already loaded in the common case; free when it is.
  "home",
  // Last: only reachable once this session has ended.
  "login",
  "signup",
  "forgotPassword",
  "resetPassword",
  "onboardingGroup",
];

/**
 * Called once from the app shell, after the first page has rendered.
 *
 * Two jobs, both deferred so neither competes with the page that's actually on
 * screen:
 *
 *  - Pull down every page chunk, so no tab switch for the rest of the session
 *    waits on one.
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

  afterIdle(2000, pullPageChunks);
}

/**
 * Pulls the page chunks down one at a time, each in its own idle slot.
 *
 * This used to be a single loop firing all fifteen imports at once. On a
 * browser with requestIdleCallback that is survivable — the scheduler
 * interleaves them with whatever else the main thread has to do. Safari has no
 * requestIdleCallback at all, so the fallback below ran the loop straight
 * through, and ~250kB of JavaScript was fetched, parsed and evaluated in one
 * uninterrupted stretch about two seconds after launch: precisely when someone
 * is reaching for their first tab. Measured on the built app, a tap landing in
 * that window cost 92ms in WebKit against 27ms in Chromium, and a phone's CPU
 * multiplies the gap rather than closing it.
 *
 * Waiting for each import to settle before starting the next serialises the
 * downloads too, which makes the whole warm-up finish later. That is the right
 * trade: this is speculative work with no one waiting on it, and the only thing
 * it must never do is stand between a tap and its page.
 */
function pullPageChunks(): void {
  const queue: PageKey[] = [
    ...WARM_ORDER,
    ...(Object.keys(pageModules) as PageKey[]).filter((key) => !WARM_ORDER.includes(key)),
  ];

  const next = () => {
    const key = queue.shift();
    if (!key) return;
    void pageModules[key]()
      .catch(() => {})
      .finally(() => whenIdle(next));
  };

  whenIdle(next);
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
};

/**
 * Hands `task` to the browser's idle scheduler, or to the closest honest
 * equivalent where there isn't one.
 *
 * The fallback used to call `task()` directly, which is the opposite of what
 * the name promises: it runs the work *now*, in the caller's own task, ahead of
 * anything already queued. A macrotask instead lets the browser finish what it
 * has in hand — delivering a tap, committing a navigation — before this starts.
 */
function whenIdle(task: () => void): void {
  const idle = (window as IdleWindow).requestIdleCallback;
  if (idle) idle(task, { timeout: 2000 });
  else window.setTimeout(task, 0);
}

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
  window.setTimeout(() => whenIdle(task), delay);
}
