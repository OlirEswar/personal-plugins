// Builds the HTTP app: middleware, routes, error handling, and API docs.
// Everything lives under /api so a frontend dev server can proxy /api to this process.
// Add a resource: create src/routes/<name>.ts (copy todos.ts), then mount it below.
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env.ts";
import type { AppEnv } from "./lib/types.ts";
import { HttpError, problem } from "./lib/errors.ts";
import { log } from "./lib/log.ts";
import { loadSession } from "./auth/middleware.ts";
import { SESSION_COOKIE } from "./auth/session.ts";
import { authRoutes } from "./routes/auth.ts";
import { healthRoutes } from "./routes/health.ts";
import { todoRoutes } from "./routes/todos.ts";
import { notesRoutes } from "./routes/notes.ts"; // scaffold:mongo

export const app = new OpenAPIHono<AppEnv>();

// --- middleware (order matters) ---
app.use("*", requestId());
app.use("*", async (c, next) => {
  // One line per request. Clients get the same id in the X-Request-Id header and in error bodies.
  const start = performance.now();
  await next();
  const status = c.res.status;
  (status >= 500 ? log.warn : log.info)(`${c.req.method} ${c.req.path}`, {
    status, ms: Math.round(performance.now() - start), user: c.get("user")?.id, req: c.get("requestId"),
  });
});
app.use("*", secureHeaders());
app.use("/api/*", cors({ origin: env.webOrigins, credentials: true }));
app.use("/api/*", csrf({ origin: env.webOrigins })); // rejects cross-site form posts
app.use("/api/*", bodyLimit({ maxSize: 1024 * 1024, onError: (c) => problem(c, 413, "Body larger than 1 MB") }));
app.use("/api/*", loadSession);

// --- routes ---
app.route("/api/health", healthRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/todos", todoRoutes);
app.route("/api/notes", notesRoutes); // scaffold:mongo

// --- API docs: JSON contract for clients, Swagger UI for humans ---
// Off in production unless API_DOCS=true; `npm run openapi` writes the contract file either way.
export const openApiInfo = { openapi: "3.1.0", info: { title: "API", version: "0.1.0" } } as const;
app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey", in: "cookie", name: SESSION_COOKIE,
});
if (env.apiDocs) {
  app.doc31("/api/openapi.json", openApiInfo);
  app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));
}

// --- errors: every failure becomes a problem+json response ---
app.notFound((c) => problem(c, 404, `No route for ${c.req.method} ${c.req.path}`));
app.onError((err, c) => {
  if (err instanceof HttpError) return problem(c, err.status, err.message, err.errors);
  if (err instanceof HTTPException) {
    // Thrown by Hono middleware. The csrf check throws 403 for an unsafe request whose Origin isn't allowed.
    const detail = err.status === 403 ? "Cross-site request blocked: Origin must be listed in WEB_ORIGIN" : err.message;
    return problem(c, err.status, detail || "Request rejected");
  }
  const hint = /no such table|relation .* does not exist/i.test(String(err))
    ? "database schema is behind: run `npm run db:migrate`"
    : undefined;
  log.error("unhandled error", { method: c.req.method, path: c.req.path, user: c.get("user")?.id, req: c.get("requestId"), hint, err });
  return problem(c, 500, env.isProd ? "Something went wrong" : String(err));
});
