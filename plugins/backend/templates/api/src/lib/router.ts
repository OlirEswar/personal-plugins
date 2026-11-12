// Create every router with createRouter() so request validation failures all return
// the same 422 problem response (with per-field errors) instead of Hono's default.
import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "./types.ts";
import { problem } from "./errors.ts";

export const createRouter = () =>
  new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const errors = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
        return problem(c, 422, "Request validation failed", errors);
      }
    },
  });

// Common request/response building blocks.
export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

export const jsonBody = <T extends z.ZodType>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

export const IdParam = z.object({
  id: z.string().min(1).max(64).openapi({ param: { name: "id", in: "path" } }),
});
