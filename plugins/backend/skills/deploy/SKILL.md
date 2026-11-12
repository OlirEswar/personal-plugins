---
name: deploy
description: Ship and operate the app in production - choose a host, build the Docker image, serve frontend and API from one origin over HTTPS, run migrations as a release step, configure env and secrets, health checks, logs and error tracking, backups and restores, zero-downtime schema changes, scaling past one instance, and a launch checklist. Use when deploying, preparing to launch, setting up CI/CD, or operating/troubleshooting a production backend.
argument-hint: "[platform or task]"
---

# Deploy and operate

The scaffold already ships the production pieces: `Dockerfile`, `/api/health/live` and `/api/health`, JSON logs in production, graceful shutdown on SIGTERM, a durable job queue, an env check that refuses unsafe production config, and a CI workflow (`.github/workflows/<api>.yml`). This skill puts them together.

## 1. Pick the shape (simplest that fits)
| Shape | When | Database |
|---|---|---|
| **One VPS + Docker Compose + Caddy** | Most launches. Cheap, everything visible, a human can `ssh` in and read logs | SQLite on the host disk (back up with Litestream) or Postgres in compose |
| **Managed container platform** (Fly.io, Railway, Render) | You don't want to manage a server | Their managed Postgres. SQLite needs a persistent volume and exactly one instance |
| **Separate frontend host** (Vercel/Netlify) **+ API on a platform** | The frontend team already deploys there | Managed Postgres |

Prefer **one origin** (`https://app.com` serves the frontend, and `https://app.com/api` proxies to the API). Cookies, CSRF, and CORS then work exactly as in development. With separate hosts, use subdomains of one site (`app.com` and `api.app.com`), set `WEB_ORIGIN=https://app.com`, and call the API with `credentials: "include"`.

## 2. Release process (every deploy)
1. CI is green: typecheck, committed migrations, tests, `openapi.json` current, audit, image builds.
2. Build the image: `docker build -t api:<git-sha> ./api`.
3. **Run migrations once**, as a separate step before new instances start: `docker run --rm --env-file prod.env api:<sha> node src/db/migrate.ts`. Never migrate from every instance's startup, because they race. Platforms call this a "release command" (Fly: `[deploy] release_command`, Railway: pre-deploy command, Render: pre-deploy command).
4. Start the new instances. The platform waits for `/api/health` before routing traffic, and SIGTERM lets old instances finish in-flight requests (up to 10 seconds).
5. Smoke test: `curl -fsS https://app.com/api/health`, then sign in on the real site.

## 3. VPS recipe (Compose + Caddy, automatic HTTPS)
```yaml
# deploy/docker-compose.prod.yml
services:
  api:
    image: api:latest            # or build: ../api
    env_file: ./prod.env         # chmod 600; never committed
    volumes: [apidata:/app/data] # SQLite only
    restart: unless-stopped
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes: [./Caddyfile:/etc/caddy/Caddyfile:ro, ./web-dist:/srv:ro, caddydata:/data]
    restart: unless-stopped
volumes: { apidata: {}, caddydata: {} }
```
```
# deploy/Caddyfile
app.example.com {
  handle /api/* { reverse_proxy api:8787 }
  handle { root * /srv; try_files {path} /index.html; file_server }
}
```
`prod.env`: `NODE_ENV=production`, `WEB_ORIGIN=https://app.example.com`, `TRUST_PROXY=1` (Caddy is one hop), `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`. Deploy with `docker compose -f deploy/docker-compose.prod.yml run --rm api node src/db/migrate.ts && docker compose -f deploy/docker-compose.prod.yml up -d`.

## 4. Configuration and secrets
- All config is env vars validated in `src/env.ts`. The app refuses to start in production without https origins and an email provider.
- Secrets live in the platform's secret store or a `chmod 600` env file on the server, never in git or the image. `.dockerignore` excludes `.env*`.
- `TRUST_PROXY` = the exact number of proxies in front of the API (Caddy or a platform router = 1; Cloudflare + platform = 2). Verify with an `auth.login` log line: `ip` should be your real IP.
- Rotate a leaked secret immediately. For a leaked database, also run `delete from sessions;` to sign everyone out.

