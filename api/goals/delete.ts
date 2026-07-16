import type { VercelRequest, VercelResponse } from "@vercel/node";
import { goalIdQuerySchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";

// Deletes a goal and (via the ON DELETE CASCADE on goal_contributions) its
// whole contribution history. Group-scoped so a member can only delete their
// own couple's goals.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(goalIdQuerySchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  const rows = await sql`
    delete from goals where id = ${id} and group_id = ${user.groupId} returning id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.status(200).json({ ok: true });
}
