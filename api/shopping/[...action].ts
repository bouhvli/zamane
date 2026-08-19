import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createShoppingItemRequestSchema,
  toggleShoppingItemRequestSchema,
  shoppingItemIdSchema,
} from "../../shared/validation.js";

import { sql } from "../_lib/db.js";
import { shoppingForGroup, EMPTY_SHOPPING } from "../_lib/queries.js";
import { methodGuard, parseBody, getCatchAllAction } from "../_lib/http.js";
import { getUserFromRequest } from "../_lib/auth.js";

// Consolidated into one function (shopping/list, shopping/create, etc. all
// routed here) to stay under the Hobby plan's 12 serverless function cap.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = getCatchAllAction(req);

  switch (action) {
    case "list":
      return list(req, res);
    case "create":
      return create(req, res);
    case "toggle":
      return toggle(req, res);
    case "delete":
      return remove(req, res);
    default:
      res.status(404).json({ error: "Not found" });
  }
}

async function list(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["GET"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!user.groupId) {
    res.status(200).json(EMPTY_SHOPPING);
    return;
  }

  // The rows query and the summary aggregate run concurrently; see
  // api/_lib/queries.ts.
  res.status(200).json(await shoppingForGroup(user.groupId));
}

async function create(req: VercelRequest, res: VercelResponse) {
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
  if (parsed.success === false) {
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

async function toggle(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(toggleShoppingItemRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id, isChecked } = parsed.data;

  const rows = await sql`
    update shopping_items
    set is_checked = ${isChecked}, updated_at = now()
    where id = ${id} and group_id = ${user.groupId}
    returning id
  `;

  if (rows.length === 0) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.status(200).json({ ok: true });
}

async function remove(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(shoppingItemIdSchema, req.body);
  if (parsed.success === false) {
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
