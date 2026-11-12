---
name: api-security
description: Secure a backend API - access control (IDOR), input validation, injection (SQL/NoSQL), auth and session hardening, CSRF/CORS, secrets, rate limits, security headers, error leakage, file uploads, SSRF, and dependency audits, with commands to verify each. Use before shipping, after adding endpoints that touch user data, when handling secrets or uploads, or when the user asks about security.
argument-hint: "[area or endpoint]"
---

# API security

Most real breaches in small apps come from the first three rows. Check them on every new endpoint. For a full independent pass, run the `api-security-reviewer` agent.

## Checklist
| # | Risk | Rule | Verify |
|---|---|---|---|
| 1 | **Broken access control (IDOR)** | Every read and write is scoped to the caller (`userId`/`orgId` in the `WHERE`). Foreign ids return 404. Role checks happen server-side | A test where user B requests user A's id for GET, PATCH, and DELETE and gets 404 (see `test/todos.test.ts`) |
| 2 | **Missing auth** | Routers are protected by default with `router.use("*", requireUser)`. Public endpoints are deliberate and few | `grep -L "requireUser" api/src/routes/*.ts`, then justify each file it lists |
| 3 | **Injection** | Drizzle query builder or `sql\`\`` templates only. Never concatenate SQL or use `sql.raw` with input. Mongo filters are built from typed values, never raw request JSON | `grep -rn "sql.raw\|\.unsafe(\|\$where\|find(c.req" api/src` |
| 4 | **Mass assignment** | Insert and update with explicit fields from a zod schema. Never `.set(body)` where body could include `userId`, `role`, or `id` | Schemas list only client-editable fields |
| 5 | **Input limits** | `.max()` on every string and array, a page-size cap, a 1 MB body limit (already in `app.ts`), and a password max of 128 | Send oversized payloads and expect 422 or 413 |
| 6 | **Auth hardening** | Keep what the scaffold has: scrypt, breached-password check, hashed session and link tokens, `__Host-` httpOnly/SameSite/Secure cookies, per-IP and per-account limits, generic "wrong email or password", every session ended on password reset/change. Don't weaken any of it for convenience | `test/auth.test.ts` and `test/account.test.ts` |
| 7 | **CSRF/CORS** | Cookies `SameSite=Lax`, `csrf()` origin check, JSON-only bodies. CORS `origin` is an explicit allowlist (`WEB_ORIGIN`), never `*` with credentials | `curl -X POST -H 'Origin: https://evil.example' -H 'Content-Type: text/plain' .../api/auth/logout` returns 403 |
| 8 | **Secrets** | In `.env` (git-ignored) and read through `src/env.ts`. `.env.example` has placeholders only. Never log secrets, tokens, or passwords | `git ls-files \| grep -E '\.env$'` prints nothing. `grep -rniE "(api[_-]?key\|secret\|password)\s*[:=]\s*['\"][^'\"]{8,}" api/src` prints nothing |
| 9 | **Error leakage** | Production 500s say "Something went wrong" plus `requestId`. Stacks go only to the server log | Run with `NODE_ENV=production` and trigger an error |
| 10 | **Headers** | `secureHeaders()` (nosniff, frame options, HSTS, referrer policy) is in `app.ts`. Add a CSP when the API serves HTML | `curl -sI .../api/health` |
| 11 | **Rate limits** | On auth (built in), on expensive endpoints, and on anything that sends email/SMS: `enforceLimit(c, key, max, windowMs, what)` with an IP, user, or email key. Stored in the DB, so they hold across instances | `test/account.test.ts` locks an account after 10 failures |
| 12 | **Uploads** | Size cap, allowlisted MIME types checked by magic bytes, random server-side filenames, stored outside the web root or in object storage, served with `Content-Disposition` | See `backend-recipes` |
| 13 | **SSRF** | Any "fetch this URL" feature: allowlist hosts, `https` only, block private and link-local IPs after DNS resolution, short timeouts | |
| 14 | **Dependencies** | Few, well-known packages. Pinned via lockfile. Audited | `npm audit --omit=dev`. Review `npm approve-scripts` prompts instead of blanket-allowing install scripts |
| 15 | **Logging** | Log request id, user id, route, and status. Never log bodies of auth routes, cookies, or tokens. Record security events (login failures, permission denials) | |

## Production switches
`NODE_ENV=production` (`__Host-` Secure cookies, generic errors; the app refuses to start without https origins and `RESEND_API_KEY`), HTTPS everywhere, `WEB_ORIGIN`/`APP_URL` set to the real origin, `TRUST_PROXY` set to the exact number of proxies you run (too high lets clients forge their IP; 0 behind a proxy makes every user share one rate-limit bucket), a verified sending domain for `EMAIL_FROM`, a database user with least privilege (no superuser), backups on, and Docker database ports bound to `127.0.0.1` (the scaffold does this) or not published at all.

## When writing new code
- New endpoint: write the "other user gets 404" test and the 422 test in the same change.
- New env var: add it to `env.ts` with validation, and a placeholder to `.env.example`.
- Accepting HTML or Markdown that's rendered later: sanitize on output in the frontend (DOMPurify). Store the raw input.
- Webhooks: verify the provider signature on the **raw** body before parsing (see `backend-recipes`).
