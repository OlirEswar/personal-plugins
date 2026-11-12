// Cookie sessions stored in the database (the pattern from lucia-auth.com).
// - The browser holds a random 256-bit token in an httpOnly cookie.
// - The database stores only sha256(token), so a leaked DB can't be replayed as cookies.
// - Sessions last 30 days and slide forward when used in their second half.
// - In production the cookie is named __Host-session: browsers then require Secure, Path=/ and
//   no Domain, so a sibling subdomain can't set or overwrite it.
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/client.ts";
import { sessions, users } from "../db/schema.ts";
import { env } from "../env.ts";
import type { PublicUser } from "../lib/types.ts";
import { hashToken, newToken } from "./tokens.ts";

export const SESSION_COOKIE = env.isProd ? "__Host-session" : "session";
const DAY = 24 * 60 * 60 * 1000;
const SESSION_TTL = 30 * DAY;
const RENEW_WHEN_LEFT = 15 * DAY;

export const publicUserColumns = {
  id: users.id,
  email: users.email,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
};

export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

// Returns the user for a token, or null. `renewedUntil` is set when the cookie should be re-sent.
export async function validateSession(token: string): Promise<{ user: PublicUser; renewedUntil?: Date } | null> {
  const id = hashToken(token);
  const [row] = await db
    .select({ user: publicUserColumns, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())));
  if (!row) return null;
  if (row.expiresAt.getTime() - Date.now() < RENEW_WHEN_LEFT) {
    const renewedUntil = new Date(Date.now() + SESSION_TTL);
    await db.update(sessions).set({ expiresAt: renewedUntil }).where(eq(sessions.id, id));
    return { user: row.user, renewedUntil };
  }
  return { user: row.user };
}

export async function invalidateSession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

// Sign the user out everywhere (password change/reset, "log out all devices", account compromise).
export async function invalidateUserSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// Sign in this browser: issue a fresh session and cookie.
export async function startSession(c: Context, userId: string) {
  const { token, expiresAt } = await createSession(userId);
  setSessionCookie(c, token, expiresAt);
}

export function setSessionCookie(c: Context, token: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript can't read it, so XSS can't steal it
    sameSite: "Lax", // not sent on cross-site POSTs (CSRF defense)
    secure: env.isProd, // HTTPS only in production
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: env.isProd });
}
