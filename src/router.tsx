import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { createBrowserRouter, redirect, Navigate, Outlet } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { apiFetch } from "./lib/api";
import type { SessionUser } from "./lib/auth-context";
import { fetchGoals, fetchGoalDetail } from "./lib/goals-api";
import { fetchGroup } from "./lib/groups-api";
import { fetchTrips, fetchTripDetail } from "./lib/trips-api";
import { fetchShoppingItems } from "./lib/shopping-api";
import { AppLayout } from "./components/layout/AppLayout";
import { AppBootFallback } from "./components/layout/AppBootFallback";
import { RouteErrorBoundary } from "./components/layout/RouteErrorBoundary";
import { Loader } from "./components/Loader";

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

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader size={40} />
    </div>
  );
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const data = await apiFetch<{ user: SessionUser | null }>("/api/auth/session");
    return data.user;
  } catch {
    return null;
  }
}

async function rootLoader() {
  const user = await getSessionUser();
  throw redirect(user ? "/home" : "/login");
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
  // All four requests start together, but only the two the first viewport
  // actually needs are awaited: the hero's savings figure and the Goals
  // preview. Trips and Shopping stream in behind <Await> with skeletons, so
  // the dashboard no longer blocks its whole first paint on the slowest of
  // four round-trips (Doherty threshold — perceived response under 400ms).
  //
  // A second benefit: a failing trips or shopping request now degrades to that
  // one section's error slot instead of throwing the entire dashboard to the
  // route error boundary.
  const trips = fetchTrips();
  const shopping = fetchShoppingItems();
  // Nothing else awaits these two, so an early rejection would surface as an
  // unhandled rejection before <Await> ever subscribes. Park a no-op catch on
  // each; <Await> still sees the original rejected promise and renders its
  // errorElement.
  trips.catch(() => {});
  shopping.catch(() => {});

  const [goalsData, groupData] = await Promise.all([fetchGoals(), fetchGroup()]);

  return {
    goals: goalsData.goals,
    goalsSummary: goalsData.summary,
    group: groupData.group,
    trips,
    shopping,
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
