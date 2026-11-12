// Runs once before all tests: wipe the test database(s) and apply migrations.
import { closeDb, resetDatabase, runMigrations } from "../src/db/client.ts";
import { closeMongo, resetMongo } from "../src/db/mongo-client.ts"; // scaffold:mongo

export async function setup() {
  await resetDatabase();
  await runMigrations();
  await closeDb();
  await resetMongo(); // scaffold:mongo
  await closeMongo(); // scaffold:mongo
}
