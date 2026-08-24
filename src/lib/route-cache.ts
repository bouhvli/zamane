/**
 * The store every route renders from — stale-while-revalidate, and
 * deliberately *outside* the router.
 *
 * The problem it solves has two halves.
 *
 * `createBrowserRouter` blocks a navigation on its loaders. Tapping a tab fired
 * a request to a serverless function, which queried Neon, which answered, and
 * only then did the next screen mount. Measured on the built app: a tab switch
 * with a warm cache landed in ~90-240ms, but the same tap with nothing cached —
 * a fresh launch, a reload on a detail page, or *any* mutation, because a write
 * used to clear the whole cache — sat at 3.2s with the previous page frozen on
 * screen the entire time.
 *
 * So the loaders stopped awaiting anything. They call `requestRoute` and return
 * a key (see `routeHandle`), which makes every navigation resolve inside one
 * frame whether or not the data is there. Pages read the payload out of this
 * store with `useRouteData`, render it the moment it exists, and show their own
 * skeleton until then. The router now decides *what* is on screen; this decides
 * *when the data arrives*, and the two no longer wait on each other.
 *
 * Two properties make that safe:
 *
 *  1. The observable half of an entry is only `data` and `error`, and its
 *     object identity changes only when one of those actually moves. A
 *     background refresh that agrees with what's on screen costs zero
 *     re-renders. `at`/`stale` bookkeeping lives in `meta` for exactly this
 *     reason — it changes on every refresh and no subscriber should care.
 *
 *  2. A refresh that was in flight when a mutation landed is dropped rather
 *     than written back (see `generation`), so it can't resurrect pre-mutation
 *     data on top of a post-mutation read.
 */

/** What a page sees. See property 1 above for why it is only these two fields. */
export type RouteState<T = unknown> = { data: T | undefined; error: unknown };

/** A loader's return value: which entry the page should render. */
export type RouteHandle<T> = { routeKey: string; __type?: T };

const EMPTY: RouteState = Object.freeze({ data: undefined, error: null });

/**
 * How long a payload is served without also refreshing behind it. Short enough
 * that a partner's change shows up on the next tab switch; long enough that
 * flicking between tabs doesn't re-query on every tap.
 */
const FRESH_MS = 20_000;

/** The observable half — exactly what `useRouteData` renders from. */
const cache = new Map<string, RouteState>();
/** The unobserved half. Kept apart so refresh bookkeeping can't cause renders. */
const meta = new Map<string, { at: number; stale: boolean }>();
const inFlight = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();

/** Bumped by every invalidation — see property 2 above. */
let generation = 0;

/** How many route fetches are in flight, for the shell's sync indicator. */
let active = 0;
const activityListeners = new Set<() => void>();

let resync: (() => void) | null = null;
let resyncTimer: ReturnType<typeof setTimeout> | null = null;

/* ------------------------------------------------------------------ reading */

export function subscribeRoutes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The snapshot for `key`. Returns a stable object identity until the entry's
 * data or error changes, which is what `useSyncExternalStore` requires of it.
 */
export function readRoute<T>(key: string): RouteState<T> {
  return (cache.get(key) ?? EMPTY) as RouteState<T>;
}

/** True if `key` can be rendered without waiting for the network. */
export function hasRoute(key: string): boolean {
  return cache.get(key)?.data !== undefined;
}

export function subscribeRouteActivity(listener: () => void): () => void {
  activityListeners.add(listener);
  return () => {
    activityListeners.delete(listener);
  };
}

/** Non-zero while any route fetch is in flight. */
export function routeActivity(): number {
  return active;
}

/**
 * How many writes have happened. A read that started at generation N and lands
 * at generation N+1 describes the world before a write and must not be filed as
 * the current answer — `refresh` enforces that for everything it fetches, and
 * dashboard.ts needs the same test because it de-duplicates its own request
 * behind this store's back.
 */
export function routeGeneration(): number {
  return generation;
}

/* ------------------------------------------------------------------ writing */

function emit(): void {
  for (const listener of listeners) listener();
}

function put(key: string, next: RouteState): void {
  const current = cache.get(key) ?? EMPTY;
  if (current.data === next.data && current.error === next.error) return;
  cache.set(key, next);
  emit();
}

function markFresh(key: string): void {
  meta.set(key, { at: Date.now(), stale: false });
}

/**
 * Records a payload fetched by someone else — see the `/api/home` seeding in
 * route-data.ts, which is what makes every tab instant off one request.
 */
