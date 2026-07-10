import type { VercelRequest, VercelResponse } from "@vercel/node";
import { signupRequestSchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { hashPassword, createSession, setSessionCookie } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const parsed = parseBody(signupRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { email, password, displayName } = parsed.data;

  const existing = await sql`select id from users where lower(email) = ${email} limit 1`;
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const inserted = await sql`
    insert into users (email, password_hash, display_name)
    values (${email}, ${passwordHash}, ${displayName ?? null})
    returning id, email, display_name as "displayName", group_id as "groupId"
  `;
  const user = inserted[0] as { id: string; email: string; displayName: string | null; groupId: string | null };

  const token = await createSession(user.id, req);
  setSessionCookie(res, token);

  res.status(201).json({ user });
}
