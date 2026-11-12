---
name: backend-recipes
description: Recipes for common backend tasks on the Hono + Drizzle stack - file uploads, background jobs and cron (built-in queue), sending email, verifying webhooks, server-sent events, caching, and calling third-party APIs. Use when a feature needs one of these beyond plain CRUD.
argument-hint: "[uploads|jobs|email|webhooks|sse|caching|...]"
---

# Backend recipes

Each recipe starts with the simplest version that's reliable for one server. Upgrade only when a real limit is hit. Check current library APIs with context7.

## File uploads
```ts
// POST /api/files: multipart/form-data with field "file"
app.post("/api/files", requireUser, bodyLimit({ maxSize: 10 * 1024 * 1024 }), async (c) => {
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) throw badRequest("file is required");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);                       // check magic bytes: PNG 89 50 4E 47, JPEG FF D8 FF, PDF 25 50 44 46
  if (!type) throw new HttpError(422, "Only PNG, JPEG, or PDF");
  const key = `${crypto.randomUUID()}.${type.ext}`; // never trust file.name for paths
  await writeFile(join("data/uploads", key), bytes);
  // insert into files(id, userId, key, mime, size, originalName) and return its id
});
```
- Serve files through an authorized `GET /api/files/{id}` that checks ownership, with `Content-Type` from the DB and `Content-Disposition: attachment` for anything that isn't an image.
- Raise the global 1 MB `bodyLimit` only on upload routes.
- To scale out: S3-compatible storage (AWS S3, Cloudflare R2, MinIO in compose for local) using **presigned PUT URLs**, so the browser uploads directly and the API only signs and records.

## Background jobs and cron (built in)
The scaffold has a durable queue in the `jobs` table (`src/jobs/`). Use it for anything slow or anything that must not be lost: emails, webhooks to other services, image processing, reports.
- Add a handler in `src/jobs/handlers.ts`, then `await enqueue("thing.do", payload, { delayMs, maxAttempts })` from a route. Payloads are JSON: pass ids, not whole rows, and re-read fresh data in the handler.
- Handlers must be **idempotent**, because a crash between the work and the delete re-runs the job. Use natural keys or a "done" flag.
- Failures retry with exponential backoff (30s, 1m, 2m...). After `maxAttempts` (default 5) the row stays with `failed_at` and `last_error`, and logs `job failed permanently`.
- The worker runs inside the API by default. For multiple instances or slow jobs, set `RUN_WORKER=false` and run `npm run worker` as its own process (dev: `devctl start worker --cwd api -- npm run worker`). Several workers are safe.
- **Cron:** re-enqueue from the handler (`await enqueue("report.daily", {}, { delayMs: msUntilNextRun() })`) and seed it once at startup if no pending row of that type exists. Hourly maintenance like `deleteExpiredAuthRows` can stay a `setInterval`, because it's idempotent and cheap.
- Outgrow it (thousands of jobs per second, priorities, rate-limited queues): BullMQ on Redis.

## Email (built in)
`src/lib/email.ts` sends through Resend's HTTP API when `RESEND_API_KEY` is set. Otherwise it logs the email (development) or captures it in `outbox` (tests). Routes always queue it: `await enqueue("email.send", { to, subject, text, html? })`.
- Another provider (Postmark, SES, SMTP via `nodemailer`): change only `sendEmail()`.
- Links point at the frontend: `${env.appUrl}/path?token=...`.
- Production: verify the sending domain (SPF, DKIM, DMARC) with the provider, or mail lands in spam.
- Tests: `await runDueJobs()`, then read `outbox` (see `test/account.test.ts`).

## Webhooks (Stripe, GitHub, ...)
```ts
app.post("/api/webhooks/stripe", async (c) => {
  const raw = await c.req.text();                                  // raw body: signatures cover exact bytes
  const event = stripe.webhooks.constructEvent(raw, c.req.header("stripe-signature")!, env.STRIPE_WEBHOOK_SECRET);
  // dedupe: insert event.id into processed_events (unique); on conflict return 200 and skip
  // enqueue the real work as a job; respond 200 fast
  return c.body(null, 200);
});
```
Generic HMAC: `createHmac("sha256", secret).update(raw).digest("hex")` compared with `timingSafeEqual`. Webhook routes are exempt from `requireUser` and CSRF origin checks (no browser `Origin`). Mount them before `csrf()`, or use a `secFetchSite`/`origin` function that allows `/api/webhooks/`. Locally: `stripe listen --forward-to localhost:8787/api/webhooks/stripe`.

## Server-sent events (live updates)
```ts
import { streamSSE } from "hono/streaming";
app.get("/api/events", requireUser, (c) => streamSSE(c, async (s) => {
  const off = bus.on(getUser(c).id, (e) => s.writeSSE({ event: e.type, data: JSON.stringify(e) }));
  s.onAbort(off);
  while (!s.aborted) await s.sleep(15_000).then(() => s.writeSSE({ event: "ping", data: "" }));
}));
```
Frontend: `new EventSource("/api/events")` (cookies are sent on the same origin). With more than one instance, publish through Redis pub/sub. Use WebSockets (`@hono/node-ws`) only for real two-way traffic.

## Caching
Measure first (request logs show ms). Then: HTTP caching for public GETs (`Cache-Control`, `ETag` via `hono/etag`), an in-process `Map` with TTL for small hot lookups on one instance, and Redis cache-aside for shared caching (see `nosql`). Invalidate on write, and always set a TTL.

## Calling third-party APIs
`fetch` with `AbortSignal.timeout(10_000)`. Retry only idempotent calls, with backoff. Validate the response with zod before trusting its shape. Keep API keys in `env.ts`. Wrap each provider in `src/lib/<provider>.ts` so tests can stub one module.

## Deploy
The scaffold includes a production `Dockerfile` and CI workflow. See the `deploy` skill for hosting, the release step, backups, and the launch checklist.
