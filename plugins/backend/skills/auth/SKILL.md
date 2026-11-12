---
name: auth
description: Authentication and authorization for the API - the scaffold's production-grade sessions, email verification, password reset, brute-force limits and breached-password checks; protecting routes, ownership and role checks, MFA, OAuth/social login, and the frontend side of login state. Use when adding login/signup, protecting endpoints, adding roles or teams, password reset, "sign in with Google/GitHub", or debugging auth/cookie problems.
argument-hint: "[task]"
---

# Auth

## What the scaffold already does (read before adding anything)
It's production-grade email + password auth with no auth library, so a human can trace a login from cookie to database row.

| Piece | Where | How |
|---|---|---|
| Password hashing | `src/auth/password.ts` | Node's built-in scrypt with OWASP parameters, a per-hash salt, and constant-time compare. Parameters are stored in the hash so they can change later |
| Password policy | `src/auth/password-policy.ts` | 8–128 characters, no composition rules (NIST 800-63B). Rejects passwords found in breaches via the haveibeenpwned range API (k-anonymous; fails open if unreachable). Raise `MIN_LENGTH` to 15 if passwords are the only factor and the product allows it |
| Sessions | `src/auth/session.ts` | 256-bit random token in an httpOnly, SameSite=Lax cookie (`__Host-session`, Secure in production). The DB stores only `sha256(token)`. 30-day expiry that slides forward when used. Login replaces any previous session |
| One-time links | `src/auth/tokens.ts` | Hashed, single-use (an atomic delete-and-return), and expiring: 24 hours for verification, 30 minutes for reset. Issuing a new link kills the old one |
| Rate limits | `src/lib/rate-limit.ts` | Stored in the database (survive restarts, shared across instances). Per IP **and** per account: 10 failed logins per 15 minutes locks the account temporarily, even across many IPs. Client IP comes from `X-Forwarded-For` only for `TRUST_PROXY` hops |
| Email | `src/lib/email.ts` | Resend HTTP API when `RESEND_API_KEY` is set, otherwise printed to the console. Captured in `outbox` during tests. Sent in the background so timing doesn't reveal accounts |
| Loading the user | `src/auth/middleware.ts` | `loadSession` sets `c.get("user")`. `requireUser` protects a router. `requireVerifiedEmail` gates features that need a proven address. `getUser(c)` returns a typed user or throws 401 |
| Endpoints | `src/routes/auth.ts` | signup, login, logout, logout-all, me, verify-email (+ resend), password-reset (+ confirm), change-password. Password reset and change sign out every other session |
| Audit log | `src/routes/auth.ts` | `auth.<event> ip=... user=... req=...` lines for signups, logins, failures, resets, and password changes. Passwords and tokens are never logged |
| Cleanup | `src/auth/cleanup.ts` | Hourly deletion of expired sessions, tokens, and rate-limit rows |
| Production guard | `src/env.ts` | Refuses to start in production without https origins and an email provider |
| CSRF | `src/app.ts` | SameSite=Lax plus Hono `csrf()` origin check, and a JSON-only API |

Tested in `test/auth.test.ts` and `test/account.test.ts`.

**Deliberate trade-off:** signup returns 409 for an email that's already registered, which is friendlier but reveals that the account exists. It's rate limited per IP. For a high-risk app, switch to "check your email" for every signup and send existing users a "you already have an account" email instead.

**The frontend must provide two pages:** `/verify-email?token=...` and `/reset-password?token=...` (paths relative to `APP_URL`). Each reads the token, POSTs it (verify on page load, reset together with the new password), then removes the token from the URL with `history.replaceState`. Set `<meta name="referrer" content="no-referrer">` on both pages so the token can't leak via the Referer header.

## Choosing when requirements grow
- Email + password, verification, reset, roles, teams: **the scaffold plus the patterns below**.
- MFA: TOTP is about 80 lines on top of the scaffold (`otpauth` package, a `totp_secret` column encrypted at rest, a second login step, and hashed recovery codes). Passkeys or WebAuthn are better done with Better Auth.
- "Sign in with Google/GitHub": add **Arctic** (`npm i arctic`, a small OAuth client) to the existing sessions. See the OAuth section.
- Many providers, passkeys, 2FA, organizations, magic links all at once: **Better Auth** (`npm i better-auth`, which has Drizzle and Hono adapters). It replaces `src/auth/*` and the auth routes. Use context7 for its current setup, and keep the cookie on the same origin.
- Hosted options (Clerk, Auth0, WorkOS, Supabase Auth) only when the user asks. They trade debuggability for features.

