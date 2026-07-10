import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import { sql } from "../_lib/db";
import { methodGuard } from "../_lib/http";
import { getUserFromRequest } from "../_lib/auth";
import { generateInviteCode } from "../_lib/invite-code";

const MAX_ATTEMPTS = 5;

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

  const groupId = randomUUID();
  let inviteCode = generateInviteCode();
  let attempts = 0;

  // The group's id is generated here (rather than via `returning` on the
  // insert) so it can be reused in the same query batch below — Neon's
  // sql.transaction() takes a fixed array of pre-built queries, so a later
  // query can't consume an earlier one's `returning` value.
  while (true) {
    try {
      await sql.transaction([
        sql`insert into groups (id, invite_code, created_by) values (${groupId}, ${inviteCode}, ${user.id})`,
        sql`update users set group_id = ${groupId} where id = ${user.id}`,
      ]);
      break;
    } catch (error) {
      attempts++;
      const isUniqueViolation = (error as { code?: string })?.code === "23505";
      if (isUniqueViolation && attempts < MAX_ATTEMPTS) {
        inviteCode = generateInviteCode();
        continue;
      }
      throw error;
    }
  }

  res.status(201).json({ group: { id: groupId, inviteCode } });
}
