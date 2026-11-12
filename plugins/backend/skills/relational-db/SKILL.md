---
name: relational-db
description: Work with SQL databases through Drizzle ORM - schema design, migrations, queries and joins, transactions, indexes, seeding, inspecting data with sqlite3/psql, and moving from SQLite to Postgres. Use when creating or changing tables, writing queries, fixing migration errors, or choosing/setting up SQLite or Postgres.
argument-hint: "[table or task]"
---

# Relational databases (Drizzle + SQLite/Postgres)

Drizzle is a thin, typed layer over SQL. What you write maps line for line to the SQL that runs, migrations are plain `.sql` files, and a human can read all of it. Look up unfamiliar APIs with context7 (`drizzle-orm`).

## Schema changes: the only workflow
1. Edit `src/db/schema.ts`.
2. `npm run db:generate`. This writes `drizzle/NNNN_<name>.sql`. **Read it.** Check for renames that came out as drop + add (data loss), `NOT NULL` columns added without defaults to tables that have rows, and missing indexes.
3. `npm run db:migrate` (dev database), then `npm test` (the test database is rebuilt from migrations).
4. Commit the schema change and the migration together. Never edit a migration that has already run anywhere else. Write a new one.

Avoid `drizzle-kit push` except on a throwaway prototype database. It skips the migration files, so no record of the change exists.

When `generate` asks "is this column renamed or created?", answer truthfully. A wrong answer drops data.

## Modeling rules
- Every table: `id` primary key (UUID string), `createdAt`. Add `updatedAt` when rows are edited.
- Foreign keys always: `.references(() => users.id, { onDelete: "cascade" | "set null" | "restrict" })`. Pick deliberately.
- Index every foreign key you filter by, plus your list query's sort, as one composite: `index().on(t.userId, t.createdAt)`.
- Uniqueness belongs in the database (`.unique()` or `uniqueIndex()`), not just in app code. Catch the violation and return 409.
- Money in integer cents. Enums as text with a zod enum (Postgres `pgEnum` is harder to change). Timestamps in UTC.
- Many-to-many: a join table with a composite primary key `primaryKey({ columns: [t.a, t.b] })`.
- Soft delete (`deletedAt`) only when there's a real undo or audit need, because every query then has to filter it.

## Queries
```ts
import { and, eq, desc, inArray, sql, count } from "drizzle-orm";
await db.select().from(todos).where(and(eq(todos.userId, uid), eq(todos.done, false))).orderBy(desc(todos.createdAt)).limit(20);
await db.insert(todos).values({ userId: uid, title }).returning();
await db.update(todos).set({ done: true }).where(and(eq(todos.id, id), eq(todos.userId, uid))).returning();
await db.select({ n: count() }).from(todos).where(eq(todos.userId, uid));
// join
await db.select({ todo: todos, email: users.email }).from(todos).innerJoin(users, eq(users.id, todos.userId));
// relational query API, when relations() are defined:  db.query.users.findMany({ with: { todos: true } })
```
- `sql\`...\`` template values are parameterized automatically. **Never** build SQL with string concatenation or `sql.raw()` on user input.
- Avoid N+1 loops: fetch related rows with one `inArray(...)` query or a join.
- Paginate with cursors (see `src/routes/todos.ts`), not `OFFSET`, on anything that grows.

## Transactions
```ts
await db.transaction(async (tx) => {
  const [order] = await tx.insert(orders).values(...).returning();
  await tx.insert(orderItems).values(items.map((i) => ({ ...i, orderId: order!.id })));
});  // throw inside to roll back
```
Use them whenever two writes must succeed or fail together. Keep them short and never `await` network calls (email, HTTP) inside one.

## Look at the data (humans too)
- SQLite: `sqlite3 api/data/app.db` then `.tables`, `.schema todos`, `select * from todos limit 5;`.
- Postgres: `docker compose exec postgres psql -U app app` then `\dt`, `\d todos`, `explain analyze select ...;`.
- Either: `npm run db:studio` (web UI).
- Slow query? `EXPLAIN QUERY PLAN` (SQLite) or `EXPLAIN ANALYZE` (Postgres). A sequential scan on a big table usually means a missing index.

## SQLite to Postgres (when outgrowing SQLite)
1. `docker compose` with a `postgres:18-alpine` service (copy from `api-scaffold --db postgres` output into a temp dir) and `DATABASE_URL=postgres://...`.
2. `npm rm @libsql/client && npm i postgres`. Replace `src/db/client.ts` and `drizzle.config.ts` with the Postgres versions from that scaffold.
3. In `schema.ts`: `sqliteTable` to `pgTable`, `integer(..., {mode:"timestamp_ms"})` to `timestamp(..., {withTimezone:true})`, `integer(..., {mode:"boolean"})` to `boolean`, text ids to `uuid().defaultRandom()`. Query code doesn't change.
4. Move `drizzle/` aside, `db:generate` a fresh baseline, migrate, and copy data if any is worth keeping (export CSV with `sqlite3 -csv`, import with `\copy`).

## Production
- **SQLite** is a good production database for one server: the client already enables WAL, `busy_timeout=5000`, and `synchronous=NORMAL`, and foreign keys are on. Keep the file on a persistent volume, run exactly one instance, and back up with Litestream (see `deploy`).
- **Migrations run once per release** (`node src/db/migrate.ts` as a release step), never from every instance at startup.
- **Zero-downtime changes:** expand, then switch, then contract. Add nullable columns first, backfill, and only later make them `NOT NULL` or drop old ones. Never rename in place. Details are in the `deploy` skill.
- **Postgres pool:** `max` in `client.ts` times the number of instances must stay under the server's `max_connections` (managed providers publish it). Use the provider's pooler URL (PgBouncer) for serverless or many instances.
- **Least privilege:** the app's database user owns its schema but isn't a superuser. Use a separate read-only user for analytics.
- **Backups and a tested restore** before launch (see `deploy`).
