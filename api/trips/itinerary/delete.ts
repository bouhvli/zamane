import type { VercelRequest, VercelResponse } from "@vercel/node";
import { itineraryItemIdSchema } from "@shared/validation";

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

  const parsed = parseBody(itineraryItemIdSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  // Join back through trips to confirm the item belongs to the caller's
  // group — the item's own row has no group_id to check directly.
  const rows = await sql`
    delete from trip_itinerary_items ii
    using trips t
    where ii.id = ${id} and ii.trip_id = t.id and t.group_id = ${user.groupId}
    returning ii.id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Itinerary item not found" });
    return;
  }

  res.status(200).json({ ok: true });
}
