import type { VercelRequest, VercelResponse } from "@vercel/node";

import { sql } from "../_lib/db";
import { methodGuard } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["GET"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!user.groupId) {
    res.status(200).json({ trips: [], summary: { upcomingCount: 0, totalBudget: 0 } });
    return;
  }

  // Trips are scoped to the caller's group, same as goals.
  const trips = await sql`
    select
      t.id, t.title, t.destination,
      t.start_date as "startDate",
      t.end_date as "endDate",
      t.budget,
      t.notes,
      t.created_by as "createdBy",
      u.display_name as "createdByName",
      u.email as "createdByEmail",
      t.created_at as "createdAt",
      coalesce(i.count, 0)::int as "itineraryCount"
    from trips t
    left join users u on u.id = t.created_by
    left join (
      select trip_id, count(*) as count from trip_itinerary_items group by trip_id
    ) i on i.trip_id = t.id
    where t.group_id = ${user.groupId}
    order by t.start_date asc nulls last, t.created_at desc
  `;

  const [{ upcomingCount, totalBudget }] = await sql`
    select
      count(*) filter (where end_date is null or end_date >= current_date)::int as "upcomingCount",
      coalesce(sum(budget), 0) as "totalBudget"
    from trips
    where group_id = ${user.groupId}
  `;

  res.status(200).json({ trips, summary: { upcomingCount, totalBudget } });
}
