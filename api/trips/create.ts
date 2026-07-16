import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createTripRequestSchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!user.groupId) {
    res.status(403).json({ error: "Join or create a group before adding trips" });
    return;
  }

  const parsed = parseBody(createTripRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { title, destination, startDate, endDate, budget, notes } = parsed.data;

  const rows = await sql`
    insert into trips (title, destination, start_date, end_date, budget, notes, created_by, group_id)
    values (
      ${title}, ${destination ?? null}, ${startDate ?? null}, ${endDate ?? null},
      ${budget ?? null}, ${notes ?? null}, ${user.id}, ${user.groupId}
    )
    returning
      id, title, destination,
      start_date as "startDate",
      end_date as "endDate",
      budget,
      notes,
      created_by as "createdBy",
      created_at as "createdAt"
  `;

  const trip = { ...rows[0], createdByName: user.displayName, createdByEmail: user.email, itineraryCount: 0 };

  res.status(201).json({ trip });
}
