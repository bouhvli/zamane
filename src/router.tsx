import { createBrowserRouter, redirect, Navigate, Outlet } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { getSessionUser } from "./lib/session";
import { lazyPage } from "./lib/page-modules";
import { routeHandle } from "./lib/route-cache";
import { routeKey, routeFetcher } from "./lib/route-data";
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

// The one loader in the app that still awaits the network, and it has to: the
// answer decides whether this visitor may see the shell at all. It resolves
// from the same `/api/home` request the page's own data comes from, so waiting
// on it costs no extra round trip — see dashboard.ts.
async function requireGroupLoader() {
  const user = await getSessionUser();
  if (!user) throw redirect("/login");
  if (!user.groupId) throw redirect("/onboarding/group");
  return { user };
}

// Every data loader below returns *immediately*, with a key rather than a
// payload (see route-cache.ts). React Router blocks a navigation on its
// loaders, so awaiting the data here is what used to freeze the previous page
// on screen for the length of a serverless round trip — 3.2s measured on a
// cold cache, which is any tap after a write. The page reads the entry with
// `useRouteData`, renders it the moment it exists, and shows a skeleton until
// then; the navigation itself is never waiting on the network.
function goalsListLoader() {
  return routeHandle(routeKey.goals, routeFetcher.goals);
}

function goalDetailLoader({ params }: LoaderFunctionArgs) {
  const id = params.id!;
  return routeHandle(routeKey.goal(id), routeFetcher.goal(id));
}

function tripsListLoader() {
  return routeHandle(routeKey.trips, routeFetcher.trips);
}

function tripDetailLoader({ params }: LoaderFunctionArgs) {
  const id = params.id!;
  return routeHandle(routeKey.trip(id), routeFetcher.trip(id));
}

function shoppingListLoader() {
  return routeHandle(routeKey.shopping, routeFetcher.shopping);
}

function profileLoader() {
  return routeHandle(routeKey.group, routeFetcher.group);
}

function homeLoader() {
  return routeHandle(routeKey.home, routeFetcher.home);
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
          // useRouteDataFor without colliding with the create route.
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
