import type { VercelRequest, VercelResponse } from "@vercel/node";

import { sql } from "../_lib/db";
import { methodGuard } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["GET"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!user.groupId) {
    res.status(200).json({ items: [], summary: { uncheckedCount: 0, checkedCount: 0, estimatedTotal: 0 } });
    return;
  }

  const items = await sql`
    select
      si.id, si.name, si.quantity, si.category, si.price, si.notes,
      si.is_checked as "isChecked",
      si.created_by as "createdBy",
      u.display_name as "createdByName",
      u.email as "createdByEmail",
      si.created_at as "createdAt"
    from shopping_items si
    left join users u on u.id = si.created_by
    where si.group_id = ${user.groupId}
    order by si.is_checked asc, si.category asc nulls last, si.created_at asc
  `;

  const [{ uncheckedCount, checkedCount, estimatedTotal }] = await sql`
    select
      count(*) filter (where not is_checked)::int as "uncheckedCount",
      count(*) filter (where is_checked)::int as "checkedCount",
      coalesce(sum(price * quantity) filter (where not is_checked and price is not null), 0) as "estimatedTotal"
    from shopping_items
    where group_id = ${user.groupId}
  `;

  res.status(200).json({ items, summary: { uncheckedCount, checkedCount, estimatedTotal } });
}
