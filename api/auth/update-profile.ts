import type { VercelRequest, VercelResponse } from "@vercel/node";
import { updateProfileRequestSchema } from "@shared/validation";

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

  const parsed = parseBody(updateProfileRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { displayName } = parsed.data;

  const rows = await sql`
    update users
    set display_name = ${displayName ?? null}, updated_at = now()
    where id = ${user.id}
    returning id, email, display_name as "displayName", group_id as "groupId"
  `;

  res.status(200).json({ user: rows[0] });
}
