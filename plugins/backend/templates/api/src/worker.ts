// npm run worker: process background jobs in a separate process.
// Use this when you run more than one API instance or jobs are slow; set RUN_WORKER=false on the API.
// Running several workers at once is safe: each job is claimed by exactly one.
import { closeDb, pingDb } from "./db/client.ts";
import { startWorker } from "./jobs/queue.ts";
import { log } from "./lib/log.ts";

await pingDb();
const stop = startWorker();

async function shutdown(signal: string) {
  log.info("worker shutting down", { signal });
  await stop();
  await closeDb();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
