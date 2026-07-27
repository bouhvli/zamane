import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createGoalNoteRequestSchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";

// Appends a note to a goal's shared journal. The note body is an ordered list
// of text/image blocks (validated in shared/validation) stored as jsonb, so a
// photo can sit at any position. Group-scoped: the goal must belong to the
// caller's group.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!user.groupId) {
    res.status(403).json({ error: "Join or create a group first" });
    return;
  }

  const parsed = parseBody(createGoalNoteRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { goalId, blocks } = parsed.data;

  // Trim text blocks and drop the empty ones the composer may leave behind.
  const cleaned = blocks
    .map((block) => (block.type === "text" ? { ...block, value: block.value.trim() } : block))
    .filter((block) => block.type === "image" || block.value.length > 0);
  if (cleaned.length === 0) {
    res.status(400).json({ error: "Write something first" });
    return;
  }

  const goalRows = await sql`
    select id from goals where id = ${goalId} and group_id = ${user.groupId} limit 1
  `;
  if (goalRows.length === 0) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const rows = await sql`
    insert into goal_notes (goal_id, group_id, created_by, blocks)
    values (${goalId}, ${user.groupId}, ${user.id}, ${JSON.stringify(cleaned)}::jsonb)
    returning id, blocks, created_by as "createdBy", created_at as "createdAt"
  `;

  const note = { ...rows[0], displayName: user.displayName, email: user.email };
  res.status(201).json({ note });
}
