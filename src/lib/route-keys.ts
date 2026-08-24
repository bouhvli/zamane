/**
 * The cache key for each route, in a module of its own so both the store
 * (route-cache.ts), the dashboard bootstrap (dashboard.ts) and the fetchers
 * (route-data.ts) can name the same entry without any of them importing each
 * other.
 */
export const routeKey = {
  home: "home",
  goals: "goals",
  trips: "trips",
  shopping: "shopping",
  group: "group",
  goal: (id: string) => `goal:${id}`,
  trip: (id: string) => `trip:${id}`,
} as const;
