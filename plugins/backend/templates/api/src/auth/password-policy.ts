// What counts as an acceptable new password (NIST SP 800-63B / OWASP ASVS):
// length 8-128, any characters, no composition rules, and not a known-breached password.
// Raise MIN_LENGTH (15 is recommended when passwords are the only factor) if the product allows it.
import { createHash } from "node:crypto";
import { z } from "@hono/zod-openapi";
import { env } from "../env.ts";
import { HttpError } from "../lib/errors.ts";
import { log } from "../lib/log.ts";

export const MIN_LENGTH = 8;
export const NewPassword = z.string().min(MIN_LENGTH).max(128); // max bounds hashing cost

// haveibeenpwned "range" API: only the first 5 hex chars of the SHA-1 leave this server (k-anonymity).
// Fails open (allows the password) if the service is unreachable, and logs a warning.
export async function isBreachedPassword(password: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetchFn(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [hash, count] = line.trim().split(":");
      return hash === suffix && Number(count) > 0; // padding rows have count 0
    });
  } catch (err) {
    log.warn("breached-password check unavailable; allowing password", { err });
    return false;
  }
}

export async function assertPasswordAllowed(password: string, field = "password") {
  if (env.breachCheck && (await isBreachedPassword(password))) {
    throw new HttpError(422, "Choose a different password", [
      { path: field, message: "This password has appeared in a data breach. Choose a different one." },
    ]);
  }
}
