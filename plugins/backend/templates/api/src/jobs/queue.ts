// A small, durable job queue stored in the `jobs` table: no Redis, and every job is visible with SQL.
//   await enqueue("email.send", { to, subject, text })   // from any route
//   startWorker()                                       // index.ts (or src/worker.ts as its own process)
// Life of a job: queued -> claimed (locked_at set, attempts+1) -> deleted on success,
//   or retried with exponential backoff, or kept with failed_at set after max_attempts.
// Inspect:   select type, attempts, run_at, last_error from jobs order by run_at;
// Retry one: update jobs set failed_at = null, attempts = 0, run_at = <now> where id = '...';
import { and, asc, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { jobs } from "../db/schema.ts";
import { log } from "../lib/log.ts";
import { handlers, type JobPayload, type JobType } from "./handlers.ts";

const LOCK_TIMEOUT_MS = 5 * 60_000; // a job locked longer than this was abandoned by a crashed worker
const MAX_BACKOFF_MS = 60 * 60_000;

export async function enqueue<T extends JobType>(
  type: T,
  payload: JobPayload<T>,
  opts: { delayMs?: number; maxAttempts?: number } = {},
) {
  const [job] = await db
    .insert(jobs)
    .values({ type, payload, runAt: new Date(Date.now() + (opts.delayMs ?? 0)), maxAttempts: opts.maxAttempts ?? 5 })
    .returning({ id: jobs.id });
  log.debug("job queued", { job: job!.id, type });
  return job!.id;
}

type Job = typeof jobs.$inferSelect;

// Claim the next due job. The conditional UPDATE means two workers can never claim the same job.
async function claimNext(): Promise<Job | null> {
  for (let tries = 0; tries < 3; tries++) {
    const now = new Date();
    const unlocked = or(isNull(jobs.lockedAt), lt(jobs.lockedAt, new Date(now.getTime() - LOCK_TIMEOUT_MS)));
    const [candidate] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(isNull(jobs.failedAt), lte(jobs.runAt, now), unlocked))
      .orderBy(asc(jobs.runAt))
      .limit(1);
    if (!candidate) return null;
    const [claimed] = await db
      .update(jobs)
      .set({ lockedAt: now, attempts: sql`${jobs.attempts} + 1` })
      .where(and(eq(jobs.id, candidate.id), unlocked))
      .returning();
    if (claimed) return claimed;
  }
  return null;
}

async function runJob(job: Job) {
  const fields = { job: job.id, type: job.type, attempt: job.attempts };
  try {
    const handler = handlers[job.type as JobType] as ((payload: unknown) => Promise<void>) | undefined;
    if (!handler) throw new Error(`no handler registered for job type "${job.type}"`);
    await handler(job.payload);
    await db.delete(jobs).where(eq(jobs.id, job.id));
    log.info("job done", fields);
  } catch (err) {
    const final = job.attempts >= job.maxAttempts;
    const retryInMs = Math.min(2 ** job.attempts * 15_000, MAX_BACKOFF_MS); // 30s, 1m, 2m, 4m, ...
    const lastError = (err instanceof Error ? (err.stack ?? err.message) : String(err)).slice(0, 2000);
    await db
      .update(jobs)
      .set(final ? { lockedAt: null, lastError, failedAt: new Date() } : { lockedAt: null, lastError, runAt: new Date(Date.now() + retryInMs) })
      .where(eq(jobs.id, job.id));
    if (final) log.error("job failed permanently (kept in jobs table)", { ...fields, err });
    else log.warn("job failed, will retry", { ...fields, retryInSec: retryInMs / 1000, err });
  }
}

// Run every job that's due now, one at a time. Returns how many ran. Tests call this directly.
export async function runDueJobs(limit = 100): Promise<number> {
  let ran = 0;
  for (; ran < limit; ran++) {
    const job = await claimNext();
    if (!job) break;
    await runJob(job);
  }
  return ran;
}

// Poll for due jobs until stopped. The returned stop() waits for the current job to finish.
export function startWorker({ pollMs = 1_000 } = {}) {
  let stopped = false;
  let current: Promise<unknown> = Promise.resolve();
  let timer: NodeJS.Timeout;
  const tick = async () => {
    current = runDueJobs().catch((err) => log.error("job worker error", { err }));
    await current;
    if (!stopped) timer = setTimeout(tick, pollMs);
  };
  timer = setTimeout(tick, 0);
  log.info("job worker started");
  return async function stop() {
    stopped = true;
    clearTimeout(timer);
    await current;
  };
}
