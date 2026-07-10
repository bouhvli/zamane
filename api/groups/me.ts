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
    res.status(200).json({ group: null });
    return;
  }

  const groupRows = await sql`select id, invite_code as "inviteCode" from groups where id = ${user.groupId} limit 1`;
  const group = groupRows[0] as { id: string; inviteCode: string } | undefined;
  if (!group) {
    res.status(200).json({ group: null });
    return;
  }

  const members = await sql`
    select id, display_name as "displayName", email
    from users
    where group_id = ${user.groupId}
    order by created_at asc
  `;

  res.status(200).json({ group: { ...group, members } });
}
