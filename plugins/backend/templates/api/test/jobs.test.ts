// The job queue: success deletes the job, failures retry with backoff, and jobs that keep failing
// stay in the table with failed_at and last_error for a human to inspect.
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client.ts";
import { jobs } from "../src/db/schema.ts";
import { handlers, type JobType } from "../src/jobs/handlers.ts";
import { enqueue, runDueJobs } from "../src/jobs/queue.ts";
import { outbox } from "../src/lib/email.ts";

// Test-only handlers, registered on the shared registry.
const registry = handlers as unknown as Record<string, (payload: unknown) => Promise<void>>;
afterEach(() => {
  delete registry["test.flaky"];
  delete registry["test.broken"];
});
const testJob = (type: string) => type as JobType;

describe("job queue", () => {
  it("delivers queued email and deletes the job", async () => {
    const id = await enqueue("email.send", { to: "q@example.com", subject: "hello", text: "hi" });
    await runDueJobs();
    expect(outbox.some((m) => m.to === "q@example.com" && m.subject === "hello")).toBe(true);
    expect(await db.select().from(jobs).where(eq(jobs.id, id))).toEqual([]);
  });

  it("retries a failing job later with the error recorded", async () => {
    let calls = 0;
    registry["test.flaky"] = async () => {
      calls++;
      if (calls === 1) throw new Error("provider timeout");
    };
    const id = await enqueue(testJob("test.flaky"), {} as never);
    await runDueJobs();
    const [after] = await db.select().from(jobs).where(eq(jobs.id, id));
    expect(after!.attempts).toBe(1);
    expect(after!.lastError).toContain("provider timeout");
    expect(after!.runAt.getTime()).toBeGreaterThan(Date.now()); // backed off, not due yet

    await db.update(jobs).set({ runAt: new Date() }).where(eq(jobs.id, id)); // pretend the backoff passed
    await runDueJobs();
    expect(calls).toBe(2);
    expect(await db.select().from(jobs).where(eq(jobs.id, id))).toEqual([]);
  });

  it("keeps a job that exhausts its attempts as failed", async () => {
    registry["test.broken"] = async () => {
      throw new Error("always broken");
    };
    const id = await enqueue(testJob("test.broken"), {} as never, { maxAttempts: 1 });
    await runDueJobs();
    const [failed] = await db.select().from(jobs).where(eq(jobs.id, id));
    expect(failed!.failedAt).not.toBeNull();
    expect(failed!.lastError).toContain("always broken");
    expect(await runDueJobs()).toBe(0); // failed jobs are not picked up again
  });

  it("never runs one job twice when workers race", async () => {
    let calls = 0;
    registry["test.flaky"] = async () => {
      calls++;
    };
    await enqueue(testJob("test.flaky"), {} as never);
    await Promise.all([runDueJobs(), runDueJobs(), runDueJobs()]);
    expect(calls).toBe(1);
  });
});
