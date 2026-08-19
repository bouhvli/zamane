import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { createBrowserRouter, redirect, Navigate, Outlet } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { ApiError } from "./lib/api";
import { getSessionUser } from "./lib/session";
import { fetchHome } from "./lib/home-api";
import { fetchGoals, fetchGoalDetail } from "./lib/goals-api";
import { fetchGroup } from "./lib/groups-api";
import { fetchTrips, fetchTripDetail } from "./lib/trips-api";
import { fetchShoppingItems } from "./lib/shopping-api";
import { AppLayout } from "./components/layout/AppLayout";
import { AppBootFallback } from "./components/layout/AppBootFallback";
import { RouteErrorBoundary } from "./components/layout/RouteErrorBoundary";
import { HomeSkeleton } from "./components/layout/Skeleton";

// Each auth screen and the home dashboard get their own chunk — on a
// mobile connection, the first paint (usually the login screen) shouldn't
// have to download every other page's code first.
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const OnboardingGroupPage = lazy(() => import("./pages/OnboardingGroupPage"));
const GoalsPage = lazy(() => import("./pages/GoalsPage"));
const GoalDetailPage = lazy(() => import("./pages/GoalDetailPage"));
const GoalHistoryPage = lazy(() => import("./pages/GoalHistoryPage"));
const NewGoalPage = lazy(() => import("./pages/NewGoalPage"));
const TripsPage = lazy(() => import("./pages/TripsPage"));
const TripDetailPage = lazy(() => import("./pages/TripDetailPage"));
const NewTripPage = lazy(() => import("./pages/NewTripPage"));
const ShoppingPage = lazy(() => import("./pages/ShoppingPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

// The gap while a route's own chunk downloads. A skeleton of the shape that's
// coming beats a centred spinner: the layout is already settled when the code
// lands, so nothing jumps.
function RouteFallback() {
  return (
    <div className="min-h-screen">
      <HomeSkeleton />
    </div>
  );
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

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

async function goalsListLoader() {
  return fetchGoals();
}

async function goalDetailLoader({ params }: LoaderFunctionArgs) {
  return fetchGoalDetail(params.id!);
}

async function homeLoader() {
  // One request for the whole dashboard (see api/home.ts). This used to be
  // four — goals and groups awaited together, trips and shopping streamed
  // behind <Await> — which on a cold start meant four separate function
  // invocations, any of which could draw Neon's compute wake.
  //
  // Trips and shopping are still handed to HomePage as promises so its
  // <Suspense>/<Await> sections keep working unchanged; they simply resolve on
  // the next microtask now instead of a second round trip later.
  let data;
  try {
    data = await fetchHome();
  } catch (error) {
    // Agree with requireGroupLoader, which is resolving the same question in
    // parallel: a 401 here means signed out, not a broken dashboard, so send
    // the visitor to /login rather than the route error boundary.
    if (error instanceof ApiError && error.status === 401) throw redirect("/login");
    throw error;
  }

  if (!data.user.groupId) throw redirect("/onboarding/group");

  return {
    goals: data.goals.goals,
    goalsSummary: data.goals.summary,
    group: data.group,
    trips: Promise.resolve(data.trips),
    shopping: Promise.resolve(data.shopping),
  };
}

async function tripsListLoader() {
  return fetchTrips();
}

async function tripDetailLoader({ params }: LoaderFunctionArgs) {
  return fetchTripDetail(params.id!);
}

async function shoppingListLoader() {
  return fetchShoppingItems();
}

async function profileLoader() {
  return fetchGroup();
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
    // rootLoader's session check on a cold serverless function).
    HydrateFallback: AppBootFallback,
    children: [
      { path: "/", loader: rootLoader },
      { path: "/login", loader: guestOnlyLoader, element: withSuspense(<LoginPage />) },
      { path: "/signup", loader: guestOnlyLoader, element: withSuspense(<SignupPage />) },
      { path: "/forgot-password", loader: guestOnlyLoader, element: withSuspense(<ForgotPasswordPage />) },
      { path: "/reset-password", loader: guestOnlyLoader, element: withSuspense(<ResetPasswordPage />) },
      { path: "/onboarding/group", loader: onboardingLoader, element: withSuspense(<OnboardingGroupPage />) },
      {
        element: <AppLayout />,
        loader: requireGroupLoader,
        children: [
          { path: "/home", loader: homeLoader, element: withSuspense(<HomePage />) },
          { path: "/trips", loader: tripsListLoader, element: withSuspense(<TripsPage />) },
          { path: "/trips/new", element: withSuspense(<NewTripPage />) },
          // Same page component as /trips/new, in edit mode — the dedicated
          // route id lets the page read this loader's trip via
          // useRouteLoaderData without colliding with the create route.
          { path: "/trips/:id/edit", id: "trip-edit", loader: tripDetailLoader, element: withSuspense(<NewTripPage />) },
          { path: "/trips/:id", loader: tripDetailLoader, element: withSuspense(<TripDetailPage />) },
          { path: "/shopping", loader: shoppingListLoader, element: withSuspense(<ShoppingPage />) },
          { path: "/goals", loader: goalsListLoader, element: withSuspense(<GoalsPage />) },
          { path: "/goals/new", element: withSuspense(<NewGoalPage />) },
          { path: "/goals/:id/edit", id: "goal-edit", loader: goalDetailLoader, element: withSuspense(<NewGoalPage />) },
          { path: "/goals/:id/history", loader: goalDetailLoader, element: withSuspense(<GoalHistoryPage />) },
          { path: "/goals/:id", loader: goalDetailLoader, element: withSuspense(<GoalDetailPage />) },
          { path: "/profile", loader: profileLoader, element: withSuspense(<ProfilePage />) },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
