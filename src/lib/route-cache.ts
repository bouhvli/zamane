/**
 * A stale-while-revalidate cache sitting in front of every route loader.
 *
 * `createBrowserRouter` *blocks* a navigation on its loaders: tapping a tab
 * fires a request to a serverless function, which queries Neon, which answers,
 * and only then does the next screen mount. Nothing is on screen in the
 * meantime except the previous page and a spinner — which is exactly the gap
 * between the tap and the page appearing.
 *
 * Nothing about that round trip is needed to *show* a page the visitor has
 * already seen. So: the last payload for each route is kept here and returned
 * synchronously on the next visit, with a background refresh behind it. The
 * navigation costs zero network; the fresh answer arrives a moment later and
 * only re-renders if it actually differs.
 *
 * Correctness rests on two rules:
 *
 *  1. Every mutation clears the whole cache (`api.ts` calls
 *     `invalidateRoutes` on any non-GET request). The pages already call
 *     `revalidator.revalidate()` after mutating, and that revalidation now
 *     finds an empty cache and goes to the network — so a write is never read
 *     back stale.
 *  2. A refresh that was already in flight when a mutation landed is dropped
 *     rather than written back (see `generation`), so it can't resurrect
 *     pre-mutation data on top of the post-mutation read.
 */

type Entry = { data: unknown; at: number };

/**
 * How long a cached payload is handed out without also refreshing behind it.
 * Short enough that a partner's change shows up on the next tab switch;
 * long enough that flicking between tabs doesn't re-query on every tap.
 */
const FRESH_MS = 20_000;

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();

/** Bumped by every invalidation — see rule 2 above. */
let generation = 0;

let revalidateRouter: (() => void) | null = null;

/**
 * Registered by router.tsx once the router exists (importing it here would
 * close an import cycle). Called when a background refresh finds new data, so
 * the loaders re-run and the screen catches up.
 */
export function setRouteRevalidator(revalidate: () => void): void {
  revalidateRouter = revalidate;
}

/**
 * Records a payload fetched by someone else — see `/api/home` seeding in
 * route-data.ts. If this *replaces* a different answer, the router is nudged
 * for the same reason a background refresh nudges it: a tab currently on
 * screen may be rendering the old one.
 */
export function primeRoute<T>(key: string, data: T): void {
  const previous = cache.get(key);
  cache.set(key, { data, at: Date.now() });
  if (previous && !sameData(previous.data, data)) revalidateRouter?.();
}

/** True if `key` can be served without touching the network. */
export function hasRoute(key: string): boolean {
  return cache.has(key);
}

/** Drops everything. Called on every mutation and on sign-in/sign-out. */
export function invalidateRoutes(): void {
  cache.clear();
  inFlight.clear();
  generation += 1;
}

/**
 * The loader entry point. Returns the cached payload *synchronously* when
 * there is one — a loader may return a plain value, and doing so is what keeps
 * the navigation inside a single frame instead of a network round trip.
 */
export function loadRoute<T>(key: string, fetcher: () => Promise<T>): T | Promise<T> {
  const hit = cache.get(key);
  if (hit) {
    if (Date.now() - hit.at > FRESH_MS) {
      // Deliberately detached: a failed background refresh must not turn a
      // page that is already rendering fine into the error boundary.
      void refresh(key, fetcher).catch(() => {});
    }
    return hit.data as T;
  }
  return refresh(key, fetcher);
}

/** Warms `key` without caring about the answer — used by link prefetching. */
export function warmRoute<T>(key: string, fetcher: () => Promise<T>): void {
  if (cache.has(key) || inFlight.has(key)) return;
  void refresh(key, fetcher).catch(() => {});
}

function refresh<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const startedAt = generation;
  const promise = fetcher()
    .then((data) => {
      // A mutation landed while this was in flight — the answer describes the
      // world before the write, so keep it out of the cache.
      if (startedAt !== generation) return data;

      const previous = cache.get(key);
      cache.set(key, { data, at: Date.now() });

      // Only disturb the router when the answer actually moved. A background
      // refresh that agrees with what's on screen should cost nothing.
      if (previous && !sameData(previous.data, data)) revalidateRouter?.();

      return data;
    })
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

// These payloads are small JSON lists, so stringify is both cheap and exact —
// there is no shared identity between two responses to compare structurally.
function sameData(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
