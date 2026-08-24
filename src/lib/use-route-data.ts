/**
 * How a page reads the payload its route asked for.
 *
 * The loaders in router.tsx no longer await anything — they start a fetch and
 * hand back a key (see `routeHandle` in route-cache.ts), so a navigation always
 * resolves inside one frame. That moves one job onto the page: the data may not
 * be there on the first render, and the page has to say so.
 *
 * `undefined` means "not here yet" and is the page's cue to render its
 * skeleton. It is never a *failure* — a fetch that failed with nothing to show
 * instead is thrown from here, which lands in the route's errorElement
 * (RouteErrorBoundary), exactly where a loader throw used to land.
 */
import { useSyncExternalStore } from "react";
import { useLoaderData, useRouteLoaderData } from "react-router";

import {
  readRoute,
  routeActivity,
  subscribeRouteActivity,
  subscribeRoutes,
  type RouteHandle,
  type RouteState,
} from "./route-cache";

const NOTHING: RouteState = Object.freeze({ data: undefined, error: null });

/** The payload for the route being rendered, or `undefined` until it lands. */
export function useRouteData<T>(): T | undefined {
  return useHandle<T>(useLoaderData() as RouteHandle<T>);
}

/**
 * The same, for a route other than the one being rendered — NewGoalPage and
 * NewTripPage share one component between "create" and "edit", and read the
 * edit route's entry by id.
 */
export function useRouteDataFor<T>(routeId: string): T | undefined {
  return useHandle<T>(useRouteLoaderData(routeId) as RouteHandle<T> | undefined);
}

function useHandle<T>(handle: RouteHandle<T> | undefined): T | undefined {
  const key = handle?.routeKey;
  const state = useSyncExternalStore(subscribeRoutes, () =>
    key === undefined ? (NOTHING as RouteState<T>) : readRoute<T>(key),
  );

  // Nothing to show and a reason why — hand it to the route's error boundary.
  if (state.data === undefined && state.error != null) throw state.error;

  return state.data;
}

/**
 * How many route fetches are in flight.
 *
 * The shell used to take this from `navigation.state`, which no longer means
 * what it used to: the loaders don't await their data, so the router reports
 * "idle" the instant a tab commits and says nothing about the request still
 * running behind it. This is the honest signal — and it covers the one case
 * with no other feedback on screen, where a page is rendering perfectly good
 * data while a refresh quietly disagrees with it.
 */
export function useRouteSyncing(): boolean {
  return useSyncExternalStore(subscribeRouteActivity, routeActivity) > 0;
}
