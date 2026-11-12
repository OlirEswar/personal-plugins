// Every environment variable the API reads, validated once at startup.
// Add new variables here (and to .env.example) instead of reading process.env elsewhere.
import { z } from "zod";

const Env = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8787),
    // 127.0.0.1 keeps the dev server off your network. Use 0.0.0.0 in containers/production.
    HOST: z.string().default("127.0.0.1"),
    DATABASE_URL: z.string().min(1),
    MONGODB_URL: z.string().optional(),
    // Comma-separated browser origins allowed to call the API with cookies (CORS + CSRF).
    WEB_ORIGIN: z.string().default("http://localhost:5173"),
    // Public URL of the frontend for links in emails. Defaults to the first WEB_ORIGIN.
    APP_URL: z.url().optional(),
    // How many reverse proxies sit in front of the API (load balancer = 1, CDN + LB = 2).
    // Used to read the real client IP from X-Forwarded-For for rate limits. 0 = use the socket address.
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    // Email delivery (verification, password reset) through Resend's HTTP API.
    // Without a key, emails are printed to the console (development only).
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("App <onboarding@resend.dev>"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
    // Serve /api/docs and /api/openapi.json. Default: on except in production.
    API_DOCS: z.stringbool().optional(),
    // Run the background job worker inside the API process. Set false when running `npm run worker` separately.
    RUN_WORKER: z.stringbool().default(true),
    // Reject passwords found in known breaches (haveibeenpwned range API, k-anonymous). Default: on, off in tests.
    PASSWORD_BREACH_CHECK: z.stringbool().optional(),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== "production") return;
    // Refuse to boot an unsafe production config instead of failing quietly later.
    for (const origin of e.WEB_ORIGIN.split(",")) {
      if (!origin.trim().startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["WEB_ORIGIN"], message: `must be https in production (got ${origin.trim()})` });
      }
    }
    if (e.APP_URL && !e.APP_URL.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "must be https in production" });
    }
    if (!e.RESEND_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "required in production (password reset and verification emails)" });
    }
  });

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables (see .env.example):");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

const webOrigins = parsed.data.WEB_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);

export const env = {
  ...parsed.data,
  webOrigins,
  appUrl: (parsed.data.APP_URL ?? webOrigins[0] ?? "http://localhost:5173").replace(/\/$/, ""),
  isProd: parsed.data.NODE_ENV === "production",
  breachCheck: parsed.data.PASSWORD_BREACH_CHECK ?? parsed.data.NODE_ENV !== "test",
  apiDocs: parsed.data.API_DOCS ?? parsed.data.NODE_ENV !== "production",
};
