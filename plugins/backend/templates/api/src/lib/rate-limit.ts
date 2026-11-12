// Fixed-window rate limits stored in the database (table rate_limits), so they survive restarts
// and are shared by every server instance. Look at them with: select * from rate_limits;
//   - rateLimit({...})            middleware keyed by client IP
//   - enforceLimit(c, key, ...)   any key: an email address, a user id, ...
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { getConnInfo } from "@hono/node-server/conninfo";
import { sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { rateLimits } from "../db/schema.ts";
import { env } from "../env.ts";
import type { AppEnv } from "./types.ts";
import { HttpError } from "./errors.ts";

// Each proxy APPENDS the address it received the request from, so only the last `trustedHops`
// entries are trustworthy; anything further left can be forged by the client.
export function clientIpFrom(xForwardedFor: string | undefined, socketIp: string, trustedHops: number): string {
  if (trustedHops > 0 && xForwardedFor) {
    const hops = xForwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
    const ip = hops[hops.length - trustedHops];
    if (ip) return ip;
  }
  return socketIp;
}

export function clientIp(c: Context): string {
  let socketIp = "unknown"; // app.request() in tests has no socket
  try {
    socketIp = getConnInfo(c).remote.address ?? "unknown";
  } catch {}
  return clientIpFrom(c.req.header("x-forwarded-for"), socketIp, env.TRUST_PROXY);
}

// Atomically count one hit for `key` in the current window. One upsert, no read-then-write race.
export async function hit(key: string, windowMs: number) {
  const now = Date.now();
  const expired = sql`${rateLimits.resetAt} <= ${now}`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: now + windowMs })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${expired} then ${now + windowMs} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });
  return row!;
}

export async function enforceLimit(c: Context, key: string, max: number, windowMs: number, what: string) {
  const { count, resetAt } = await hit(key, windowMs);
  if (count > max) {
    const seconds = Math.max(1, Math.ceil((Number(resetAt) - Date.now()) / 1000));
    c.header("Retry-After", String(seconds));
    throw new HttpError(429, `Too many ${what}. Try again in ${Math.ceil(seconds / 60)} minute(s).`);
  }
}

export function rateLimit(opts: { name: string; max: number; windowMs: number }) {
  return createMiddleware<AppEnv>(async (c, next) => {
    await enforceLimit(c, `${opts.name}:ip:${clientIp(c)}`, opts.max, opts.windowMs, `${opts.name} attempts`);
    await next();
  });
}
