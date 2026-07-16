import type { VercelRequest, VercelResponse } from "@vercel/node";
import { tripIdQuerySchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["GET"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(tripIdQuerySchema, req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  const rows = await sql`
    select
      t.id, t.title, t.destination,
      t.start_date as "startDate",
      t.end_date as "endDate",
      t.budget,
      t.notes,
      t.created_by as "createdBy",
      u.display_name as "createdByName",
      u.email as "createdByEmail",
      t.created_at as "createdAt"
    from trips t
    left join users u on u.id = t.created_by
    where t.id = ${id} and t.group_id = ${user.groupId}
    limit 1
  `;

  const trip = rows[0];
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const itineraryItems = await sql`
    select
      ii.id,
      ii.trip_id as "tripId",
      ii.title,
      ii.item_date as "itemDate",
      ii.item_time as "itemTime",
      ii.location,
      ii.notes,
      ii.created_by as "createdBy",
      u.display_name as "createdByName",
      u.email as "createdByEmail",
      ii.created_at as "createdAt"
    from trip_itinerary_items ii
    join users u on u.id = ii.created_by
    where ii.trip_id = ${id}
    order by ii.item_date asc nulls last, ii.item_time asc nulls last, ii.created_at asc
  `;

  res.status(200).json({ trip, itineraryItems });
}
