// Sending email. Routes don't call this directly: they queue a job so delivery is retried and
// survives restarts:   await enqueue("email.send", { to, subject, text })
// - test:        captured in `outbox` so tests can read links
// - no API key:  printed to the log (click links from `devctl logs api`)
// - RESEND_API_KEY set: sent through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email)
import { env } from "../env.ts";
import { log } from "./log.ts";

export type Email = { to: string; subject: string; text: string; html?: string };

export const outbox: Email[] = []; // tests only

export async function sendEmail(msg: Email) {
  if (env.NODE_ENV === "test") {
    outbox.push(msg);
    return;
  }
  if (!env.RESEND_API_KEY) {
    log.info("email (not sent: no RESEND_API_KEY)", { to: msg.to, subject: msg.subject });
    process.stdout.write(`${msg.text}\n\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`email provider returned ${res.status}: ${await res.text()}`);
  log.info("email sent", { subject: msg.subject });
}
