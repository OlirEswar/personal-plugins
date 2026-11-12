// Example resource. Copy this file as the starting point for new resources.
// Every query is scoped to the signed-in user: other users' rows return 404, never 403,
// so the API doesn't reveal which ids exist.
//   GET /api/todos?limit=&cursor=   POST /api/todos   GET|PATCH|DELETE /api/todos/{id}
import { createRoute, z } from "@hono/zod-openapi";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { db } from "../db/client.ts";
import { todos } from "../db/schema.ts";
import { createRouter, IdParam, json, jsonBody } from "../lib/router.ts";
import { badRequest, notFound, problemResponse } from "../lib/errors.ts";
import { getUser, requireUser } from "../auth/middleware.ts";

const TodoSchema = z
  .object({ id: z.string(), title: z.string(), done: z.boolean(), createdAt: z.iso.datetime() })
  .openapi("Todo");
const TodoPage = z
  .object({ items: z.array(TodoSchema), nextCursor: z.string().nullable() })
  .openapi("TodoPage");
const CreateTodo = z.object({ title: z.string().trim().min(1).max(200) }).openapi("CreateTodo");
const UpdateTodo = z
  .object({ title: z.string().trim().min(1).max(200), done: z.boolean() })
  .partial()
  .openapi("UpdateTodo");
const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

type TodoRow = typeof todos.$inferSelect;
const toDto = (t: TodoRow) => ({ id: t.id, title: t.title, done: t.done, createdAt: t.createdAt.toISOString() });

// Cursor = "<createdAt ms>.<id>" of the last item, base64url-encoded. Stable under inserts.
const encodeCursor = (t: TodoRow) => Buffer.from(`${t.createdAt.getTime()}.${t.id}`).toString("base64url");
function decodeCursor(cursor: string) {
  const [ms, id] = Buffer.from(cursor, "base64url").toString().split(".");
  if (!ms || !id || Number.isNaN(Number(ms))) throw badRequest("Invalid cursor");
  return { createdAt: new Date(Number(ms)), id };
}

const responses404 = { 401: problemResponse("Not signed in"), 404: problemResponse("No such todo") };

export const todoRoutes = createRouter();
todoRoutes.use("*", requireUser);

todoRoutes.openapi(
  createRoute({
    method: "get", path: "/", tags: ["todos"], summary: "List my todos, newest first",
    security: [{ cookieAuth: [] }],
    request: { query: ListQuery },
    responses: { 200: json(TodoPage, "A page of todos"), 401: problemResponse("Not signed in") },
  }),
  async (c) => {
    const user = getUser(c);
    const { limit, cursor } = c.req.valid("query");
    const after = cursor ? decodeCursor(cursor) : null;
    const rows = await db
      .select()
      .from(todos)
      .where(
        and(
          eq(todos.userId, user.id),
          after
            ? or(lt(todos.createdAt, after.createdAt), and(eq(todos.createdAt, after.createdAt), lt(todos.id, after.id)))
            : undefined,
        ),
      )
      .orderBy(desc(todos.createdAt), desc(todos.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? encodeCursor(page[page.length - 1]!) : null;
    return c.json({ items: page.map(toDto), nextCursor }, 200);
  },
);

todoRoutes.openapi(
  createRoute({
    method: "post", path: "/", tags: ["todos"], summary: "Create a todo",
    security: [{ cookieAuth: [] }],
    request: { body: jsonBody(CreateTodo) },
    responses: { 201: json(TodoSchema, "Created"), 401: problemResponse("Not signed in"), 422: problemResponse("Invalid input") },
  }),
  async (c) => {
    const user = getUser(c);
    const { title } = c.req.valid("json");
    const [todo] = await db.insert(todos).values({ userId: user.id, title }).returning();
    return c.json(toDto(todo!), 201);
  },
);

todoRoutes.openapi(
  createRoute({
    method: "get", path: "/{id}", tags: ["todos"], summary: "Get one todo",
    security: [{ cookieAuth: [] }],
    request: { params: IdParam },
    responses: { 200: json(TodoSchema, "The todo"), ...responses404 },
  }),
  async (c) => {
    const user = getUser(c);
    const { id } = c.req.valid("param");
    const [todo] = await db.select().from(todos).where(and(eq(todos.id, id), eq(todos.userId, user.id)));
    if (!todo) throw notFound("No such todo");
    return c.json(toDto(todo), 200);
  },
);

todoRoutes.openapi(
  createRoute({
    method: "patch", path: "/{id}", tags: ["todos"], summary: "Update a todo",
    security: [{ cookieAuth: [] }],
    request: { params: IdParam, body: jsonBody(UpdateTodo) },
    responses: { 200: json(TodoSchema, "Updated"), ...responses404, 422: problemResponse("Invalid input") },
  }),
  async (c) => {
    const user = getUser(c);
    const { id } = c.req.valid("param");
    const changes = c.req.valid("json");
    if (Object.keys(changes).length === 0) throw badRequest("Nothing to update");
    const [todo] = await db
      .update(todos)
      .set(changes)
      .where(and(eq(todos.id, id), eq(todos.userId, user.id)))
      .returning();
    if (!todo) throw notFound("No such todo");
    return c.json(toDto(todo), 200);
  },
);

todoRoutes.openapi(
  createRoute({
    method: "delete", path: "/{id}", tags: ["todos"], summary: "Delete a todo",
    security: [{ cookieAuth: [] }],
    request: { params: IdParam },
    responses: { 204: { description: "Deleted" }, ...responses404 },
  }),
  async (c) => {
    const user = getUser(c);
    const { id } = c.req.valid("param");
    const deleted = await db
      .delete(todos)
      .where(and(eq(todos.id, id), eq(todos.userId, user.id)))
      .returning({ id: todos.id });
    if (deleted.length === 0) throw notFound("No such todo");
    return c.body(null, 204);
  },
);
