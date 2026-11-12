# API

TypeScript REST API: [Hono](https://hono.dev) on Node, [Drizzle ORM](https://orm.drizzle.team), zod validation, cookie-session auth, a database-backed job queue, and an OpenAPI contract the frontend consumes. Node runs the `.ts` files directly; there is no build step.

## Run it

```bash
npm install
<!-- scaffold:docker -->
docker compose up -d          # start the databases (see docker-compose.yml)
<!-- /scaffold:docker -->
npm run db:migrate            # create tables
npm run db:seed               # optional: demo@example.com / demo-password
npm run dev                   # http://localhost:__PORT__/api, restarts on file changes
```

Open **http://localhost:__PORT__/api/docs** to see and try every endpoint.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-restart (`node --watch`) |
| `npm test` | Run the tests in-process against the test database |
| `npm run typecheck` | Type-check with `tsc` |
| `npm run db:generate` | Write a SQL migration in `drizzle/` from changes to `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Browse and edit data in a web UI |
| `npm run openapi` | Write the API contract to `openapi.json` (commit it; CI checks it's current) |
| `npm run worker` | Run background jobs in a separate process (with `RUN_WORKER=false` on the API) |

## Layout

```
src/index.ts          start the server
src/app.ts            middleware, route mounting, error handler, /api/docs
src/env.ts            every environment variable, validated
src/routes/*.ts       one file per resource (todos.ts is the example to copy)
src/auth/             password hashing, sessions, requireUser/getUser
src/db/schema.ts      tables; src/db/client.ts connection
src/jobs/             background job queue (queue.ts) and job handlers (handlers.ts)
src/lib/              errors (problem+json), logging, email, router factory, rate limiter
src/worker.ts         standalone job worker (npm run worker)
Dockerfile            production image
drizzle/              generated SQL migrations (commit these)
test/                 vitest tests using app.request()
```

## Debugging

- **Every request is logged** with its status, duration, user, and `req=<id>`. Error responses and the `X-Request-Id` header carry the same id, so search the log for it. Production logs are JSON lines; `LOG_LEVEL=debug` shows more.
- **Background jobs** (emails and other work) live in the `jobs` table. `select type, attempts, last_error from jobs;` shows what's pending or failing.
- **Unexpected errors** print a full stack trace to the console. In development the response `detail` also contains the message.
- **Call an endpoint by hand:**
  ```bash
  curl -i -c /tmp/jar -H 'Content-Type: application/json' \
    -d '{"email":"demo@example.com","password":"demo-password"}' localhost:__PORT__/api/auth/login
  curl -i -b /tmp/jar localhost:__PORT__/api/todos
  ```
  POST/PATCH/DELETE requests without a JSON body need `-H 'Origin: <WEB_ORIGIN>'`, or the CSRF check returns 403.
- **Step through code:** `node --inspect --env-file-if-exists=.env src/index.ts`, then open `chrome://inspect` (or use VS Code's "JavaScript Debug Terminal" and run `npm run dev`).
<!-- scaffold:sqlite -->
- **Look at the data:** `sqlite3 data/app.db '.tables'` or `npm run db:studio`. To start over, stop the server, delete `data/app.db`, and run `npm run db:migrate`.
<!-- /scaffold:sqlite -->
<!-- scaffold:postgres -->
- **Look at the data:** `docker compose exec postgres psql -U app app` (try `\dt`, `\d todos`) or `npm run db:studio`.
- **Start over:** `docker compose down -v && docker compose up -d && npm run db:migrate` (`-v` deletes all data).
<!-- /scaffold:postgres -->
<!-- scaffold:mongo -->
- **Look at Mongo:** `docker compose exec mongo mongosh app` (try `db.notes.find().limit(5)`).
<!-- /scaffold:mongo -->
- **"no such table" / "relation does not exist":** run `npm run db:migrate`.
- **Port already in use:** `lsof -i :__PORT__` shows what's holding it.

## Auth

Email + password with database sessions. See `src/routes/auth.ts` for the endpoints.
- Signup sends a verification link. Password reset emails a 30-minute link. In development both are printed in the server log (`devctl logs api --grep token=`).
- The frontend needs `/verify-email?token=` and `/reset-password?token=` pages that POST the token to `/api/auth/verify-email` and `/api/auth/password-reset/confirm`.
- Brute-force limits are stored in `rate_limits`. To unlock an account early: `delete from rate_limits where key = 'login:account:<email>';`
- Security events log as `auth.<event> ip=... user=... req=...`.

## Going to production

The server refuses to start with `NODE_ENV=production` unless `WEB_ORIGIN` (and `APP_URL`, if set) are https and `RESEND_API_KEY` is set.
```bash
docker build -t api .
docker run --rm --env-file prod.env api node src/db/migrate.ts     # release step: once per deploy, before starting
docker run -d --env-file prod.env -p 8787:8787 api                 # SQLite: add -v apidata:/app/data
```
- `prod.env`: `NODE_ENV=production`, `WEB_ORIGIN=https://your.app`, `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` (on a verified domain), and `TRUST_PROXY=<number of proxies in front>`.
- Health checks: liveness `GET /api/health/live`, readiness `GET /api/health`. SIGTERM drains requests and jobs for up to 10 seconds.
- Serve over HTTPS on the same origin as the frontend, back up the database (and test a restore), and alert on `"level":"error"` log lines.

## Frontend

The frontend dev server proxies `/api` to this server, so the browser sees one origin and the session cookie just works. For Vite:

```ts
// vite.config.ts
server: { proxy: { "/api": "http://localhost:__PORT__" } }
```

Typed client: `npm run openapi`, then in the frontend `npx openapi-typescript ../api/openapi.json -o src/lib/api-types.ts` and use `openapi-fetch`.
