---
name: nosql
description: Set up and use NoSQL stores alongside the API - MongoDB (document modeling, zod validation, indexes, operator-injection safety) and Redis (caching, rate limits, sessions, queues, pub/sub), run locally in Docker. Use when the user asks for MongoDB, Redis, a document store, caching, or a queue, or when data is document-shaped.
argument-hint: "[mongodb|redis] [task]"
---

# NoSQL: MongoDB and Redis

First ask whether it's needed. Postgres JSONB or SQLite JSON columns cover "some flexible fields" without a second database. Reach for Mongo when most of the data is nested documents with varying shape. Reach for Redis when you need shared, fast, expiring state across processes. Users, sessions, and money stay relational.

## MongoDB
**Setup.** In a new project: `api-scaffold api --mongo`. To add it to an existing API:
1. Add a `mongo` service to `docker-compose.yml` with `image: mongo:7.0`, `ports: ["127.0.0.1:27017:27017"]`, and a named volume at `/data/db`. Don't use `mongo:8` until it's verified on this machine: it refuses to start on some Docker VM kernels (SERVER-121912).
2. `npm i mongodb`, then set `MONGODB_URL=mongodb://127.0.0.1:27017/app` in `.env` and `.env.example`, and `.../app_test` in `.env.test`.
3. Copy the scaffold's `src/db/mongo-client.ts` pattern: one `MongoClient` per process, `collection<T>(name)`, `pingMongo()` in the health check, `ensureIndexes()` at startup, and `closeMongo()` on shutdown.

**Modeling.**
- Shape documents around how they're read. Embed data that's read together and bounded (line items in an order). Reference with ids when the data is shared, unbounded, or updated independently (comments on a post: a separate collection with `postId`).
- Keep documents well under 16 MB, and never let an array grow without bound.
- Store `userId` (owner), `createdAt`, and `updatedAt` on every document, with `Date` values rather than strings.
- Expose `_id.toHexString()` as `id` through a `toDto()`. Never return raw documents.

**Validation and safety.**
- Validate input with zod in the route (as in `routes/notes.ts`). Build filters from **typed values**, never from request JSON: `find(req.body)` lets `{"$ne": null}` match everything (operator injection).
- Bad `ObjectId` strings: check `ObjectId.isValid(id)`, and return 404 when they fail.
- Scope every query by `userId`: `findOne({ _id, userId: user.id })`.
- Optional database-side safety net: `db.createCollection("notes", { validator: { $jsonSchema: {...} } })`.

**Indexes.** Create them in `ensureIndexes()` (idempotent): one compound index per hot query, equality fields first, then sort (`{ userId: 1, createdAt: -1 }`). Use a unique index for natural keys, and a TTL index for expiring docs (`{ expiresAt: 1 }, { expireAfterSeconds: 0 }`). Verify with `.explain("executionStats")`.

**Updates.** Use operators (`$set`, `$inc`, `$push` with `$slice`), `findOneAndUpdate(..., { returnDocument: "after" })`, and `updatedAt` on every write. Multi-document atomicity needs a replica set, so prefer designs where one document changes atomically.

**Inspect.** `docker compose exec mongo mongosh app`, then `show collections`, `db.notes.find({}).sort({createdAt:-1}).limit(5)`, `db.notes.getIndexes()`.

**Tests.** `.env.test` points at `app_test`. Global setup calls `resetMongo()`, which refuses to run unless `NODE_ENV=test`.

## Redis
**Setup.** Add a compose service `redis: { image: redis:7-alpine, ports: ["127.0.0.1:6379:6379"] }`, then `npm i redis` and `REDIS_URL=redis://127.0.0.1:6379`. Create one client per process (`createClient({ url }).connect()`), add it to the health check, and close it on shutdown. Inspect with `docker compose exec redis redis-cli` (`KEYS app:*` in dev only, `TTL key`, `MONITOR`).

| Use | Pattern |
|---|---|
| Cache | Cache-aside: `GET app:cache:<key>`. On a miss, compute, then `SET ... EX 300`. Delete the key on writes. Cache only what you've measured as slow |
| Rate limit | Replace `src/lib/rate-limit.ts` storage: `INCR app:rl:<route>:<ip>` plus `EXPIRE` on the first hit, so limits hold across instances |
| Sessions | Keep sessions in SQL (they're already indexed and simple). Move them to Redis only at real scale |
| Jobs/queues | BullMQ (`npm i bullmq`) for retries, delays, and cron. Run the worker as its own process: `devctl start worker -- node --watch src/worker.ts` |
| Pub/sub | Fan-out of live events to SSE connections across instances |

Always namespace keys (`app:<purpose>:<id>`) and set a TTL on anything that isn't permanent. Redis is a cache unless persistence is configured, so never keep the only copy of data there.
