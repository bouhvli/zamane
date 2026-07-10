import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loginRequestSchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { verifyPasswordConstantTime, createSession, setSessionCookie } from "../_lib/auth";

const GENERIC_ERROR = "Invalid email or password";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const parsed = parseBody(loginRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { email, password } = parsed.data;

  const rows = await sql`
    select id, email, display_name as "displayName", group_id as "groupId", password_hash as "passwordHash"
    from users
    where lower(email) = ${email}
    limit 1
  `;
  const row = rows[0] as
    | { id: string; email: string; displayName: string | null; groupId: string | null; passwordHash: string }
    | undefined;

  // Always runs a bcrypt.compare (against a dummy hash if the user doesn't
  // exist) so response timing doesn't reveal whether the email is registered.
  const valid = await verifyPasswordConstantTime(password, row?.passwordHash);
  if (!row || !valid) {
    res.status(401).json({ error: GENERIC_ERROR });
    return;
  }

  const token = await createSession(row.id, req);
  setSessionCookie(res, token);

  res.status(200).json({
    user: { id: row.id, email: row.email, displayName: row.displayName, groupId: row.groupId },
  });
}
