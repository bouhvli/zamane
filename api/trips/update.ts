import type { VercelRequest, VercelResponse } from "@vercel/node";
import { updateTripRequestSchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";

// Edits a trip's fields. Group-scoped; the itinerary is untouched.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(updateTripRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id, title, destination, startDate, endDate, budget, notes } = parsed.data;

  const rows = await sql`
    update trips set
      title = ${title},
      destination = ${destination ?? null},
      start_date = ${startDate ?? null},
      end_date = ${endDate ?? null},
      budget = ${budget ?? null},
      notes = ${notes ?? null},
      updated_at = now()
    where id = ${id} and group_id = ${user.groupId}
    returning id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  res.status(200).json({ ok: true });
}
