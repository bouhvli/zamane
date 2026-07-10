import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { createBrowserRouter, redirect, Navigate } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { apiFetch } from "./lib/api";
import type { SessionUser } from "./lib/auth-context";
import { fetchGoals, fetchGoalDetail } from "./lib/goals-api";
import { fetchGroup } from "./lib/groups-api";
import { AppLayout } from "./components/layout/AppLayout";
import ComingSoonPage from "./pages/ComingSoonPage";
import tripsIcon from "./assets/icons/trips.svg?url";
import financeIcon from "./assets/icons/finance.svg?url";
import shoppingIcon from "./assets/icons/shopping.svg?url";

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
const NewGoalPage = lazy(() => import("./pages/NewGoalPage"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
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
  const [goalsData, groupData] = await Promise.all([fetchGoals(), fetchGroup()]);
  return { ...goalsData, ...groupData };
}

export const router = createBrowserRouter([
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
      { path: "/trips", element: <ComingSoonPage title="Trips" icon={tripsIcon} /> },
      { path: "/finance", element: <ComingSoonPage title="Finance" icon={financeIcon} /> },
      { path: "/shopping", element: <ComingSoonPage title="Shopping" icon={shoppingIcon} /> },
      { path: "/goals", loader: goalsListLoader, element: withSuspense(<GoalsPage />) },
      { path: "/goals/new", element: withSuspense(<NewGoalPage />) },
      { path: "/goals/:id", loader: goalDetailLoader, element: withSuspense(<GoalDetailPage />) },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
