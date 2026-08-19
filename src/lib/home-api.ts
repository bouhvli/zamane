import { apiFetch } from "./api";
import { primeSessionUser, type SessionUser } from "./session";
import type { Goal, GoalsSummary } from "./goals-api";
import type { Group } from "./groups-api";
import type { Trip, TripsSummary } from "./trips-api";
import type { ShoppingItem, ShoppingSummary } from "./shopping-api";

export type HomePayload = {
  user: SessionUser;
  group: Group | null;
  goals: { goals: Goal[]; summary: GoalsSummary };
  trips: { trips: Trip[]; summary: TripsSummary };
  shopping: { items: ShoppingItem[]; summary: ShoppingSummary };
};

/**
 * The whole dashboard in one round trip — see api/home.ts for why. The session
 * cache is primed from the response so the layout's group guard and
 * AuthProvider never issue their own `/api/auth/session` request on a cold
 * launch.
 */
export async function fetchHome(): Promise<HomePayload> {
  const data = await apiFetch<HomePayload>("/api/home");
  primeSessionUser(data.user);
  return data;
}
