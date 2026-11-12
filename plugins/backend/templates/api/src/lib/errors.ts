// One error shape for every failure: RFC 9457 "problem details" JSON.
//   { "type": "about:blank", "title": "Not Found", "status": 404, "detail": "...", "requestId": "..." }
// Throw HttpError anywhere in a handler; app.onError turns it into this response.
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "@hono/zod-openapi";

const TITLES: Record<number, string> = {
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 409: "Conflict",
  413: "Payload Too Large", 422: "Unprocessable Content", 429: "Too Many Requests",
  500: "Internal Server Error", 503: "Service Unavailable",
};

export type FieldError = { path: string; message: string };

export class HttpError extends Error {
  status: ContentfulStatusCode;
  errors?: FieldError[];
  constructor(status: ContentfulStatusCode, detail: string, errors?: FieldError[]) {
    super(detail);
    this.status = status;
    this.errors = errors;
  }
}

export const badRequest = (detail: string) => new HttpError(400, detail);
export const unauthorized = (detail = "Not signed in") => new HttpError(401, detail);
export const forbidden = (detail = "Not allowed") => new HttpError(403, detail);
export const notFound = (detail = "Not found") => new HttpError(404, detail);
export const conflict = (detail: string) => new HttpError(409, detail);

export function problem(c: Context, status: ContentfulStatusCode, detail: string, errors?: FieldError[]) {
  return c.json(
    { type: "about:blank", title: TITLES[status] ?? "Error", status, detail, requestId: c.get("requestId"), errors },
    status,
    { "Content-Type": "application/problem+json" },
  );
}

// For OpenAPI docs: reuse in route `responses` so clients know the error shape.
export const ProblemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    requestId: z.string().optional(),
    errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  })
  .openapi("Problem");

export const problemResponse = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: ProblemSchema } },
});
