// Email verification, password reset/change, sign-out-everywhere, brute-force limits, client IP parsing,
// and the breached-password check.
import { describe, expect, it } from "vitest";
import { outbox } from "../src/lib/email.ts";
import { runDueJobs } from "../src/jobs/queue.ts";
import { clientIpFrom } from "../src/lib/rate-limit.ts";
import { isBreachedPassword } from "../src/auth/password-policy.ts";
import { client, signedInClient } from "./helpers.ts";

const PASSWORD = "correct-horse-battery"; // signedInClient's password

// Emails are delivered by the job queue, so run due jobs before reading the outbox.
async function tokenFromLastEmail(to: string, path: string) {
  await runDueJobs();
  const mail = outbox.findLast((m) => m.to === to && m.text.includes(path));
  const token = mail?.text.match(/token=([\w-]+)/)?.[1];
  if (!token) throw new Error(`no ${path} email for ${to}`);
  return token;
}

describe("email verification", () => {
  it("emails a link on signup that verifies once", async () => {
    const c = await signedInClient();
    expect((await c.get("/api/auth/me")).body.emailVerified).toBe(false);

    const token = await tokenFromLastEmail(c.email, "/verify-email");
    expect((await client().post("/api/auth/verify-email", { token })).status).toBe(204);
    expect((await c.get("/api/auth/me")).body.emailVerified).toBe(true);
    expect((await client().post("/api/auth/verify-email", { token })).status).toBe(400); // single use
  });

  it("invalidates the old link when a new one is sent", async () => {
    const c = await signedInClient();
    const first = await tokenFromLastEmail(c.email, "/verify-email");
    expect((await c.post("/api/auth/verify-email/resend")).status).toBe(204);
    const second = await tokenFromLastEmail(c.email, "/verify-email");
    expect(second).not.toBe(first);
    expect((await client().post("/api/auth/verify-email", { token: first })).status).toBe(400);
    expect((await client().post("/api/auth/verify-email", { token: second })).status).toBe(204);
  });
});

describe("password reset", () => {
  it("answers the same for unknown emails and sends nothing", async () => {
    await runDueJobs();
    const before = outbox.length;
    const res = await client().post("/api/auth/password-reset", { email: `nobody-${crypto.randomUUID()}@example.com` });
    expect(res.status).toBe(204);
    await runDueJobs();
    expect(outbox.length).toBe(before);
  });

  it("resets the password, ends every session, and signs in", async () => {
    const victim = await signedInClient();
    const otherDevice = client(victim.cookie);
    expect((await client().post("/api/auth/password-reset", { email: victim.email })).status).toBe(204);
    const token = await tokenFromLastEmail(victim.email, "/reset-password");

    const short = await client().post("/api/auth/password-reset/confirm", { token, password: "short" });
    expect(short.status).toBe(422);

    const browser = client();
    const ok = await browser.post("/api/auth/password-reset/confirm", { token, password: "a-brand-new-passphrase" });
    expect(ok.status).toBe(200);
    expect((await browser.get("/api/auth/me")).status).toBe(200);
    expect((await otherDevice.get("/api/auth/me")).status).toBe(401);

    expect((await client().post("/api/auth/login", { email: victim.email, password: PASSWORD })).status).toBe(401);
    expect((await client().post("/api/auth/login", { email: victim.email, password: "a-brand-new-passphrase" })).status).toBe(200);
    expect((await client().post("/api/auth/password-reset/confirm", { token, password: "another-passphrase" })).status).toBe(400);
  });

  it("limits reset emails per account", async () => {
    const { email } = await signedInClient();
    for (let i = 0; i < 3; i++) expect((await client().post("/api/auth/password-reset", { email })).status).toBe(204);
    expect((await client().post("/api/auth/password-reset", { email })).status).toBe(429);
  });
});

describe("sessions and passwords", () => {
  it("change-password needs the current password and signs out other devices", async () => {
    const c = await signedInClient();
    const otherDevice = client(c.cookie);
    const wrong = await c.post("/api/auth/change-password", { currentPassword: "nope", newPassword: "next-passphrase-1" });
    expect(wrong.status).toBe(422);
    expect(wrong.body.errors[0].path).toBe("currentPassword");

    const ok = await c.post("/api/auth/change-password", { currentPassword: PASSWORD, newPassword: "next-passphrase-1" });
    expect(ok.status).toBe(200);
    expect((await c.get("/api/auth/me")).status).toBe(200);
    expect((await otherDevice.get("/api/auth/me")).status).toBe(401);
  });

  it("logout-all ends every session", async () => {
    const c = await signedInClient();
    const otherDevice = client(c.cookie);
    expect((await c.post("/api/auth/logout-all")).status).toBe(204);
    expect((await otherDevice.get("/api/auth/me")).status).toBe(401);
  });

  it("replaces a pre-login session on login", async () => {
    const c = await signedInClient();
    const before = c.cookie;
    expect((await c.post("/api/auth/login", { email: c.email, password: PASSWORD })).status).toBe(200);
    expect(c.cookie).not.toBe(before);
    expect((await client(before).get("/api/auth/me")).status).toBe(401);
  });

  it("locks an account after 10 failed logins, even from different IPs", async () => {
    const { email } = await signedInClient();
    for (let i = 0; i < 10; i++) {
      expect((await client().post("/api/auth/login", { email, password: "wrong-password" })).status).toBe(401);
    }
    const locked = await client().post("/api/auth/login", { email, password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("client IP behind proxies", () => {
  it("trusts only the entries added by our own proxies", () => {
    expect(clientIpFrom("6.6.6.6, 203.0.113.9", "10.0.0.1", 1)).toBe("203.0.113.9"); // 6.6.6.6 is client-forged
    expect(clientIpFrom("203.0.113.9, 198.51.100.2", "10.0.0.1", 2)).toBe("203.0.113.9");
    expect(clientIpFrom("6.6.6.6", "10.0.0.1", 0)).toBe("10.0.0.1"); // no proxy: ignore the header
    expect(clientIpFrom(undefined, "10.0.0.1", 1)).toBe("10.0.0.1");
  });
});

describe("breached password check", () => {
  // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
  const fakeRange = (body: string) => (async () => new Response(body)) as unknown as typeof fetch;

  it("flags a password whose hash suffix is in the range response", async () => {
    expect(await isBreachedPassword("password", fakeRange("1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\nABC:1"))).toBe(true);
  });
  it("ignores padding rows and other hashes", async () => {
    expect(await isBreachedPassword("password", fakeRange("1E4C9B93F3F0682250B6CF8331B7EE68FD8:0\r\nABC:3"))).toBe(false);
  });
  it("fails open when the service is down", async () => {
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await isBreachedPassword("password", down)).toBe(false);
  });
});
