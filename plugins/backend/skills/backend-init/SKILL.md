---
name: backend-init
description: Create a production-ready backend for a project - scaffold a tested TypeScript REST API (Hono + Drizzle + zod, full account auth, job queue, structured logs, Dockerfile, CI) with SQLite or Postgres and optional MongoDB, wire it to the frontend dev server, and record ports/commands in BACKEND.md. Use when a project needs a backend, API, database, or login and has none yet, or when BACKEND.md is missing.
argument-hint: "[sqlite|postgres] [+mongo]"
---

# Initialize a backend

Start from the scaffold, not from a blank file. It is a working, tested app that already has auth, validation, errors, security middleware, and docs, so time goes into the product's own endpoints.

## 1. Look before creating
- Is there already a backend? Look for `api/`, `server/`, `backend/`, `apps/api`, framework route files (`app/api/**/route.ts`, `pages/api`), `docker-compose.yml`, and `BACKEND.md`. If one exists, follow its conventions and skip to step 4.
- Find the frontend: `vite.config.*` (dev port 5173 by default), `next.config.*` (port 3000), or another framework. Note its directory and dev port.
- Check tools: `node -v` (needs 22.18+, which runs `.ts` files directly), and `docker info` if Postgres or Mongo is wanted.

## 2. Pick the database (ask only if the user hasn't said)
| Choice | When |
|---|---|
| `--db sqlite` (default) | Prototypes and single-server apps. Zero setup: the database is one file you can open with `sqlite3`. |
| `--db postgres` | Production-bound apps, several server instances, heavy concurrent writes, or Postgres features (JSONB, full-text search, extensions). Runs in Docker. |
| `--mongo` (adds to either) | Documents whose shape varies a lot, or when the user asks for MongoDB. Keep users and sessions relational either way. |

It's fine to start on SQLite and move to Postgres later (see the `relational-db` skill).

## 3. Scaffold and verify
```bash
api-scaffold api --db sqlite --web-origin http://localhost:5173    # add --mongo / --db postgres as chosen
cd api && npm install
docker compose up -d --wait                                         # only if Postgres/Mongo
npm run db:generate && npm run db:migrate && npm test               # tests must pass before you change anything
npm run openapi && git add -A && git commit -m "Add API"             # CI checks drizzle/ and openapi.json are committed
```
The scaffold also writes `.github/workflows/<dir>.yml` at the project root (typecheck, migration and contract drift, tests, audit, Docker build). Skip it with `--no-ci`.
`api-scaffold` picks free ports if 8787/5432/27017 are taken and prints the ones it used. Pass the frontend's real origin (for example `http://localhost:3000` for Next.js). It must match exactly, or cookies and CSRF checks will fail.

Start it for the session with `devctl`, never in the foreground:
```bash
devctl start api --port 8787 --cwd api -- npm run dev
curl -s localhost:8787/api/health
```

## 4. Wire the frontend
- **Proxy `/api` to the backend** so the browser sees one origin, cookies work with `SameSite=Lax`, and CORS never comes up:
  - Vite: `server: { proxy: { "/api": "http://localhost:8787" } }` in `vite.config.ts`.
  - Next.js: `async rewrites() { return [{ source: "/api/:path*", destination: "http://localhost:8787/api/:path*" }] }`. Don't also create `app/api` route handlers, or the two will collide.
- **Typed client** (see the `rest-api` skill): `npm run openapi` in `api/`, then in the frontend `npx openapi-typescript ../api/openapi.json -o src/lib/api-types.ts` and `npm i openapi-fetch`.
- Start the frontend under devctl too: `devctl start web --port 5173 --cwd web -- npm run dev`.

## 5. Write BACKEND.md and link it
Create `BACKEND.md` at the project root and add `@BACKEND.md` to `CLAUDE.md`, so later sessions don't re-derive any of this:
```markdown
# Backend
- Code: `api/` (Hono + Drizzle + zod). Contract: `api/openapi.json` (regenerate: `npm run openapi`). Docs UI: http://localhost:8787/api/docs
- Database: <SQLite file api/data/app.db | Postgres in Docker on 127.0.0.1:5432> <+ MongoDB on 27017>
- Run: `devctl start api --port 8787 --cwd api -- npm run dev` · frontend: `devctl start web --port 5173 --cwd web -- npm run dev`
- Test: `cd api && npm test` · Types: `npm run typecheck` · Migrations: `npm run db:generate && npm run db:migrate`
- Auth: cookie sessions (`session`, `__Host-session` in prod), verification and reset emails via the job queue. Frontend calls `/api/*` through the dev proxy and has /verify-email and /reset-password pages.
- Jobs: `jobs` table, worker inside the API (RUN_WORKER). Failed: `select * from jobs where failed_at is not null`
- Deploy: <host, release command, where logs live, how to roll back, how to restore a backup>
- Env vars: see `api/.env.example`. Frontend origin(s): WEB_ORIGIN.
## Resources
| Path | Owner-scoped | Notes |
```
Keep the Resources table current as endpoints are added.

## 6. Clean out the examples when they're no longer useful
`todos` (and `notes` with Mongo) are examples. Copy one as the pattern for the first real resource, then delete the example's route, schema, tests, and its mount line in `src/app.ts`, and generate a migration.
