// Postgres connection (runs in Docker: `docker compose up -d postgres`).
// Look inside with `docker compose exec postgres psql -U app app` or `npm run db:studio`.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { env } from "../env.ts";
import * as schema from "./schema.ts";

const sql = postgres(env.DATABASE_URL, { max: 10, onnotice: () => {} });
export const db = drizzle(sql, { schema });
export type Db = typeof db;

export async function pingDb() {
  await sql`select 1`;
}

export async function runMigrations() {
  await migrate(db, { migrationsFolder: "drizzle" });
}

export async function closeDb() {
  await sql.end({ timeout: 5 });
}

// Tests only: wipe the test database so migrations run on a clean slate.
export async function resetDatabase() {
  if (env.NODE_ENV !== "test") throw new Error("resetDatabase() only runs with NODE_ENV=test");
  await sql.unsafe("drop schema if exists public cascade; create schema public; drop schema if exists drizzle cascade;");
}
