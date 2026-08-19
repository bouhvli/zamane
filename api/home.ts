import type { VercelRequest, VercelResponse } from "@vercel/node";

import { methodGuard } from "./_lib/http.js";
import { getUserFromRequest } from "./_lib/auth.js";
import {
  goalsForGroup,
  groupForGroupId,
  tripsForGroup,
  shoppingForGroup,
  EMPTY_GOALS,
  EMPTY_TRIPS,
  EMPTY_SHOPPING,
} from "./_lib/queries.js";

/**
 * The dashboard in one request.
 *
 * Loading /home used to cost four API calls — `auth/session` (twice, once for
 * the root loader's redirect and once for the layout's group guard), then
 * `goals/list` and `groups/me` awaited together, then `trips/list` and
 * `shopping/list` streamed behind <Await>. On a cold start each of those is a
 * separate function invocation, and the *first* one to reach Neon pays the
 * compute wake — measured at ~3s against ~50ms for every query after it. Four
 * calls meant up to four chances to draw that penalty, two of them serialised
 * behind a redirect.
 *
 * This endpoint collapses all of it: one session lookup, then every remaining
 * query concurrently. Two Neon round trips total (the session must resolve
 * before we know the group id), one function, one possible cold start.
 *
 * It also returns `user`, so the client can prime its session cache from this
 * response instead of asking `auth/session` separately.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["GET"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!user.groupId) {
    res.status(200).json({
      user,
      group: null,
      goals: EMPTY_GOALS,
      trips: EMPTY_TRIPS,
      shopping: EMPTY_SHOPPING,
    });
    return;
  }

  const [goals, group, trips, shopping] = await Promise.all([
    goalsForGroup(user.groupId),
    groupForGroupId(user.groupId),
    tripsForGroup(user.groupId),
    shoppingForGroup(user.groupId),
  ]);

  res.status(200).json({ user, group: group.group, goals, trips, shopping });
}
