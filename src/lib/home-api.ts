import type { SessionUser } from "./session";
import type { Goal, GoalsSummary } from "./goals-api";
import type { Group } from "./groups-api";
import type { Trip, TripsSummary } from "./trips-api";
import type { ShoppingItem, ShoppingSummary } from "./shopping-api";

/**
 * What `/api/home` answers with: the whole signed-in app in one response.
 *
 * The request itself lives in dashboard.ts, which de-duplicates it and files
 * the pieces into each tab's cache entry. This module is the shape only.
 */
export type HomePayload = {
  user: SessionUser;
  group: Group | null;
  goals: { goals: Goal[]; summary: GoalsSummary };
  trips: { trips: Trip[]; summary: TripsSummary };
  shopping: { items: ShoppingItem[]; summary: ShoppingSummary };
};
