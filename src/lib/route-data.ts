/**
 * The fetcher behind each route, shared by the loaders in router.tsx and the
 * link prefetcher in prefetch.ts so both warm and read the exact same entry.
 *
 * The four tab fetchers all resolve from one `/api/home` request rather than
 * from `/api/goals/list`, `/api/trips/list` and friends — see dashboard.ts for
 * why one request is worth this much. The per-tab endpoints still exist on the
 * server; nothing on the client asks for them any more.
 */
import { fetchDashboard } from "./dashboard";
import { fetchGoalDetail } from "./goals-api";
import { fetchTripDetail } from "./trips-api";
import { requestRoute, setRouteResync } from "./route-cache";
import { routeKey } from "./route-keys";

export { routeKey };

export const routeFetcher = {
  home: fetchDashboard,
  goals: () => fetchDashboard().then((data) => data.goals),
  trips: () => fetchDashboard().then((data) => data.trips),
  shopping: () => fetchDashboard().then((data) => data.shopping),
  group: () => fetchDashboard().then((data) => ({ group: data.group })),
  goal: (id: string) => () => fetchGoalDetail(id),
  trip: (id: string) => () => fetchTripDetail(id),
} as const;

// How the store catches up after a write. Registered from here because the
// store can't import these fetchers without closing an import cycle, and it is
// `/api/home` on purpose: one request puts goals, trips, shopping and the group
// all back in hand, so a mutation costs one refresh rather than one per tab.
setRouteResync(() => {
  requestRoute(routeKey.home, routeFetcher.home);
});
