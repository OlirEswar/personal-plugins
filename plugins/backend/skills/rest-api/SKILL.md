---
name: rest-api
description: Design and implement REST endpoints the frontend can consume - resource naming, status codes, problem+json errors, validation with zod, cursor pagination, filtering, idempotency, the OpenAPI contract, and a typed frontend client. Use when adding or changing API endpoints, designing an API, or connecting a frontend to the API.
argument-hint: "[resource or endpoint]"
---

# REST APIs

Check the project's backend first (`BACKEND.md`, `api/src/app.ts`). The conventions below match the scaffold. In an existing codebase, its own conventions win.

## House rules: code a human can read and debug
The goal is that someone who has never seen the project can follow any request from route to database and back in a few minutes.
- **One file per resource** in `src/routes/`, in the same order every time: schemas, DTO mapper, router, then handlers in CRUD order. Copy `todos.ts` rather than inventing a new layout.
- **No hidden layers.** Handlers call Drizzle directly. Add a `src/services/<thing>.ts` module only when two routes or a job share real logic, never "just in case". No repository classes, DI containers, decorators, or base classes.
- **Explicit over clever:** named functions, early returns, plain `if`s. No metaprogramming, generic CRUD factories, or chains of higher-order middleware.
- **Comments say why**, not what: business rules, security decisions, and non-obvious trade-offs. Every file starts with one or two lines on what it's for, with the routes it serves.
- **One way to do each thing:** errors via `HttpError`, config via `env.ts`, logs via `log`, background work via `enqueue`, time via `new Date()` in UTC. No `console.log` in app code and no `process.env` outside `env.ts`.
- **Log at boundaries, with ids:** `log.info("invoice.sent", { invoice: id, user: user.id })`. Never log secrets, tokens, passwords, or whole bodies.
- **Names match the domain** used in the UI and database (`invoice`, not `item` or `data`). Database columns are snake_case, TypeScript is camelCase, and Drizzle maps between them.
- **Small diffs and tests next to the change.** Every new endpoint gets its tests in the same commit.

## Add a resource (the scaffold's way)
1. **Schema**: add the table to `src/db/schema.ts` with a `userId` owner column if users own rows. Then `npm run db:generate`, read the SQL it wrote, and `npm run db:migrate`.
2. **Routes**: copy `src/routes/todos.ts` to `src/routes/<things>.ts`. Keep:
   - `router.use("*", requireUser)` for anything that isn't public;
   - every query filtered by `eq(table.userId, user.id)` (other users' ids return **404**);
   - zod schemas with `.openapi("Name")` and explicit limits (`.max()` on strings, arrays, and page size);
   - a `toDto()` mapper, so internal columns never leak and dates become ISO strings.
3. **Mount**: add `app.route("/api/<things>", thingRoutes)` in `src/app.ts`.
4. **Test**: copy `test/todos.test.ts` and cover the happy path, 401, another user's row (404), and invalid input (422).
5. `npm test && npm run typecheck && npm run openapi`, then regenerate the frontend types.

Context7 has current docs for Hono, `@hono/zod-openapi`, Drizzle, and zod 4. Check it before using an API you're unsure about.

## Conventions
| Thing | Rule |
|---|---|
| Paths | Plural nouns, kebab-case: `/api/projects/{id}/members`. Nest at most one level. Actions that aren't CRUD go in a sub-resource: `POST /api/invoices/{id}/send` |
| Methods | `GET` read (never changes state), `POST` create or action, `PATCH` partial update, `PUT` full replace (rare), `DELETE` remove |
| Status | 200 OK, 201 Created (return the object), 204 No Content (delete/logout), 400 malformed, 401 not signed in, 403 signed in but not allowed (roles), 404 missing **or not yours**, 409 conflict/duplicate, 422 validation, 429 rate limited |
| Errors | Always problem+json: `{ type, title, status, detail, requestId, errors?: [{ path, message }] }`. Throw `HttpError` (or `notFound()`, `conflict()`...) from `src/lib/errors.ts` |
| JSON | camelCase fields, ISO-8601 UTC dates, string ids, `null` rather than missing for known-empty fields, no envelopes for single objects |
| Lists | `{ items: [...], nextCursor: string \| null }`, with `?limit=` (default 20, max 100) and `?cursor=`. Use cursors rather than offsets: they stay stable under inserts and fast on big tables |
| Filters | Explicit, typed query params (`?status=open&tag=x&q=search`), each validated by zod. Never pass a raw query object into the database |
| Sorting | `?sort=createdAt` / `?sort=-createdAt` against an allowlist. Always add a unique tiebreaker (`id`) |
| Versioning | Don't, until there are outside clients. Add optional fields freely. Removing or renaming a field is a breaking change, so coordinate it with the frontend in the same change |

## Validation
- Validate **every** input (`params`, `query`, `json`, headers you read) through the route's `request` schema, and read it with `c.req.valid("json")`. Never use `await c.req.json()`.
- Normalize in the schema: `.trim()`, `.toLowerCase()` on emails, `z.coerce.number()` for query numbers.
- The router's `defaultHook` already turns failures into 422 with `errors[]`, so don't hand-roll validation responses.
- Business-rule failures, like "due date before start date", throw `HttpError(422, ..., [{ path: "dueDate", message }])` so the frontend can show them on the field.

## Idempotency and concurrency
- Make `PUT` and `DELETE` naturally idempotent. For `POST`s that charge money or send email, accept an `Idempotency-Key` header and store key to response for 24 hours.
- Lost updates: if two people can edit the same row, add an `updatedAt` (or `version`) column, have clients send it back, and update `WHERE id = ? AND version = ?`. Zero rows updated means 409.

## Typed frontend client
```bash
cd api && npm run openapi                                           # writes api/openapi.json
cd ../web && npx openapi-typescript ../api/openapi.json -o src/lib/api-types.ts && npm i openapi-fetch
```
```ts
// web/src/lib/api.ts
import createClient from "openapi-fetch";
import type { paths } from "./api-types";
export const api = createClient<paths>({ baseUrl: "/" });   // same origin via the dev proxy
// const { data, error } = await api.GET("/api/todos", { params: { query: { limit: 20 } } });
// error is the problem+json body: show error.detail, map error.errors to fields
```
Add `"api:types": "openapi-typescript ../api/openapi.json -o src/lib/api-types.ts"` to the frontend scripts, and run it whenever the contract changes.

## Non-JSON endpoints
- File download: `return c.body(stream, 200, { "Content-Type": ..., "Content-Disposition": 'attachment; filename="x.csv"' })`.
- Server-sent events for live updates: `streamSSE` from `hono/streaming`. It's simpler than WebSockets for server-to-client feeds.
- Uploads: see the `backend-recipes` skill.
