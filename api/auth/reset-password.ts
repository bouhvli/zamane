import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resetPasswordRequestSchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { hashPassword, hashToken, deleteAllSessionsForUser } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const parsed = parseBody(resetPasswordRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { token, newPassword } = parsed.data;
  const tokenHash = hashToken(token);

  const rows = await sql`
    select user_id as "userId"
    from password_reset_tokens
    where token_hash = ${tokenHash} and used_at is null and expires_at > now()
    limit 1
  `;
  const row = rows[0] as { userId: string } | undefined;

  if (!row) {
    res.status(400).json({ error: "Invalid or expired reset link" });
    return;
  }

  const passwordHash = await hashPassword(newPassword);

  await sql`update users set password_hash = ${passwordHash}, updated_at = now() where id = ${row.userId}`;
  await sql`update password_reset_tokens set used_at = now() where token_hash = ${tokenHash}`;
  // Force re-login everywhere — defends against a compromised password
  // whose old sessions might still be live.
  await deleteAllSessionsForUser(row.userId);

  res.status(200).json({ ok: true });
}
