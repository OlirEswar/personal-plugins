// Account endpoints, all under /api/auth:
//   POST /signup                    create account, sign in, email a verification link
//   POST /login   POST /logout      POST /logout-all (every device)     GET /me
//   POST /verify-email              { token } from the emailed link
//   POST /verify-email/resend
//   POST /password-reset            { email }: always 204, emails a link if the account exists
//   POST /password-reset/confirm    { token, password }: sets the password, signs out everywhere, signs in here
//   POST /change-password           { currentPassword, newPassword }
// Tune limits in LIMITS below. Security events are logged as "auth.<event>" with ip, user and requestId.
// Emails go through the job queue (src/jobs), so they're retried and survive restarts.
import type { Context } from "hono";
import { createRoute, z } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { env } from "../env.ts";
import { createRouter, json, jsonBody } from "../lib/router.ts";
import { HttpError, badRequest, conflict, problemResponse, unauthorized } from "../lib/errors.ts";
import { clientIp, enforceLimit } from "../lib/rate-limit.ts";
import { enqueue } from "../jobs/queue.ts";
import { log } from "../lib/log.ts";
import type { PublicUser } from "../lib/types.ts";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../auth/password.ts";
import { NewPassword, assertPasswordAllowed } from "../auth/password-policy.ts";
import { getUser, requireUser } from "../auth/middleware.ts";
import { consumeAuthToken, issueAuthToken } from "../auth/tokens.ts";
import {
  SESSION_COOKIE, clearSessionCookie, invalidateSession, invalidateUserSessions, publicUserColumns, startSession,
} from "../auth/session.ts";

const MIN = 60_000;
const LIMITS = {
  signupPerIp: { max: 10, windowMs: 60 * MIN },
  loginPerIp: { max: 30, windowMs: 15 * MIN },
  loginPerAccount: { max: 10, windowMs: 15 * MIN }, // stops password guessing spread across many IPs
  resetPerIp: { max: 10, windowMs: 60 * MIN },
  resetPerAccount: { max: 3, windowMs: 60 * MIN }, // stops mail-bombing one address
  verifyResendPerUser: { max: 5, windowMs: 60 * MIN },
  changePasswordPerUser: { max: 10, windowMs: 15 * MIN },
};
const limit = (c: Context, key: string, l: { max: number; windowMs: number }, what: string) =>
  enforceLimit(c, key, l.max, l.windowMs, what);

function authLog(c: Context, event: string, fields: Record<string, string | undefined> = {}) {
  log.info(`auth.${event}`, { ip: clientIp(c), ...fields, req: c.get("requestId") });
}

export const UserSchema = z
  .object({ id: z.string(), email: z.string(), emailVerified: z.boolean(), createdAt: z.iso.datetime() })
  .openapi("User");

const Email = z.email().max(254).transform((e) => e.toLowerCase());
const Token = z.string().min(20).max(100);
const Signup = z.object({ email: Email, password: NewPassword }).openapi("Signup");
const Login = z.object({ email: Email, password: z.string().min(1).max(128) }).openapi("Login");

export const toUserDto = (u: PublicUser) => ({
  id: u.id, email: u.email, emailVerified: u.emailVerifiedAt !== null, createdAt: u.createdAt.toISOString(),
});

async function sendVerificationEmail(user: { id: string; email: string }) {
  const token = await issueAuthToken(user.id, "verify_email");
  await enqueue("email.send", {
    to: user.email,
    subject: "Confirm your email address",
    text: `Confirm your email address by opening this link (valid for 24 hours):\n\n${env.appUrl}/verify-email?token=${token}\n\nIf you didn't create an account, ignore this email.`,
  });
}

const signedIn = (description: string) => json(UserSchema, description);
const noContent = (description: string) => ({ description });
const tooMany = problemResponse("Too many attempts");

export const authRoutes = createRouter();

