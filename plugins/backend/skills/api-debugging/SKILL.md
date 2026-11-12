---
name: api-debugging
description: Debug and test the backend - reproduce with a failing test or curl, trace a request by requestId in devctl logs, inspect the database, attach the Node inspector, and fix common errors (migrations, ports, cookies, CORS/CSRF, Docker). Use when an endpoint fails, returns the wrong data, the server won't start, tests fail, or the frontend can't reach the API.
argument-hint: "[symptom]"
---

# Debugging and testing the API

Reproduce, then find the cause, then fix, then lock it in with a test. Don't change code until you can reproduce the bug.

## 1. Reproduce
- **Best: a failing test.** Add a case to `api/test/*.test.ts` using the `client()` / `signedInClient()` helpers, which call the app in-process (no server, about 1 second). `npx vitest run test/todos.test.ts -t "hides other"` runs one test.
- **Live server:** `devctl status`, and start it if it's down. Then curl:
  ```bash
  curl -si -c /tmp/jar -H 'Content-Type: application/json' -d '{"email":"demo@example.com","password":"demo-password"}' localhost:8787/api/auth/login
  curl -si -b /tmp/jar localhost:8787/api/todos
  ```
  Body-less POST/DELETE needs `-H 'Origin: http://localhost:5173'` (the CSRF check). Seed a demo user with `npm run db:seed`.
- **Through the frontend:** use the frontend's port (`localhost:5173/api/...`) to test the proxy path, or check the Playwright MCP network panel.

## 2. Locate
- Every response from a failed request has a `requestId`. Find the matching log line and stack: `devctl logs api --grep <requestId>` or `devctl logs api -n 100 --grep "error|warn"`.
- 500s print the full stack. In development the response `detail` contains the error message.
- Check the data directly: `sqlite3 api/data/app.db "select ..."` / `docker compose exec postgres psql -U app app -c "select ..."` / `docker compose exec mongo mongosh app --eval "db.notes.find().limit(3)"`.
- Log what Drizzle actually ran: `drizzle(client, { schema, logger: true })` temporarily.
- Step through code: `node --inspect-brk --env-file-if-exists=.env src/index.ts`, then open `chrome://inspect`. A human can use VS Code's JavaScript Debug Terminal with `npm run dev`.

## 3. Common causes
| Symptom | Cause, then fix |
|---|---|
| `no such table` / `relation ... does not exist` | Migrations not applied, so run `npm run db:migrate`. In tests, the migration wasn't generated: `npm run db:generate` |
| Server exits at start: "Invalid environment variables" | Missing or invalid `.env` entry. Compare with `.env.example` |
| "Cannot reach the database" | Docker databases not running: `docker compose up -d --wait`, `docker compose ps`, `docker compose logs postgres` |
| Mongo container exits immediately | Check `docker compose logs mongo`. `mongo:8` fails on some Docker VM kernels, so pin `mongo:7.0` |
| `EADDRINUSE` / devctl "port in use" | `lsof -nP -iTCP:8787 -sTCP:LISTEN`. Stop the stale process (`devctl stop api`) or pick another port in `.env` and the proxy |
| 401 right after login | Cookie not sent. The frontend is calling `http://localhost:8787` directly instead of `/api` through the proxy |
| 403 "Cross-site request blocked" | `Origin` isn't in `WEB_ORIGIN`. It must match exactly (`http://localhost:5173`, no trailing slash) |
| CORS error in the browser | Same root cause: use the proxy. If cross-origin is truly needed, add the origin to `WEB_ORIGIN` and use `credentials: "include"` |
| 422 you didn't expect | Read `errors[]` in the response: path and message for each failing field |
| 404 for a row that exists | Ownership scoping: it belongs to another user (by design), or the wrong `userId` was written |
| Types out of sync with the frontend | `npm run openapi` in api, regenerate `api-types.ts`, then run `tsc` in the frontend |
| `node --watch` didn't pick up a change | It only watches imported files. `.env` changes need `devctl restart api` |
| Emails not arriving | `select * from jobs where type = 'email.send';`. Is `last_error` set (bad key, unverified domain)? Is the worker running (`RUN_WORKER`, or a separate `npm run worker`)? |
| Tests pass alone, fail together | Shared state: tests must create their own users/data (`signedInClient()` makes a fresh user) |

## Debugging in production
- Production logs are one JSON object per line. Every request logs `msg` (method + path), `status`, `ms`, `user`, and `req`. Errors log `error`, `stack`, and sometimes a `hint`.
  ```bash
  docker compose logs api --since 1h | grep '"level":"error"'
  docker compose logs api | grep <requestId>                        # everything about one request
  docker compose logs api | grep '"msg":"auth.login_failed"' | tail  # brute-force or confused user?
  ```
  With `jq`: `... | jq -c 'select(.status >= 500)'`.
- Users can tell you the request id: it's in every error body and in the `X-Request-Id` response header (browser devtools, Network tab).
- Failed background work: `select type, attempts, last_error from jobs where failed_at is not null order by created_at desc limit 20;`
- Raise detail temporarily with `LOG_LEVEL=debug`, then restart. Turn it back off afterward.
- Reproduce locally against a **copy** of the data (restore last night's backup into a scratch database), never by experimenting on production.

## 4. Lock it in
Add or keep the reproducing test, then run `npm test && npm run typecheck`. If the bug crossed the frontend/backend boundary, also regenerate the contract types and typecheck the frontend.
