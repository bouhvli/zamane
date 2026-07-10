import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { serialize as serializeCookie } from "cookie";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import { sql } from "./db";

export const SESSION_COOKIE_NAME = "sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BCRYPT_COST = 10;

export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  groupId: string | null;
};

// A pre-computed bcrypt hash of a random value, used so login's timing
// profile is the same whether the email exists or not (no cheap early-out).
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q9pRYUB.M8fLM8W2i7ohbXwtOaW86";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function verifyPasswordConstantTime(password: string, hash: string | undefined): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  req: VercelRequest,
): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const userAgent = req.headers["user-agent"] ?? null;
  const ip = getClientIp(req);

  await sql`
    insert into sessions (token_hash, user_id, expires_at, user_agent, ip)
    values (${tokenHash}, ${userId}, ${expiresAt.toISOString()}, ${userAgent}, ${ip})
  `;

  return token;
}

export function getClientIp(req: VercelRequest): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? null;
}

export function setSessionCookie(res: VercelResponse, token: string): void {
  const cookie = serializeCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  });
  appendSetCookie(res, cookie);
}

export function clearSessionCookie(res: VercelResponse): void {
  const cookie = serializeCookie(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  appendSetCookie(res, cookie);
}

function appendSetCookie(res: VercelResponse, cookie: string): void {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookie);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookie]);
  } else {
    res.setHeader("Set-Cookie", [String(existing), cookie]);
  }
}

export async function getUserFromRequest(req: VercelRequest): Promise<SessionUser | null> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) return null;

  const tokenHash = hashToken(token);
  const rows = await sql`
    select u.id, u.email, u.display_name as "displayName", u.group_id as "groupId"
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${tokenHash} and s.expires_at > now()
    limit 1
  `;

  const row = rows[0] as SessionUser | undefined;
  return row ?? null;
}

export async function deleteSessionFromRequest(req: VercelRequest): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) return;
  const tokenHash = hashToken(token);
  await sql`delete from sessions where token_hash = ${tokenHash}`;
}

export async function deleteAllSessionsForUser(userId: string): Promise<void> {
  await sql`delete from sessions where user_id = ${userId}`;
}