## 5. Observability
- **Logs:** production writes one JSON object per line to stdout (`level`, `msg`, `req`, `user`, `status`, `ms`). Search by request id: `docker compose logs api | grep <requestId>`. Ship stdout to the platform's log viewer, or to Better Stack, Axiom, or Grafana Loki. `LOG_LEVEL=debug` temporarily for more detail.
- **Alerts worth having on day one:** `/api/health` uptime check (Better Stack, UptimeRobot), any `"level":"error"` line, `job failed permanently`, and the 5xx rate.
- **Error tracking (recommended):** `npm i @sentry/node`, init it at the top of `src/index.ts` with `SENTRY_DSN` from `env.ts`, and call `Sentry.captureException(err, { tags: { requestId } })` inside `app.onError`'s unhandled branch.
- **Failed jobs:** `select type, attempts, last_error, failed_at from jobs where failed_at is not null;`. Retry one by clearing `failed_at` and setting `attempts = 0`, `run_at = now`.

## 6. Backups (test the restore, or it isn't a backup)
- **Postgres:** the managed provider's point-in-time recovery, plus a nightly `pg_dump -Fc "$DATABASE_URL" > backup-$(date +%F).dump` copied off the server. Restore drill: `pg_restore -d <scratch-db> backup.dump`, then run the app against it.
- **SQLite:** [Litestream](https://litestream.io) streams the WAL to S3 or R2 continuously (`litestream replicate /app/data/app.db s3://bucket/app.db`). A simple fallback is a nightly `sqlite3 app.db ".backup backup.db"`. Never copy a live `.db` file with `cp`.
- **MongoDB:** the Atlas backup policy, or `mongodump --uri "$MONGODB_URL" --archive=backup.gz --gzip`.
- Write the restore steps into `BACKEND.md`.

## 7. Schema changes without downtime (expand, then contract)
Old and new code run side by side during a deploy, so every migration must work with **both**:
1. **Expand:** add nullable columns or new tables, deploy code that writes both old and new, then backfill in batches.
2. **Switch:** deploy code that reads the new shape.
3. **Contract:** a later deploy drops the old column.
Never rename a column in one step (it's drop + add, so data is lost and old code breaks). Add `NOT NULL` only after the backfill. On big Postgres tables, build indexes with `create index concurrently ...` run by hand in `psql` before the deploy. It can't run inside a transaction, and Drizzle's migrator uses one. Then change the generated migration to `create index if not exists ...` so it becomes a no-op.

## 8. Scaling past one instance
Everything in the scaffold is already multi-instance safe: sessions, rate limits, and jobs all live in the database. When you add instances: switch SQLite to Postgres (see `relational-db`), set `RUN_WORKER=false` on the API and run `npm run worker` as its own service, and size the Postgres pool (`max` in `client.ts`) times instances below the database's connection limit. Add Redis only for things the database can't do well, like high-rate counters and pub/sub fan-out.

## Launch checklist
- [ ] CI green on main; production deploys only from main
- [ ] `NODE_ENV=production`, https `WEB_ORIGIN`/`APP_URL`, correct `TRUST_PROXY`, `RESEND_API_KEY` + verified `EMAIL_FROM` domain
- [ ] Frontend and API on one origin (or same-site subdomains) over HTTPS; `/api/docs` off (default)
- [ ] Migrations run as a release step; `drizzle/` committed
- [ ] Health checks wired: liveness `/api/health/live`, readiness `/api/health`
- [ ] Backups automated **and a restore tested**
- [ ] Uptime check + error alerts + log search set up
- [ ] Password reset and email verification work end to end on the real domain (check spam folders)
- [ ] `api-security-reviewer` run with no critical/high findings; `npm audit --omit=dev` clean
- [ ] `launch-reviewer` agent run on the whole project
- [ ] `BACKEND.md` has deploy, rollback, and restore steps a human can follow at 3am
