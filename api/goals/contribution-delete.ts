import type { VercelRequest, VercelResponse } from "@vercel/node";
import { contributionIdSchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";

// Removes a single contribution and re-derives the goal's completion state so
// a mistyped amount or wrong entry is correctable — contributions were
// previously append-only, which made a fat-fingered figure permanent shared
// financial data. Financial goals never store a running total (it's summed
// from goal_contributions at read time), so deleting a row is enough there;
// only is_completed needs recomputing. General goals store the latest
// percentage on the goal row, so after deletion it's reset to the most recent
// remaining contribution's value (or 0 when none remain).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(contributionIdSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { id } = parsed.data;

  // Join back through goals to confirm the contribution belongs to the
  // caller's group before touching anything — the contribution row has no
  // group_id of its own.
  const rows = await sql`
    select gc.id, g.id as "goalId", g.goal_type as "goalType"
    from goal_contributions gc
    join goals g on g.id = gc.goal_id
    where gc.id = ${id} and g.group_id = ${user.groupId}
    limit 1
  `;
  const found = rows[0] as { goalId: string; goalType: "financial" | "general" } | undefined;
  if (!found) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }
  const { goalId } = found;

  if (found.goalType === "financial") {
    await sql.transaction([
      sql`delete from goal_contributions where id = ${id}`,
      sql`
        update goals set
          is_completed = (select coalesce(sum(amount), 0) from goal_contributions where goal_id = ${goalId}) >= target_amount,
          updated_at = now()
        where id = ${goalId}
      `,
    ]);
  } else {
    // The subquery runs after the delete within the same transaction, so it
    // reflects the remaining rows.
    await sql.transaction([
      sql`delete from goal_contributions where id = ${id}`,
      sql`
        update goals set
          current_progress_pct = coalesce(
            (select new_progress_pct from goal_contributions where goal_id = ${goalId} order by created_at desc limit 1),
            0
          ),
          is_completed = coalesce(
            (select new_progress_pct from goal_contributions where goal_id = ${goalId} order by created_at desc limit 1),
            0
          ) >= 100,
          updated_at = now()
        where id = ${goalId}
      `,
    ]);
  }

  res.status(200).json({ ok: true });
}
