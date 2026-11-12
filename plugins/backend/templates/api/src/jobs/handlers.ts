// Every kind of background job, by name. To add one:
//   1. add `"thing.do": async (payload: { ... }) => { ... }` below
//   2. queue it from a route: await enqueue("thing.do", { ... })
// Handlers must be safe to run twice (a crash after the work but before the job is deleted retries it).
import { sendEmail, type Email } from "../lib/email.ts";

export const handlers = {
  "email.send": async (payload: Email) => {
    await sendEmail(payload);
  },
} satisfies Record<string, (payload: never) => Promise<void>>;

export type JobType = keyof typeof handlers;
export type JobPayload<T extends JobType> = Parameters<(typeof handlers)[T]>[0];
