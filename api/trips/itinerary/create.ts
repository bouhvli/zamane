import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createItineraryItemRequestSchema } from "@shared/validation";

import { sql } from "../../_lib/db";
import { methodGuard, parseBody } from "../../_lib/http";
import { getUserFromRequest } from "../../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(createItineraryItemRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { tripId, title, itemDate, itemTime, location, notes } = parsed.data;

  // Confirm the trip is in the caller's group before attaching an item to
  // it — the trip id alone isn't proof of access.
  const tripRows = await sql`select id from trips where id = ${tripId} and group_id = ${user.groupId} limit 1`;
  if (tripRows.length === 0) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const rows = await sql`
    insert into trip_itinerary_items (trip_id, title, item_date, item_time, location, notes, created_by)
    values (${tripId}, ${title}, ${itemDate ?? null}, ${itemTime ?? null}, ${location ?? null}, ${notes ?? null}, ${user.id})
    returning
      id,
      trip_id as "tripId",
      title,
      item_date as "itemDate",
      item_time as "itemTime",
      location,
      notes,
      created_by as "createdBy",
      created_at as "createdAt"
  `;

  const itineraryItem = { ...rows[0], createdByName: user.displayName, createdByEmail: user.email };

  res.status(201).json({ itineraryItem });
}
