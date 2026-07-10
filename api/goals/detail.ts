import type { VercelRequest, VercelResponse } from "@vercel/node";
import { goalIdQuerySchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["GET"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(goalIdQuerySchema, req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  const rows = await sql`
    select
      g.id, g.title, g.description,
      g.goal_type as "goalType",
      g.target_amount as "targetAmount",
      coalesce(c.total, 0) as "currentAmount",
      g.current_progress_pct as "currentProgressPct",
      g.target_date as "targetDate",
      g.is_completed as "isCompleted",
      g.created_by as "createdBy",
      u.display_name as "createdByName",
      u.email as "createdByEmail",
      g.created_at as "createdAt"
    from goals g
    left join users u on u.id = g.created_by
    left join (
      select goal_id, sum(amount) as total from goal_contributions where goal_id = ${id} group by goal_id
    ) c on true
    where g.id = ${id} and g.group_id = ${user.groupId}
    limit 1
  `;

  const goal = rows[0];
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const contributions = await sql`
    select
      gc.id,
      gc.user_id as "userId",
      u.display_name as "displayName",
      u.email,
      gc.amount,
      gc.progress_delta as "progressDelta",
      gc.new_progress_pct as "newProgressPct",
      gc.note,
      gc.created_at as "createdAt"
    from goal_contributions gc
    join users u on u.id = gc.user_id
    where gc.goal_id = ${id}
    order by gc.created_at desc
  `;

  res.status(200).json({ goal, contributions });
}
