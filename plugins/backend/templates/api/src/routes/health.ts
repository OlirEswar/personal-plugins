// GET /api/health/live  liveness: the process is up (restart the container if this fails)
// GET /api/health       readiness: the process can reach its databases (stop sending traffic if this fails)
// Point the orchestrator's restart check at /live, and the load balancer at /api/health.
import { createRoute, z } from "@hono/zod-openapi";
import { pingDb } from "../db/client.ts";
import { pingMongo } from "../db/mongo-client.ts"; // scaffold:mongo
import { createRouter, json } from "../lib/router.ts";

const Health = z.object({ ok: z.boolean(), checks: z.record(z.string(), z.enum(["up", "down"])) }).openapi("Health");

const checks: Record<string, () => Promise<unknown>> = {
  db: pingDb,
  mongo: pingMongo, // scaffold:mongo
};

export const healthRoutes = createRouter();

healthRoutes.openapi(
  createRoute({
    method: "get", path: "/live", tags: ["health"], summary: "Liveness (no dependency checks)",
    responses: { 200: json(z.object({ ok: z.literal(true) }), "Process is running") },
  }),
  (c) => c.json({ ok: true as const }, 200),
);

healthRoutes.openapi(
  createRoute({
    method: "get", path: "/", tags: ["health"], summary: "Liveness and dependency check",
    responses: { 200: json(Health, "Healthy"), 503: json(Health, "A dependency is down") },
  }),
  async (c) => {
    const results: Record<string, "up" | "down"> = {};
    await Promise.all(
      Object.entries(checks).map(async ([name, ping]) => {
        results[name] = await ping().then(() => "up" as const, () => "down" as const);
      }),
    );
    const ok = Object.values(results).every((s) => s === "up");
    return ok ? c.json({ ok, checks: results }, 200) : c.json({ ok, checks: results }, 503);
  },
);
