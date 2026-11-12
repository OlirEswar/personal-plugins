// Example document-store resource backed by MongoDB. Same rules as todos.ts:
// validate input with zod, scope every query to the signed-in user, map documents to DTOs.
//   GET /api/notes   POST /api/notes   GET|PATCH|DELETE /api/notes/{id}
import { createRoute, z } from "@hono/zod-openapi";
import { ObjectId } from "mongodb";
import { collection } from "../db/mongo-client.ts";
import { createRouter, IdParam, json, jsonBody } from "../lib/router.ts";
import { badRequest, notFound, problemResponse } from "../lib/errors.ts";
import { getUser, requireUser } from "../auth/middleware.ts";

type NoteDoc = { _id: ObjectId; userId: string; title: string; body: string; tags: string[]; createdAt: Date; updatedAt: Date };
const notes = () => collection<NoteDoc>("notes");

const NoteSchema = z
  .object({
    id: z.string(), title: z.string(), body: z.string(), tags: z.array(z.string()),
    createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
  })
  .openapi("Note");
const NoteInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().max(20_000).default(""),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  })
  .openapi("NoteInput");
const NotePatch = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().max(20_000),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
  })
  .partial()
  .openapi("NotePatch");
const ListQuery = z.object({
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const toDto = (n: NoteDoc) => ({
  id: n._id.toHexString(), title: n.title, body: n.body, tags: n.tags,
  createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString(),
});
function objectId(id: string) {
  if (!ObjectId.isValid(id)) throw notFound("No such note");
  return new ObjectId(id);
}
const responses404 = { 401: problemResponse("Not signed in"), 404: problemResponse("No such note") };

export const notesRoutes = createRouter();
notesRoutes.use("*", requireUser);

notesRoutes.openapi(
  createRoute({
    method: "get", path: "/", tags: ["notes"], summary: "List my notes, newest first",
    security: [{ cookieAuth: [] }],
    request: { query: ListQuery },
    responses: { 200: json(z.object({ items: z.array(NoteSchema) }), "Notes"), 401: problemResponse("Not signed in") },
  }),
  async (c) => {
    const user = getUser(c);
    const { tag, limit } = c.req.valid("query");
    // Build filters from typed values only; never pass request JSON straight into a query (operator injection).
    const filter = tag ? { userId: user.id, tags: tag } : { userId: user.id };
    const docs = await notes().find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
    return c.json({ items: docs.map(toDto) }, 200);
  },
);

notesRoutes.openapi(
  createRoute({
    method: "post", path: "/", tags: ["notes"], summary: "Create a note",
    security: [{ cookieAuth: [] }],
    request: { body: jsonBody(NoteInput) },
    responses: { 201: json(NoteSchema, "Created"), 401: problemResponse("Not signed in"), 422: problemResponse("Invalid input") },
  }),
  async (c) => {
    const user = getUser(c);
    const input = c.req.valid("json");
    const now = new Date();
    const doc: NoteDoc = { _id: new ObjectId(), userId: user.id, ...input, createdAt: now, updatedAt: now };
    await notes().insertOne(doc);
    return c.json(toDto(doc), 201);
  },
);

notesRoutes.openapi(
  createRoute({
    method: "get", path: "/{id}", tags: ["notes"], summary: "Get one note",
    security: [{ cookieAuth: [] }],
    request: { params: IdParam },
    responses: { 200: json(NoteSchema, "The note"), ...responses404 },
  }),
  async (c) => {
    const user = getUser(c);
    const doc = await notes().findOne({ _id: objectId(c.req.valid("param").id), userId: user.id });
    if (!doc) throw notFound("No such note");
    return c.json(toDto(doc), 200);
  },
);

notesRoutes.openapi(
  createRoute({
    method: "patch", path: "/{id}", tags: ["notes"], summary: "Update a note",
    security: [{ cookieAuth: [] }],
    request: { params: IdParam, body: jsonBody(NotePatch) },
    responses: { 200: json(NoteSchema, "Updated"), ...responses404, 422: problemResponse("Invalid input") },
  }),
  async (c) => {
    const user = getUser(c);
    const changes = c.req.valid("json");
    if (Object.keys(changes).length === 0) throw badRequest("Nothing to update");
    const doc = await notes().findOneAndUpdate(
      { _id: objectId(c.req.valid("param").id), userId: user.id },
      { $set: { ...changes, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!doc) throw notFound("No such note");
    return c.json(toDto(doc), 200);
  },
);

notesRoutes.openapi(
  createRoute({
    method: "delete", path: "/{id}", tags: ["notes"], summary: "Delete a note",
    security: [{ cookieAuth: [] }],
    request: { params: IdParam },
    responses: { 204: { description: "Deleted" }, ...responses404 },
  }),
  async (c) => {
    const user = getUser(c);
    const res = await notes().deleteOne({ _id: objectId(c.req.valid("param").id), userId: user.id });
    if (res.deletedCount === 0) throw notFound("No such note");
    return c.body(null, 204);
  },
);
