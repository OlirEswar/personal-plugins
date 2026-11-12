// MongoDB connection (runs in Docker: `docker compose up -d mongo`).
// Look inside with `docker compose exec mongo mongosh app`.
// The driver connects lazily on the first operation; the database name comes from MONGODB_URL.
import { MongoClient, type Document } from "mongodb";
import { env } from "../env.ts";

const client = new MongoClient(env.MONGODB_URL ?? "mongodb://127.0.0.1:27017/app", {
  serverSelectionTimeoutMS: 5_000,
});
export const mongo = client.db();

export const collection = <T extends Document>(name: string) => mongo.collection<T>(name);

export async function pingMongo() {
  await mongo.command({ ping: 1 });
}

// Indexes are declared in code and created at startup (idempotent).
export async function ensureIndexes() {
  await mongo.collection("notes").createIndex({ userId: 1, createdAt: -1 });
}

export async function closeMongo() {
  await client.close();
}

export async function resetMongo() {
  if (env.NODE_ENV !== "test") throw new Error("resetMongo() only runs with NODE_ENV=test");
  await mongo.dropDatabase();
}
