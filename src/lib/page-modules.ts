/**
 * Every code-split page, in one place.
 *
 * Two callers need the *same* dynamic import specifier: router.tsx, which
 * hands it to a route's `lazy`, and prefetch.ts, which fires it early on link
 * intent and during idle time. Sharing the module means both resolve to one
 * Vite chunk and one entry in the module registry, so a prefetched page is
 * genuinely already loaded when the router asks for it rather than a second
 * download of the same bytes.
 */
import type { ComponentType } from "react";

type PageModule = () => Promise<{ default: ComponentType }>;

export const pageModules = {
  login: () => import("../pages/LoginPage"),
  signup: () => import("../pages/SignupPage"),
  forgotPassword: () => import("../pages/ForgotPasswordPage"),
  resetPassword: () => import("../pages/ResetPasswordPage"),
  onboardingGroup: () => import("../pages/OnboardingGroupPage"),
  home: () => import("../pages/HomePage"),
  goals: () => import("../pages/GoalsPage"),
  goalDetail: () => import("../pages/GoalDetailPage"),
  goalHistory: () => import("../pages/GoalHistoryPage"),
  newGoal: () => import("../pages/NewGoalPage"),
  trips: () => import("../pages/TripsPage"),
  tripDetail: () => import("../pages/TripDetailPage"),
  newTrip: () => import("../pages/NewTripPage"),
  shopping: () => import("../pages/ShoppingPage"),
  profile: () => import("../pages/ProfilePage"),
} satisfies Record<string, PageModule>;

export type PageKey = keyof typeof pageModules;

/**
 * Adapts a page module to a route's `lazy`. React Router runs `lazy` and a
 * statically declared `loader` concurrently, which is the whole point of using
 * it here: with `element: <Suspense><Lazy/></Suspense>` the chunk download
 * only *started* once the loader had already resolved, so a first visit paid
 * for the data and then the code, one after the other.
 */
export function lazyPage(key: PageKey) {
  return async () => ({ Component: (await pageModules[key]()).default });
}
