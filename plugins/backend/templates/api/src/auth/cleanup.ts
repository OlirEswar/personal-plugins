// Delete expired sessions, one-time tokens, and rate-limit windows so the tables don't grow forever.
// index.ts runs this at startup and hourly. Safe to run from several instances at once.
import { lt } from "drizzle-orm";
import { db } from "../db/client.ts";
import { authTokens, rateLimits, sessions } from "../db/schema.ts";

export async function deleteExpiredAuthRows() {
  const now = new Date();
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db.delete(authTokens).where(lt(authTokens.expiresAt, now));
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, now.getTime()));
}
