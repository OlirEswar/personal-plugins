import { describe, expect, it } from "vitest";
import { app } from "../src/app.ts";
import { client, signedInClient } from "./helpers.ts";

describe("auth", () => {
  it("reports liveness and readiness", async () => {
    expect((await client().get("/api/health/live")).body).toEqual({ ok: true });
    const res = await client().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("signs up, reads /me, logs out", async () => {
    const c = await signedInClient();
    expect(c.cookie).toMatch(/^session=/);

    const me = await c.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(c.email);
    expect(me.body.emailVerified).toBe(false);
    expect(me.body).not.toHaveProperty("passwordHash");

    expect((await c.post("/api/auth/logout")).status).toBe(204);
    expect((await client(c.cookie).get("/api/auth/me")).status).toBe(401);
  });

  it("sets a hardened session cookie", async () => {
    const res = await client().post("/api/auth/signup", {
      email: `c-${crypto.randomUUID()}@example.com`,
      password: "correct-horse-battery",
    });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("logs in with the right password only", async () => {
    const { email } = await signedInClient();
    expect((await client().post("/api/auth/login", { email, password: "wrong-password!" })).status).toBe(401);
    const ok = await client().post("/api/auth/login", { email: email.toUpperCase(), password: "correct-horse-battery" });
    expect(ok.status).toBe(200);
  });

  it("rejects duplicate emails and bad input", async () => {
    const { email } = await signedInClient();
    const dup = await client().post("/api/auth/signup", { email, password: "correct-horse-battery" });
    expect(dup.status).toBe(409);

    const bad = await client().post("/api/auth/signup", { email: "not-an-email", password: "short" });
    expect(bad.status).toBe(422);
    expect(bad.headers.get("content-type")).toContain("application/problem+json");
    expect(bad.body.errors.map((e: { path: string }) => e.path).sort()).toEqual(["email", "password"]);
  });

  it("blocks cross-site form posts (CSRF)", async () => {
    const res = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/x-www-form-urlencoded" },
    });
    expect(res.status).toBe(403);
  });

  it("returns problem JSON for unknown routes", async () => {
    const res = await client().get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.requestId).toBeTruthy();
  });
});
