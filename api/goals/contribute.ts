import type { VercelRequest, VercelResponse } from "@vercel/node";
import { contributeRequestSchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";

type ContributionRow = {
  id: string;
  amount: string | null;
  progressDelta: number | null;
  newProgressPct: number | null;
  note: string | null;
  createdAt: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(contributeRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { goalId } = parsed.data;

  const goalRows = await sql`
    select goal_type as "goalType", current_progress_pct as "currentProgressPct"
    from goals where id = ${goalId} and group_id = ${user.groupId} limit 1
  `;
  const goal = goalRows[0] as { goalType: "financial" | "general"; currentProgressPct: number } | undefined;
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  // Never trust the client's claimed type over the row — a mismatch means
  // stale UI state or a tampered request, not a legitimate contribution.
  if (goal.goalType !== parsed.data.goalType) {
    res.status(400).json({ error: "Goal type mismatch" });
    return;
  }

  let contributionRows: ContributionRow[];

  if (parsed.data.goalType === "financial") {
    const { amount, note } = parsed.data;
    [contributionRows] = (await sql.transaction([
      sql`
        insert into goal_contributions (goal_id, user_id, amount, note)
        values (${goalId}, ${user.id}, ${amount}, ${note ?? null})
        returning id, amount, progress_delta as "progressDelta", new_progress_pct as "newProgressPct", note, created_at as "createdAt"
      `,
      sql`
        update goals set
          is_completed = (select coalesce(sum(amount), 0) from goal_contributions where goal_id = ${goalId}) >= target_amount,
          updated_at = now()
        where id = ${goalId}
      `,
    ])) as [ContributionRow[], unknown];
  } else {
    const { newProgressPct, note } = parsed.data;
    const progressDelta = newProgressPct - goal.currentProgressPct;
    [contributionRows] = (await sql.transaction([
      sql`
        insert into goal_contributions (goal_id, user_id, progress_delta, new_progress_pct, note)
        values (${goalId}, ${user.id}, ${progressDelta}, ${newProgressPct}, ${note ?? null})
        returning id, amount, progress_delta as "progressDelta", new_progress_pct as "newProgressPct", note, created_at as "createdAt"
      `,
      sql`
        update goals set
          current_progress_pct = ${newProgressPct},
          is_completed = (${newProgressPct} >= 100),
          updated_at = now()
        where id = ${goalId}
      `,
    ])) as [ContributionRow[], unknown];
  }

  const contribution = { ...contributionRows[0], userId: user.id, displayName: user.displayName, email: user.email };

  const refreshedRows = await sql`
    select
      g.id, g.title, g.description,
      g.goal_type as "goalType",
      g.target_amount as "targetAmount",
      coalesce(c.total, 0) as "currentAmount",
      g.current_progress_pct as "currentProgressPct",
      g.target_date as "targetDate",
      g.is_completed as "isCompleted",
      g.created_at as "createdAt"
    from goals g
    left join (
      select goal_id, sum(amount) as total from goal_contributions where goal_id = ${goalId} group by goal_id
    ) c on true
    where g.id = ${goalId}
  `;

  res.status(200).json({ goal: refreshedRows[0], contribution });
}
