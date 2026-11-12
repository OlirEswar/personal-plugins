// Random secrets for sessions and one-time email links.
// Only sha256(token) is stored, so a database leak can't be turned into working links or cookies.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/client.ts";
import { authTokens } from "../db/schema.ts";

export const newToken = () => randomBytes(32).toString("base64url"); // 256 bits
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type TokenPurpose = "verify_email" | "reset_password";
const TTL_MS: Record<TokenPurpose, number> = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 30 * 60 * 1000,
};

// Issue a one-time token; any older token for the same user and purpose stops working.
export async function issueAuthToken(userId: string, purpose: TokenPurpose) {
  const token = newToken();
  await db.delete(authTokens).where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose)));
  await db.insert(authTokens).values({
    id: hashToken(token),
    userId,
    purpose,
    expiresAt: new Date(Date.now() + TTL_MS[purpose]),
  });
  return token;
}

// Use a token exactly once. Delete-and-return is atomic, so two concurrent uses can't both succeed.
export async function consumeAuthToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  const [row] = await db
    .delete(authTokens)
    .where(and(eq(authTokens.id, hashToken(token)), eq(authTokens.purpose, purpose), gt(authTokens.expiresAt, new Date())))
    .returning({ userId: authTokens.userId });
  return row?.userId ?? null;
}
