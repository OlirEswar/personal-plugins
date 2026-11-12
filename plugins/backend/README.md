# backend

A setup for building production-ready backends that a human can read and debug, and full-stack apps when combined with `frontend` (`/setups:use frontend backend`).

**Stack:** Node 22.18+ running TypeScript directly (no build step), [Hono](https://hono.dev) with [`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi), [Drizzle ORM](https://orm.drizzle.team) on SQLite (default, one file) or Postgres (Docker), optional MongoDB, and vitest. Everything a human might need to debug is plain: one file per resource, handlers that call the database directly, SQL migration files, request-id-tagged logs (readable in dev, JSON in production), background jobs in a table you can query, a Swagger UI at `/api/docs`, and `sqlite3`/`psql`/`mongosh` for the data.

## Prerequisites

- Node 22.18+ (runs `.ts` files natively) and npm
- Python 3 (`api-scaffold`, `devctl`, and the guard hook use only the stdlib)
- Docker, only for Postgres/MongoDB/Redis (`docker compose`)
- Optional CLIs for poking at data: `sqlite3` (preinstalled on macOS), `psql` and `mongosh` (or use `docker compose exec`)
- TypeScript LSP: `npm i -g typescript-language-server typescript`

## How it fits together

```
project/
  web/   frontend (frontend setup)        devctl start web --port 5173 --cwd web -- npm run dev
  api/   backend (api-scaffold)           devctl start api --port 8787 --cwd api -- npm run dev
         openapi.json  <- the contract; web generates typed client from it
  .dev/  devctl pids + logs (git-ignored)
```
The frontend dev server proxies `/api` to the API, so the browser sees one origin: the session cookie works with `SameSite=Lax`, with no CORS setup. The `fullstack` skill runs contract-first. It stubs the endpoints, exports `openapi.json`, then builds the UI and the backend in parallel (`backend-builder` agent), and verifies the result in a real browser.

## What the scaffold gives you (tested)

`api-scaffold [dir] [--db sqlite|postgres] [--mongo] [--port N] [--web-origin URL]` creates:
- launch-ready email/password **auth**: scrypt hashing, breached-password rejection (haveibeenpwned), database sessions with hashed tokens in `__Host-` httpOnly/Secure/SameSite cookies, email verification, password reset, change password, sign out everywhere, per-IP and per-account brute-force limits stored in the DB, auth audit log lines, and a production config guard (https origins and an email provider required). MFA and social login are documented add-ons (the `auth` skill)
- an example owner-scoped **CRUD resource** with cursor pagination (plus a MongoDB one with `--mongo`)
- zod **validation** and RFC 9457 **problem+json** errors with per-field details and a `requestId` that also appears in the logs
- **security** middleware: secure headers, CORS allowlist, CSRF origin check, body limit
- **OpenAPI 3.1** at `/api/openapi.json`, Swagger UI at `/api/docs`, `npm run openapi` to write the contract file
- a durable **job queue** in the database (retries with backoff, failed jobs kept for inspection) used for all email; run it in-process or as `npm run worker`
- structured **logging** (`log.info(msg, fields)`: readable lines in dev, JSON in production) with request and user ids, and process-level crash handlers
- **operations:** liveness and readiness health checks, graceful shutdown that drains requests and jobs, docs off in production, SQLite tuned for production (WAL, busy timeout)
- **shipping:** a production `Dockerfile` (non-root, health check, migrations as a release step) and a GitHub Actions workflow (typecheck, committed-migration and `openapi.json` drift checks, tests against real Postgres/Mongo services, `npm audit`, image build)
- Drizzle **migrations**, seed script, `docker-compose.yml` for local databases bound to 127.0.0.1
- in-process **tests** (`app.request`, no server) covering auth and account flows, brute-force lockout, proxy IP parsing, CSRF, ownership isolation, pagination, and validation

## Contents

| Kind | Name | Purpose |
|---|---|---|
| skill | `backend-init` | Pick the database, scaffold, verify, wire the frontend proxy and typed client, write `BACKEND.md` |
| skill | `fullstack` | Contract-first parallel frontend + backend workflow, devctl, integration check in the browser, deploy shape |
| skill | `rest-api` | House rules for readable code, adding resources, REST conventions, validation, pagination, idempotency, typed `openapi-fetch` client |
| skill | `relational-db` | Drizzle schema, the migration workflow, queries, transactions, indexes, inspection, SQLite to Postgres |
| skill | `nosql` | MongoDB modeling, validation, indexes, injection safety; Redis for cache, rate limits, queues |
| skill | `auth` | What the built-in auth does and why, frontend pages it needs, roles and teams, MFA, OAuth (Arctic) or Better Auth, debugging |
| skill | `api-security` | 15-point checklist, each item with a command to verify it, plus production switches |
| skill | `backend-recipes` | Uploads, jobs and cron on the built-in queue, email, webhooks, SSE, caching, third-party APIs |
| skill | `deploy` | Hosting shapes, release process (migrations once), VPS + Caddy recipe, secrets, logs and alerts, backups and restore drills, zero-downtime migrations, scaling, launch checklist |
| skill | `api-debugging` | Reproduce, trace by requestId, inspect data and failed jobs, use the inspector, debug in production; a common-errors table |
| agent | `backend-builder` | Implements the backend half against the contract, in parallel with frontend work |
| agent | `api-security-reviewer` | Read-only security review with exploit scenarios and fixes |
| agent | `launch-reviewer` | Read-only production-readiness review (release, config, observability, backups, auth flows, operability), go/no-go |
| bin | `api-scaffold` | Creates the API from `templates/api` plus a CI workflow (picks free ports, never overwrites) |
| bin | `devctl` | Background dev servers: `start`/`stop`/`restart`/`status`/`logs`/`wait`, with logs in `.dev/logs/` |
| hook | PreToolUse(Bash) | Denies foreground dev servers and watchers (use devctl); asks before `down -v`, `DROP`, `TRUNCATE`, `FLUSHALL`, deleting `.db` files |
| dep | `context7` | Current docs for Hono, Drizzle, zod, and the MongoDB driver (official marketplace) |
| dep | `typescript-lsp` | TS code intelligence (official marketplace) |

## Maintaining the template

Dependency versions live in `bin/api-scaffold` (`DEPS`). After bumping them or editing `templates/api`, scaffold every variant into a temp directory and run `npm install && npm run db:generate && npm run db:migrate && npm run typecheck && npm test`: SQLite, then `--db postgres --mongo` (with `docker compose up -d --wait`). Also `docker build` the image and run it with production env (migrate as a one-off, then start), and lint the generated workflow with `actionlint`.

## Optional official plugins worth adding per project

`security-guidance` (edit-time security warnings and LLM review on stop; heavier), `mongodb` (MCP for a live cluster), `redis-development`, `stripe`, `sentry`.
