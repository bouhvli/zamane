/**
 * The cache keys and fetchers behind each route, shared by the loaders in
 * router.tsx and the link prefetcher in prefetch.ts so both warm and read the
 * exact same entry.
 */
import { fetchHome, type HomePayload } from "./home-api";
import { fetchGoals, fetchGoalDetail } from "./goals-api";
import { fetchGroup } from "./groups-api";
import { fetchTrips, fetchTripDetail } from "./trips-api";
import { fetchShoppingItems } from "./shopping-api";
import { primeRoute } from "./route-cache";

export const routeKey = {
  home: "home",
  goals: "goals",
  trips: "trips",
  shopping: "shopping",
  group: "group",
  goal: (id: string) => `goal:${id}`,
  trip: (id: string) => `trip:${id}`,
} as const;

/**
 * `/api/home` already returns everything the four other tabs ask their own
 * endpoints for — goals, trips, shopping and the group with its members. It
 * was being thrown away after the dashboard rendered, so the first tap on
 * Trips fetched trips that were sitting in memory already.
 *
 * Seeding their caches from this one response is what makes the first tab
 * switch after a launch cost no network at all.
 */
export async function fetchHomeAndSeed(): Promise<HomePayload> {
  const data = await fetchHome();

  primeRoute(routeKey.goals, data.goals);
  primeRoute(routeKey.trips, data.trips);
  primeRoute(routeKey.shopping, data.shopping);
  primeRoute(routeKey.group, { group: data.group });

  return data;
}

export const routeFetcher = {
  home: fetchHomeAndSeed,
  goals: fetchGoals,
  trips: fetchTrips,
  shopping: fetchShoppingItems,
  group: fetchGroup,
  goal: (id: string) => () => fetchGoalDetail(id),
  trip: (id: string) => () => fetchTripDetail(id),
} as const;
