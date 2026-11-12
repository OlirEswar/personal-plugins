// npm run db:migrate: apply every pending migration in drizzle/ to DATABASE_URL.
import { closeDb, runMigrations } from "./client.ts";

await runMigrations();
console.log("Migrations applied.");
await closeDb();
