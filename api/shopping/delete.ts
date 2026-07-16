import type { VercelRequest, VercelResponse } from "@vercel/node";
import { shoppingItemIdSchema } from "@shared/validation";

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

  const parsed = parseBody(shoppingItemIdSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  const rows = await sql`
    delete from shopping_items
    where id = ${id} and group_id = ${user.groupId}
    returning id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.status(200).json({ ok: true });
}
