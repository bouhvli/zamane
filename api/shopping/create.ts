import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createShoppingItemRequestSchema } from "@shared/validation";

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
    res.status(403).json({ error: "Join or create a group before adding shopping items" });
    return;
  }

  const parsed = parseBody(createShoppingItemRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { name, quantity, category, price, notes } = parsed.data;

  const rows = await sql`
    insert into shopping_items (name, quantity, category, price, notes, created_by, group_id)
    values (${name}, ${quantity}, ${category ?? null}, ${price ?? null}, ${notes ?? null}, ${user.id}, ${user.groupId})
    returning
      id, name, quantity, category, price, notes,
      is_checked as "isChecked",
      created_by as "createdBy",
      created_at as "createdAt"
  `;

  const item = { ...rows[0], createdByName: user.displayName, createdByEmail: user.email };

  res.status(201).json({ item });
}