authRoutes.openapi(
  createRoute({
    method: "post", path: "/signup", tags: ["auth"], summary: "Create an account and sign in",
    request: { body: jsonBody(Signup) },
    responses: {
      201: signedIn("Signed up; session cookie set; verification email sent"),
      409: problemResponse("Email already registered"),
      422: problemResponse("Invalid input or breached password"),
      429: tooMany,
    },
  }),
  async (c) => {
    await limit(c, `signup:ip:${clientIp(c)}`, LIMITS.signupPerIp, "sign-up attempts");
    const { email, password } = c.req.valid("json");
    // Trade-off: telling people an email is taken is friendlier but reveals that it has an account.
    // The per-IP limit above keeps that from being used for bulk lookups.
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) throw conflict("An account with that email already exists");
    await assertPasswordAllowed(password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash: await hashPassword(password) })
      .returning(publicUserColumns);
    await startSession(c, user!.id);
    await sendVerificationEmail(user!);
    authLog(c, "signup", { user: user!.id });
    return c.json(toUserDto(user!), 201);
  },
);

authRoutes.openapi(
  createRoute({
    method: "post", path: "/login", tags: ["auth"], summary: "Sign in with email and password",
    request: { body: jsonBody(Login) },
    responses: { 200: signedIn("Signed in; session cookie set"), 401: problemResponse("Wrong email or password"), 429: tooMany },
  }),
  async (c) => {
    const { email, password } = c.req.valid("json");
    await limit(c, `login:ip:${clientIp(c)}`, LIMITS.loginPerIp, "sign-in attempts");
    await limit(c, `login:account:${email}`, LIMITS.loginPerAccount, "sign-in attempts for this account");
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      await burnPasswordCheck(password); // same timing as a real check: don't reveal which emails exist
      authLog(c, "login_failed", { reason: "no_account" });
      throw unauthorized("Wrong email or password");
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      authLog(c, "login_failed", { user: user.id, reason: "bad_password" });
      throw unauthorized("Wrong email or password");
    }
    const previous = getCookie(c, SESSION_COOKIE);
    if (previous) await invalidateSession(previous); // never keep using a pre-login session
    await startSession(c, user.id);
    authLog(c, "login", { user: user.id });
    return c.json(toUserDto(user), 200);
  },
);

authRoutes.openapi(
  createRoute({
    method: "post", path: "/logout", tags: ["auth"], summary: "Sign out this browser",
    responses: { 204: noContent("Signed out") },
  }),
  async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await invalidateSession(token);
    clearSessionCookie(c);
    return c.body(null, 204);
  },
);

authRoutes.use("/logout-all", requireUser);
authRoutes.openapi(
  createRoute({
    method: "post", path: "/logout-all", tags: ["auth"], summary: "Sign out every device",
    security: [{ cookieAuth: [] }],
    responses: { 204: noContent("All sessions ended"), 401: problemResponse("Not signed in") },
  }),
  async (c) => {
    const user = getUser(c);
    await invalidateUserSessions(user.id);
    clearSessionCookie(c);
    authLog(c, "logout_all", { user: user.id });
    return c.body(null, 204);
  },
);

authRoutes.openapi(
  createRoute({
    method: "get", path: "/me", tags: ["auth"], summary: "The signed-in user",
    security: [{ cookieAuth: [] }],
    responses: { 200: json(UserSchema, "Current user"), 401: problemResponse("Not signed in") },
  }),
  (c) => c.json(toUserDto(getUser(c)), 200),
);

authRoutes.openapi(
  createRoute({
    method: "post", path: "/verify-email", tags: ["auth"], summary: "Confirm an email address with the emailed token",
    request: { body: jsonBody(z.object({ token: Token })) },
    responses: { 204: noContent("Email verified"), 400: problemResponse("Invalid or expired link") },
  }),
  async (c) => {
    const userId = await consumeAuthToken(c.req.valid("json").token, "verify_email");
    if (!userId) throw badRequest("This link is invalid or has expired. Request a new one.");
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
    authLog(c, "email_verified", { user: userId });
    return c.body(null, 204);
  },
);

