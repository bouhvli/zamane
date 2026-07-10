import type { VercelRequest, VercelResponse } from "@vercel/node";
import { forgotPasswordRequestSchema } from "@shared/validation";

import { sql } from "../_lib/db";
import { methodGuard, parseBody } from "../_lib/http";
import { generateToken, hashToken } from "../_lib/auth";
import { sendPasswordResetEmail, isEmailConfigured } from "../_lib/mailer";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const GENERIC_MESSAGE = "If that email exists, a reset link was sent.";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const parsed = parseBody(forgotPasswordRequestSchema, req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { email } = parsed.data;

  const rows = await sql`select id from users where lower(email) = ${email} limit 1`;
  const user = rows[0] as { id: string } | undefined;

  let resetLinkDevOnly: string | undefined;

  // Always behave the same way whether or not the user exists, so this
  // endpoint can't be used to enumerate registered emails.
  if (user) {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await sql`
      insert into password_reset_tokens (token_hash, user_id, expires_at)
      values (${tokenHash}, ${user.id}, ${expiresAt.toISOString()})
    `;

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const resetLink = `${appUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetLink);

    // Dev-only convenience: with no email vendor configured, surface the
    // link directly so the flow is testable without sending real email.
    // Never do this in production, even without RESEND_API_KEY set.
    if (!isEmailConfigured() && process.env.NODE_ENV !== "production") {
      resetLinkDevOnly = resetLink;
    }
  }

  res.status(200).json({ ok: true, message: GENERIC_MESSAGE, ...(resetLinkDevOnly && { resetLinkDevOnly }) });
}
