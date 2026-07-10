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
    res.status(200).json({ goals: [], summary: { activeCount: 0, completedCount: 0, totalSavedThisMonth: 0 } });
    return;
  }

  // Goals are scoped to the caller's group — shared by the two members of
  // that group, invisible to everyone else.
  const goals = await sql`
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
      select goal_id, sum(amount) as total from goal_contributions group by goal_id
    ) c on c.goal_id = g.id
    where g.group_id = ${user.groupId}
    order by g.is_completed asc, g.created_at desc
  `;

  const [{ activeCount, completedCount }] = await sql`
    select
      count(*) filter (where not is_completed)::int as "activeCount",
      count(*) filter (where is_completed)::int as "completedCount"
    from goals
    where group_id = ${user.groupId}
  `;

  const [{ totalSavedThisMonth }] = await sql`
    select coalesce(sum(gc.amount), 0) as "totalSavedThisMonth"
    from goal_contributions gc
    join goals gl on gl.id = gc.goal_id
    where gl.group_id = ${user.groupId}
      and gc.amount is not null
      and gc.created_at >= date_trunc('month', now())
  `;

  res.status(200).json({
    goals,
    summary: { activeCount, completedCount, totalSavedThisMonth },
  });
}