authRoutes.use("/verify-email/resend", requireUser);
authRoutes.openapi(
  createRoute({
    method: "post", path: "/verify-email/resend", tags: ["auth"], summary: "Send a new verification email",
    security: [{ cookieAuth: [] }],
    responses: { 204: noContent("Sent (or already verified)"), 401: problemResponse("Not signed in"), 429: tooMany },
  }),
  async (c) => {
    const user = getUser(c);
    await limit(c, `verify:user:${user.id}`, LIMITS.verifyResendPerUser, "verification emails");
    if (!user.emailVerifiedAt) await sendVerificationEmail(user);
    return c.body(null, 204);
  },
);

authRoutes.openapi(
  createRoute({
    method: "post", path: "/password-reset", tags: ["auth"], summary: "Email a password reset link",
    description: "Always returns 204 so the response doesn't reveal whether the email has an account.",
    request: { body: jsonBody(z.object({ email: Email })) },
    responses: { 204: noContent("If the account exists, a link was sent"), 429: tooMany },
  }),
  async (c) => {
    const { email } = c.req.valid("json");
    await limit(c, `reset:ip:${clientIp(c)}`, LIMITS.resetPerIp, "password reset requests");
    await limit(c, `reset:account:${email}`, LIMITS.resetPerAccount, "password reset requests for this account");
    const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email));
    if (user) {
      const token = await issueAuthToken(user.id, "reset_password");
      await enqueue("email.send", {
        to: user.email,
        subject: "Reset your password",
        text: `Someone asked to reset the password for this account. To choose a new password, open this link (valid for 30 minutes):\n\n${env.appUrl}/reset-password?token=${token}\n\nIf it wasn't you, ignore this email; your password hasn't changed.`,
      });
      authLog(c, "password_reset_requested", { user: user.id });
    }
    return c.body(null, 204);
  },
);

authRoutes.openapi(
  createRoute({
    method: "post", path: "/password-reset/confirm", tags: ["auth"], summary: "Set a new password with a reset token",
    request: { body: jsonBody(z.object({ token: Token, password: NewPassword }).openapi("PasswordResetConfirm")) },
    responses: {
      200: signedIn("Password changed; every other session ended; signed in here"),
      400: problemResponse("Invalid or expired link"),
      422: problemResponse("Invalid or breached password"),
    },
  }),
  async (c) => {
    const { token, password } = c.req.valid("json");
    await assertPasswordAllowed(password); // before using up the token, so the user can retry
    const userId = await consumeAuthToken(token, "reset_password");
    if (!userId) throw badRequest("This link is invalid or has expired. Request a new one.");
    // Reaching the inbox proves the address, so mark it verified too.
    const [user] = await db
      .update(users)
      .set({ passwordHash: await hashPassword(password), emailVerifiedAt: new Date() })
      .where(eq(users.id, userId))
      .returning(publicUserColumns);
    await invalidateUserSessions(userId);
    await startSession(c, userId);
    authLog(c, "password_reset", { user: userId });
    return c.json(toUserDto(user!), 200);
  },
);

authRoutes.use("/change-password", requireUser);
authRoutes.openapi(
  createRoute({
    method: "post", path: "/change-password", tags: ["auth"], summary: "Change password (signs out other devices)",
    security: [{ cookieAuth: [] }],
    request: {
      body: jsonBody(z.object({ currentPassword: z.string().min(1).max(128), newPassword: NewPassword }).openapi("ChangePassword")),
    },
    responses: {
      200: signedIn("Password changed; other sessions ended"),
      401: problemResponse("Not signed in"),
      422: problemResponse("Wrong current password, or invalid new password"),
      429: tooMany,
    },
  }),
  async (c) => {
    const me = getUser(c);
    await limit(c, `change-password:user:${me.id}`, LIMITS.changePasswordPerUser, "password change attempts");
    const { currentPassword, newPassword } = c.req.valid("json");
    const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, me.id));
    if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
      authLog(c, "change_password_failed", { user: me.id });
      throw new HttpError(422, "Current password is incorrect", [{ path: "currentPassword", message: "Incorrect password" }]);
    }
    await assertPasswordAllowed(newPassword, "newPassword");
    await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, me.id));
    await invalidateUserSessions(me.id);
    await startSession(c, me.id);
    authLog(c, "password_changed", { user: me.id });
    return c.json(toUserDto(me), 200);
  },
);
