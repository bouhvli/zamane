import type { VercelRequest, VercelResponse } from "@vercel/node";
import { changePasswordRequestSchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import {
  getUserFromRequest,
  verifyPassword,
  hashPassword,
  hashToken,
  deleteOtherSessionsForUser,
  SESSION_COOKIE_NAME,
} from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(changePasswordRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;

  const rows = await sql`select password_hash as "passwordHash" from users where id = ${user.id} limit 1`;
  const row = rows[0] as { passwordHash: string } | undefined;

  const valid = row && (await verifyPassword(currentPassword, row.passwordHash));
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await sql`update users set password_hash = ${passwordHash}, updated_at = now() where id = ${user.id}`;

  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token) {
    await deleteOtherSessionsForUser(user.id, hashToken(token));
  }

  res.status(200).json({ ok: true });
}
