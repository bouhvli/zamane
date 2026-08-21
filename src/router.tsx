import { createBrowserRouter, redirect, Navigate, Outlet } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { ApiError } from "./lib/api";
import { getSessionUser } from "./lib/session";
import { lazyPage } from "./lib/page-modules";
import { loadRoute, setRouteRevalidator } from "./lib/route-cache";
import { routeKey, routeFetcher } from "./lib/route-data";
import type { HomePayload } from "./lib/home-api";
import { AppLayout } from "./components/layout/AppLayout";
import { AppBootFallback } from "./components/layout/AppBootFallback";
import { RouteErrorBoundary } from "./components/layout/RouteErrorBoundary";

// `/` used to check the session and *then* redirect, which cost a full round
// trip before the destination route could even start loading its own data —
// and on a cold serverless start that first request is the one that pays
// Neon's compute wake (~3s, against ~50ms once warm). It now redirects
// straight to /home with no network at all: the guards on /home resolve the
// same question, and they resolve it in parallel with the dashboard's data
// instead of in front of it. A signed-out visitor is bounced on to /login by
// requireGroupLoader for the same single round trip it used to cost here.
function rootLoader() {
  throw redirect("/home");
}

async function guestOnlyLoader() {
  const user = await getSessionUser();
  if (user) throw redirect("/home");
  return null;
}

async function onboardingLoader() {
  const user = await getSessionUser();
  if (!user) throw redirect("/login");
  if (user.groupId) throw redirect("/home");
  return { user };
}

async function requireGroupLoader() {
  const user = await getSessionUser();
  if (!user) throw redirect("/login");
  if (!user.groupId) throw redirect("/onboarding/group");
  return { user };
}

// Every list loader below reads through the route cache: a payload already in
// memory is returned *synchronously*, so tapping a tab you've visited renders
// in the same frame instead of waiting on a serverless round trip, and a
// background refresh updates the screen only if the answer actually moved.
// See src/lib/route-cache.ts for how writes stay correct.
function goalsListLoader() {
  return loadRoute(routeKey.goals, routeFetcher.goals);
}

function goalDetailLoader({ params }: LoaderFunctionArgs) {
  const id = params.id!;
  return loadRoute(routeKey.goal(id), routeFetcher.goal(id));
}

function tripsListLoader() {
  return loadRoute(routeKey.trips, routeFetcher.trips);
}

function tripDetailLoader({ params }: LoaderFunctionArgs) {
  const id = params.id!;
  return loadRoute(routeKey.trip(id), routeFetcher.trip(id));
}

function shoppingListLoader() {
  return loadRoute(routeKey.shopping, routeFetcher.shopping);
}

function profileLoader() {
  return loadRoute(routeKey.group, routeFetcher.group);
}

// One request for the whole dashboard (see api/home.ts). This used to be
// four — goals and groups awaited together, trips and shopping streamed
// behind <Await> — which on a cold start meant four separate function
// invocations, any of which could draw Neon's compute wake.
//
// Trips and shopping are still handed to HomePage as promises so its
// <Suspense>/<Await> sections keep working unchanged; they simply resolve on
// the next microtask now instead of a second round trip later.
function toHomeRouteData(data: HomePayload) {
  if (!data.user.groupId) throw redirect("/onboarding/group");

  return {
    goals: data.goals.goals,
    goalsSummary: data.goals.summary,
    group: data.group,
    trips: Promise.resolve(data.trips),
    shopping: Promise.resolve(data.shopping),
  };
}

// Agree with requireGroupLoader, which is resolving the same question in
// parallel: a 401 here means signed out, not a broken dashboard, so send the
// visitor to /login rather than the route error boundary.
function onHomeError(error: unknown): never {
  if (error instanceof ApiError && error.status === 401) throw redirect("/login");
  throw error;
}

function homeLoader() {
  const result = loadRoute(routeKey.home, routeFetcher.home);
  return result instanceof Promise ? result.then(toHomeRouteData, onHomeError) : toHomeRouteData(result);
}

export const router = createBrowserRouter([
  {
    // A single shared boundary for every route below — without it, any
    // loader throw (a 500, a dropped connection, a session that expired
    // mid-visit) crashed straight to React Router's unstyled default
    // error screen instead of anything this app controls.
    element: <Outlet />,
    errorElement: <RouteErrorBoundary />,
    // Rendered in place of the whole tree until the first matched route's
    // loader(s) resolve — covers the blank gap on initial app load (e.g. the
    // session check on a cold serverless function).
    HydrateFallback: AppBootFallback,
    children: [
      { path: "/", loader: rootLoader },
      // Each page is its own chunk, declared with `lazy` rather than a lazy
      // `element`. React Router runs `lazy` *concurrently* with the route's
      // loader; a lazily rendered element could only start downloading once
      // the loader had already resolved, so a first visit paid for the data
      // and then the code, back to back. src/lib/prefetch.ts pulls these down
      // ahead of time anyway, which is what removes the wait entirely.
      { path: "/login", loader: guestOnlyLoader, lazy: lazyPage("login") },
      { path: "/signup", loader: guestOnlyLoader, lazy: lazyPage("signup") },
      { path: "/forgot-password", loader: guestOnlyLoader, lazy: lazyPage("forgotPassword") },
      { path: "/reset-password", loader: guestOnlyLoader, lazy: lazyPage("resetPassword") },
      { path: "/onboarding/group", loader: onboardingLoader, lazy: lazyPage("onboardingGroup") },
      {
        element: <AppLayout />,
        loader: requireGroupLoader,
        children: [
          { path: "/home", loader: homeLoader, lazy: lazyPage("home") },
          { path: "/trips", loader: tripsListLoader, lazy: lazyPage("trips") },
          { path: "/trips/new", lazy: lazyPage("newTrip") },
          // Same page component as /trips/new, in edit mode — the dedicated
          // route id lets the page read this loader's trip via
          // useRouteLoaderData without colliding with the create route.
          { path: "/trips/:id/edit", id: "trip-edit", loader: tripDetailLoader, lazy: lazyPage("newTrip") },
          { path: "/trips/:id", loader: tripDetailLoader, lazy: lazyPage("tripDetail") },
          { path: "/shopping", loader: shoppingListLoader, lazy: lazyPage("shopping") },
          { path: "/goals", loader: goalsListLoader, lazy: lazyPage("goals") },
          { path: "/goals/new", lazy: lazyPage("newGoal") },
          { path: "/goals/:id/edit", id: "goal-edit", loader: goalDetailLoader, lazy: lazyPage("newGoal") },
          { path: "/goals/:id/history", loader: goalDetailLoader, lazy: lazyPage("goalHistory") },
          { path: "/goals/:id", loader: goalDetailLoader, lazy: lazyPage("goalDetail") },
          { path: "/profile", loader: profileLoader, lazy: lazyPage("profile") },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

// Lets a background refresh push newer data onto the screen. Registered from
// here because route-cache.ts can't import the router without closing a cycle.
setRouteRevalidator(() => {
  void router.revalidate();
});