## Authorization patterns
- **Ownership** (the default): every query includes `eq(table.userId, user.id)`. A missing or foreign row is 404. This is the most common real-world bug (IDOR), so the `api-security-reviewer` agent checks it.
- **Roles**: add `role: text("role").notNull().default("user")` to `users`, include it in `PublicUser` and `validateSession`'s select, then:
  ```ts
  export const requireRole = (...roles: string[]) => createMiddleware<AppEnv>(async (c, next) => {
    const user = getUser(c);
    if (!roles.includes(user.role)) throw forbidden();   // 403: they're signed in, just not allowed
    await next();
  });
  ```
- **Teams/orgs**: a `memberships(userId, orgId, role)` table. Resources carry `orgId`. Load the membership once per request (`requireMember(orgIdFrom(c))`) and scope queries by `orgId`.
- Check permissions on the server for **every** action. Hiding a button in the UI is not access control.

## More account flows (same building blocks)
- **Change email**: require the current password, then `issueAuthToken` for the **new** address (add a `pending_email` column), and swap it in on confirmation. Notify the old address.
- **Delete account**: require the password. A cascading FK removes sessions and owned rows. Also remove the user's files and Mongo documents.
- **Sessions list ("your devices")**: add `createdAt`, `userAgent`, and `ip` columns to `sessions`, list them, and delete one by id (scoped to the user).
- New token purposes: add them to the `purpose` enum in `schema.ts` and to `TTL_MS` in `tokens.ts`, then generate a migration.

## OAuth with Arctic (social login)
1. Create the provider app with callback `http://localhost:5173/api/auth/github/callback`, the **frontend** origin, so the cookie lands on the right host through the proxy. Put `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `env.ts` and `.env` (never commit them).
2. `GET /auth/github`: `generateState()`, store it in a short-lived httpOnly cookie, redirect to `github.createAuthorizationURL(state, ["user:email"])`.
3. `GET /auth/github/callback`: compare the `state` query with the cookie (reject on mismatch), `validateAuthorizationCode(code)`, fetch the provider's user, then upsert into an `oauth_accounts(provider, providerUserId, userId)` table. Link to an existing user only if the provider says the email is verified. Then `createSession` and `setSessionCookie`, and redirect to the app.
4. Google needs PKCE (`generateCodeVerifier()` in a cookie too).

## Frontend side
- On app load, call `GET /api/auth/me`. 200 means the user object, 401 means signed out. Keep it in the server cache (TanStack Query key `["me"]`), not in localStorage.
- After login, signup, or logout, invalidate `["me"]`. On any 401 from the API, clear it and route to login.
- **Never** store tokens in localStorage or JS-readable cookies. The httpOnly cookie is the whole mechanism.
- Login form: `autocomplete="email"` and `"current-password"` (signup: `"new-password"`). Show `problem.detail` for 401 and 429, and field errors for 422.

## Debugging auth
| Symptom | Check |
|---|---|
| Login works, next request is 401 | Is the cookie stored? Browser devtools: Application, then Cookies. Calling the API cross-origin without the proxy means the cookie isn't sent. Use the proxy (or `credentials: "include"` plus CORS `WEB_ORIGIN`) |
| Cookie missing in production | `Secure` requires HTTPS. Check the proxy forwards `Set-Cookie`, and that the frontend and API share a site |
| 403 "Cross-site request blocked" | Request `Origin` isn't in `WEB_ORIGIN`. Fix the env var (exact scheme, host, and port) |
| 429 on login | Per-account (10 per 15 minutes) or per-IP (30 per 15 minutes) limit: `select * from rate_limits where key like 'login:%';`. Delete the row to unlock early. Behind a proxy, set `TRUST_PROXY` to the number of proxies, or every user shares the proxy's IP |
| Verification/reset email never arrives | Dev: the link is in `devctl logs api --grep token=`. Prod: look for `[email] delivery failed` lines, and check the Resend domain is verified and `EMAIL_FROM` uses it |
| Who is logged in? | `select u.email, s.expires_at from sessions s join users u on u.id = s.user_id order by s.expires_at desc;` |
