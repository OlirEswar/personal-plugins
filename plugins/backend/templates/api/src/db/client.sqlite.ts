// SQLite connection. The database is a single file (DATABASE_URL=file:./data/app.db);
// open it with `sqlite3 data/app.db` or `npm run db:studio` to look inside.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { env } from "../env.ts";
import * as schema from "./schema.ts";

if (env.DATABASE_URL.startsWith("file:")) {
  mkdirSync(dirname(env.DATABASE_URL.slice("file:".length)), { recursive: true });
}

const client = createClient({ url: env.DATABASE_URL });
// Production settings: WAL lets reads run during writes; busy_timeout waits for a lock instead of
// failing with SQLITE_BUSY; synchronous=NORMAL is the safe, fast choice with WAL. Foreign keys are on by default in libsql.
if (env.DATABASE_URL.startsWith("file:")) {
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA busy_timeout = 5000");
  await client.execute("PRAGMA synchronous = NORMAL");
}
export const db = drizzle(client, { schema });
export type Db = typeof db;

export async function pingDb() {
  await client.execute("select 1");
}

export async function runMigrations() {
  await migrate(db, { migrationsFolder: "drizzle" });
}

export async function closeDb() {
  client.close();
}

// Tests only: drop every table so migrations run on a clean database.
export async function resetDatabase() {
  if (env.NODE_ENV !== "test") throw new Error("resetDatabase() only runs with NODE_ENV=test");
  await client.execute("PRAGMA foreign_keys = OFF");
  const { rows } = await client.execute(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'",
  );
  for (const row of rows) await client.execute(`drop table if exists "${String(row.name)}"`);
  await client.execute("PRAGMA foreign_keys = ON");
}
