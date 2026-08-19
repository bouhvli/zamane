import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { joinGroupRequestSchema } from "../../shared/validation.js";

import { sql } from "../_lib/db.js";
import { groupForGroupId } from "../_lib/queries.js";
import { methodGuard, parseBody, getCatchAllAction } from "../_lib/http.js";
import { getUserFromRequest } from "../_lib/auth.js";
import { generateInviteCode } from "../_lib/invite-code.js";

const MAX_ATTEMPTS = 5;

// Consolidated into one function (groups/me, groups/create, groups/join all
// routed here) to stay under the Hobby plan's 12 serverless function cap.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = getCatchAllAction(req);

  switch (action) {
    case "me":
      return me(req, res);
    case "create":
      return create(req, res);
    case "join":
      return join(req, res);
    default:
      res.status(404).json({ error: "Not found" });
  }
}

async function me(req: VercelRequest, res: VercelResponse) {
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

  // The group row and its member list were fetched one after the other even
  // though the member query only needs the group *id*, which the session
  // already carries — two serial Neon round trips where one would do. See
  // api/_lib/queries.ts.
  res.status(200).json(await groupForGroupId(user.groupId));
}

async function create(req: VercelRequest, res: VercelResponse) {
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

async function join(req: VercelRequest, res: VercelResponse) {
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
  if (parsed.success === false) {
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
