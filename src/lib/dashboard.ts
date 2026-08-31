/**
 * One request for the whole signed-in app.
 *
 * `/api/home` already returns everything the five tabs need — the user, the
 * group with its members, goals, trips and the shopping list (see api/home.ts).
 * Every other consumer of that data now comes through here, for one reason:
 * the Neon instance suspends when idle and the *first* query after that pays
 * the compute wake, measured at ~3s against ~50ms once warm. So the number of
 * requests that can independently draw that penalty is the number worth
 * minimising, and this makes it one.
 *
 * Before, a cold launch on /goals cost two round trips in series —
 * `/api/auth/session` for the layout's group guard, then `/api/goals/list` for
 * the page — and measured 3.9s to content. Both callers now await this single
 * promise, so it costs one request and one possible cold start, and the four
 * other tabs come back warm in the same response.
 */
import { apiFetch } from "./api";
import { primeRoute, routeGeneration } from "./route-cache";
import { routeKey } from "./route-keys";
import type { HomePayload } from "./home-api";

/**
 * The in-flight request, shared by everyone who asks while it is running. This
 * is what collapses the session guard and the page's own data need into one
 * network call rather than two. Cleared on settle so a later refresh (or a
 * retry after a failure) goes to the network again — staying fresh is the route
 * store's job, not this module's.
 *
 * The generation it started in is kept with it, because de-duplication and
 * writes interact badly without it: a request that began before a write
 * describes the world before that write. Handing it to a caller who asked
 * *after* the write — or filing its answer as current — would quietly undo the
 * write on screen until the next refresh. So a stale-generation request is
 * neither reused nor seeded; it is left to the caller that originally wanted it,
 * where the store's own generation check drops it.
 */
let inFlight: { promise: Promise<HomePayload>; generation: number } | null = null;

export function fetchDashboard(): Promise<HomePayload> {
  const generation = routeGeneration();
  if (inFlight && inFlight.generation === generation) return inFlight.promise;

  const promise = apiFetch<HomePayload>("/api/home")
    .then((data) => {
      if (routeGeneration() === generation) seed(data);
      return data;
    })
    .finally(() => {
      if (inFlight?.promise === promise) inFlight = null;
    });

  inFlight = { promise, generation };
  return promise;
}

/**
 * Files one dashboard response into all five tab entries.
 *
 * Without this the payload was thrown away after the dashboard rendered, so
 * the first tap on Trips fetched trips that were already sitting in memory.
 *
 * The shape is checked before *anything* is written, because this function
 * writes five entries in sequence and a throw partway through used to leave the
 * store in a state no code path could produce deliberately: the dashboard entry
 * already overwritten with `undefined`, the other four still holding good data.
 * The page then read `undefined`, and the TypeError from the aborted seed was
 * sitting on the entry as its error, so the visitor got the full-screen error
 * boundary instead of the screen they already had.
 */
function seed(data: HomePayload): void {
  if (!isDashboard(data)) {
    throw new Error("Malformed /api/home response — not seeding the route store");
  }
  primeRoute(routeKey.home, data);
  primeRoute(routeKey.goals, data.goals);
  primeRoute(routeKey.trips, data.trips);
  primeRoute(routeKey.shopping, data.shopping);
  primeRoute(routeKey.group, { group: data.group });
}

/** The four sections every tab reads out of one response, plus the user. */
function isDashboard(data: unknown): data is HomePayload {
  if (typeof data !== "object" || data === null) return false;
  const payload = data as Partial<HomePayload>;
  return (
    typeof payload.user === "object" &&
    payload.user !== null &&
    typeof payload.goals === "object" &&
    payload.goals !== null &&
    typeof payload.trips === "object" &&
    payload.trips !== null &&
    typeof payload.shopping === "object" &&
    payload.shopping !== null
  );
}