export function primeRoute<T>(key: string, data: T): void {
  markFresh(key);
  store(key, data);
}

/**
 * Writes a freshly fetched payload, keeping the identity already in hand when
 * the answer hasn't actually moved — identity is what decides whether every
 * subscriber re-renders, so an agreeing refresh must cost nothing.
 */
function store<T>(key: string, data: T): void {
  const current = cache.get(key);
  if (current && current.error === null && current.data !== undefined && sameData(current.data, data)) return;
  put(key, { data, error: null });
}

/**
 * The loader entry point. Makes sure `key` has data on its way and returns a
 * handle *synchronously* — nothing here ever awaits, which is what keeps a
 * navigation inside a single frame even on a cold cache.
 */
export function routeHandle<T>(key: string, fetcher: () => Promise<T>): RouteHandle<T> {
  requestRoute(key, fetcher);
  return { routeKey: key };
}

/** Starts a fetch for `key` unless a fresh answer is already in hand. */
export function requestRoute<T>(key: string, fetcher: () => Promise<T>): void {
  const bookkeeping = meta.get(key);
  const fresh =
    hasRoute(key) && bookkeeping !== undefined && !bookkeeping.stale && Date.now() - bookkeeping.at < FRESH_MS;
  if (fresh) return;
  // Detached on purpose: a failed refresh must not turn a page that is already
  // rendering fine into the error boundary. `refresh` records the error on the
  // entry when there is nothing to show instead, and the page surfaces it.
  void refresh(key, fetcher).catch(() => {});
}

function refresh<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const startedAt = generation;
  beginActivity();

  const promise = fetcher()
    .then((data) => {
      // A mutation landed while this was in flight — the answer describes the
      // world before the write, so keep it out of the store.
      if (startedAt !== generation) return data;
      markFresh(key);
      store(key, data);
      return data;
    })
    .catch((error: unknown) => {
      // Only surface a failure when there is nothing to show instead; a
      // background refresh that fails should leave the screen alone.
      if (startedAt === generation && !hasRoute(key)) put(key, { data: undefined, error });
      throw error;
    })
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
      endActivity();
    });

  inFlight.set(key, promise);
  return promise;
}

/* ------------------------------------------------------------ invalidation */

/**
 * Called after every write (see api.ts).
 *
 * This used to clear the store outright, which is what made the app feel slow
 * in ordinary use rather than only on a cold launch: ticking one shopping item
 * emptied goals, trips, the group and the dashboard too, so the next tab tap
 * paid a full round trip — 3.2s measured, against 90ms warm.
 *
 * Nothing is dropped now. Every entry is marked stale, which means it is still
 * handed to the page instantly and refetched behind it. That is the same
 * guarantee the pages already had from `revalidator.revalidate()`, which has
 * always kept the current screen up while it refetched; it now extends to the
 * tabs the visitor hasn't opened yet.
 *
 * One `/api/home` follows, debounced, because that single response re-seeds
 * goals, trips, shopping and the group at once — so the post-write refresh
 * costs one request rather than one per tab.
 */
export function invalidateRoutes(): void {
  generation += 1;
  inFlight.clear();
  for (const bookkeeping of meta.values()) bookkeeping.stale = true;
  scheduleResync();
}

/**
 * Forgets everything. Used on sign-in and sign-out, where keeping the previous
 * answer on screen is not a staleness trade-off but the wrong account's data.
 */
export function resetRoutes(): void {
  generation += 1;
  inFlight.clear();
  meta.clear();
  if (cache.size === 0) return;
  cache.clear();
  emit();
}

/**
 * Registered by route-data.ts, which owns the fetchers (importing them here
 * would close an import cycle).
 */
export function setRouteResync(refetchDashboard: () => void): void {
  resync = refetchDashboard;
}

// Debounced so a run of quick writes — ticking four things off the shopping
// list — costs one refresh rather than four.
function scheduleResync(): void {
  if (!resync) return;
  if (resyncTimer !== null) clearTimeout(resyncTimer);
  resyncTimer = setTimeout(() => {
    resyncTimer = null;
    resync?.();
  }, 250);
}

/* ---------------------------------------------------------------- internals */

function beginActivity(): void {
  active += 1;
  for (const listener of activityListeners) listener();
}

function endActivity(): void {
  active -= 1;
  for (const listener of activityListeners) listener();
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
