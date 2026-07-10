import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createGoalRequestSchema } from "@shared/validation";

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
    res.status(403).json({ error: "Join or create a group before adding goals" });
    return;
  }

  const parsed = parseBody(createGoalRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { title, description, goalType, targetDate } = parsed.data;
  const targetAmount = parsed.data.goalType === "financial" ? parsed.data.targetAmount : null;

  const rows = await sql`
    insert into goals (title, description, goal_type, target_amount, target_date, created_by, group_id)
    values (${title}, ${description ?? null}, ${goalType}, ${targetAmount}, ${targetDate ?? null}, ${user.id}, ${user.groupId})
    returning
      id, title, description,
      goal_type as "goalType",
      target_amount as "targetAmount",
      current_progress_pct as "currentProgressPct",
      target_date as "targetDate",
      is_completed as "isCompleted",
      created_by as "createdBy",
      created_at as "createdAt"
  `;

  const goal = { ...rows[0], currentAmount: 0, createdByName: user.displayName, createdByEmail: user.email };

  res.status(201).json({ goal });
}
