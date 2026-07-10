import type { VercelRequest, VercelResponse } from "@vercel/node";
import { joinGroupRequestSchema } from "@shared/validation";

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

  if (user.groupId) {
    res.status(409).json({ error: "You're already in a group" });
    return;
  }

  const parsed = parseBody(joinGroupRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { inviteCode } = parsed.data;

  const groupRows = await sql`select id from groups where invite_code = ${inviteCode} limit 1`;
  const group = groupRows[0] as { id: string } | undefined;
  if (!group) {
    res.status(404).json({ error: "Invalid invite code" });
    return;
  }

  // Two round trips rather than one atomic transaction — Neon's serverless
  // driver only offers a fixed-array sql.transaction(), not interactive/
  // conditional transactions. Two people redeeming the same code in the
  // same instant could both slip past this count check; acceptable for a
  // personal couple app at this scale, not worth a trigger to close.
  const [{ memberCount }] = await sql`
    select count(*)::int as "memberCount" from users where group_id = ${group.id}
  `;
  if (memberCount >= 2) {
    res.status(409).json({ error: "This group is already full" });
    return;
  }

  await sql`update users set group_id = ${group.id} where id = ${user.id}`;

  res.status(200).json({ group: { id: group.id, inviteCode } });
}
