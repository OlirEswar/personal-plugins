// loadSession runs on every request and sets c.get("user") (or null).
// Protect a whole router with `router.use("*", requireUser)`, then call getUser(c) in handlers.
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppEnv, PublicUser } from "../lib/types.ts";
import { forbidden, unauthorized } from "../lib/errors.ts";
import { SESSION_COOKIE, setSessionCookie, validateSession } from "./session.ts";

export const loadSession = createMiddleware<AppEnv>(async (c, next) => {
  c.set("user", null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const result = await validateSession(token);
    if (result) {
      c.set("user", result.user);
      if (result.renewedUntil) setSessionCookie(c, token, result.renewedUntil);
    }
  }
  await next();
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("user")) throw unauthorized();
  await next();
});

// For features that must only be used once the email address is proven (sending invites, payments...).
export const requireVerifiedEmail = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) throw unauthorized();
  if (!user.emailVerifiedAt) throw forbidden("Verify your email address first");
  await next();
});

export function getUser(c: Context<AppEnv>): PublicUser {
  const user = c.get("user");
  if (!user) throw unauthorized();
  return user;
}
