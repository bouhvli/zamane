import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  loginRequestSchema,
  signupRequestSchema,
  updateProfileRequestSchema,
  changePasswordRequestSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
} from "../../shared/validation.js";

import { sql } from "../_lib/db.js";
import { methodGuard, parseBody } from "../_lib/http.js";
import {
  getUserFromRequest,
  verifyPasswordConstantTime,
  verifyPassword,
  hashPassword,
  createSession,
  setSessionCookie,
  deleteSessionFromRequest,
  clearSessionCookie,
  generateToken,
  hashToken,
  deleteAllSessionsForUser,
  deleteOtherSessionsForUser,
  SESSION_COOKIE_NAME,
} from "../_lib/auth.js";
import { sendPasswordResetEmail, isEmailConfigured } from "../_lib/mailer.js";

const GENERIC_LOGIN_ERROR = "Invalid email or password";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_GENERIC_MESSAGE = "If that email exists, a reset link was sent.";

// Consolidated into one function (auth/login, auth/signup, etc. all routed
// here) to stay under the Hobby plan's 12 serverless function cap.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = Array.isArray(req.query.action) ? req.query.action.join("/") : "";

  switch (action) {
    case "login":
      return login(req, res);
    case "signup":
      return signup(req, res);
    case "logout":
      return logout(req, res);
    case "session":
      return session(req, res);
    case "update-profile":
      return updateProfile(req, res);
    case "change-password":
      return changePassword(req, res);
    case "forgot-password":
      return forgotPassword(req, res);
    case "reset-password":
      return resetPassword(req, res);
    default:
      res.status(404).json({ error: "Not found" });
  }
}

async function login(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const parsed = parseBody(loginRequestSchema, req.body);
  if (parsed.success === false) {
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
    res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    return;
  }

  const token = await createSession(row.id, req);
  setSessionCookie(res, token);

  res.status(200).json({
    user: { id: row.id, email: row.email, displayName: row.displayName, groupId: row.groupId },
  });
}

async function signup(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const parsed = parseBody(signupRequestSchema, req.body);
  if (parsed.success === false) {
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

async function logout(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  await deleteSessionFromRequest(req);
  clearSessionCookie(res);

  res.status(200).json({ ok: true });
}

// A routine "am I logged in" probe — never 401, always 200 with either a
// user or null so the router's loaders can call it unconditionally.
async function session(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["GET"])) return;

  const user = await getUserFromRequest(req);
  res.status(200).json({ user });
}

async function updateProfile(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(updateProfileRequestSchema, req.body);
  if (parsed.success === false) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { displayName } = parsed.data;

  const rows = await sql`
    update users
    set display_name = ${displayName ?? null}, updated_at = now()
    where id = ${user.id}
    returning id, email, display_name as "displayName", group_id as "groupId"
  `;

  res.status(200).json({ user: rows[0] });
}

async function changePassword(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = parseBody(changePasswordRequestSchema, req.body);
  if (parsed.success === false) {
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

async function forgotPassword(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const parsed = parseBody(forgotPasswordRequestSchema, req.body);
  if (parsed.success === false) {
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

  res.status(200).json({ ok: true, message: RESET_GENERIC_MESSAGE, ...(resetLinkDevOnly && { resetLinkDevOnly }) });
}

async function resetPassword(req: VercelRequest, res: VercelResponse) {
  if (!methodGuard(req, res, ["POST"])) return;

  const parsed = parseBody(resetPasswordRequestSchema, req.body);
  if (parsed.success === false) {
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
