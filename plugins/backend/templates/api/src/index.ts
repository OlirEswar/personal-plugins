// Entry point: check the database, start the HTTP server and the job worker, and shut down cleanly.
// `npm run dev` restarts this when an imported file changes.
import { serve } from "@hono/node-server";
import { app } from "./app.ts";
import { env } from "./env.ts";
import { closeDb, pingDb } from "./db/client.ts";
import { closeMongo, ensureIndexes } from "./db/mongo-client.ts"; // scaffold:mongo
import { deleteExpiredAuthRows } from "./auth/cleanup.ts";
import { startWorker } from "./jobs/queue.ts";
import { log } from "./lib/log.ts";

// A bug that escapes every handler: log it and exit so the process manager restarts a clean process.
process.on("uncaughtException", (err) => {
  log.error("uncaught exception, exiting", { err });
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  log.error("unhandled promise rejection, exiting", { err });
  process.exit(1);
});

await pingDb().catch((err) => {
  log.error("cannot reach the database at DATABASE_URL", {
    err,
    hint: "Postgres/Mongo run in Docker: `docker compose up -d --wait`. SQLite needs a writable data/ folder.",
  });
  process.exit(1);
});
await ensureIndexes(); // scaffold:mongo

// Hourly: remove expired sessions, one-time tokens, and rate-limit windows.
const cleanup = () => deleteExpiredAuthRows().catch((err) => log.error("auth cleanup failed", { err }));
await cleanup();
const cleanupTimer = setInterval(cleanup, 60 * 60 * 1000);
cleanupTimer.unref();

const stopWorker = env.RUN_WORKER ? startWorker() : async () => {};

const server = serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (info) => {
  log.info("API ready", {
    url: `http://localhost:${info.port}/api`,
    docs: env.apiDocs ? `http://localhost:${info.port}/api/docs` : "off",
    env: env.NODE_ENV,
  });
});

// On SIGTERM (deploys, docker stop): stop accepting connections, let in-flight requests and the
// current job finish (up to 10s), then close database connections.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("shutting down", { signal });
  const force = setTimeout(() => {
    log.warn("shutdown timed out after 10s, exiting");
    process.exit(1);
  }, 10_000);
  force.unref();
  clearInterval(cleanupTimer);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await stopWorker();
  await closeDb();
  await closeMongo(); // scaffold:mongo
  log.info("shutdown complete");
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
