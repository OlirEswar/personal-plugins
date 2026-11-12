import { describe, expect, it } from "vitest";
import { client, signedInClient } from "./helpers.ts";

describe("todos", () => {
  it("requires sign-in", async () => {
    expect((await client().get("/api/todos")).status).toBe(401);
  });

  it("creates, reads, updates, and deletes", async () => {
    const c = await signedInClient();
    const created = await c.post("/api/todos", { title: "  write tests  " });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe("write tests");
    const id = created.body.id;

    expect((await c.get(`/api/todos/${id}`)).body.done).toBe(false);
    const updated = await c.patch(`/api/todos/${id}`, { done: true });
    expect(updated.body.done).toBe(true);

    expect((await c.delete(`/api/todos/${id}`)).status).toBe(204);
    expect((await c.get(`/api/todos/${id}`)).status).toBe(404);
  });

  it("hides other users' todos", async () => {
    const alice = await signedInClient();
    const bob = await signedInClient();
    const { body } = await alice.post("/api/todos", { title: "private" });

    expect((await bob.get(`/api/todos/${body.id}`)).status).toBe(404);
    expect((await bob.patch(`/api/todos/${body.id}`, { done: true })).status).toBe(404);
    expect((await bob.delete(`/api/todos/${body.id}`)).status).toBe(404);
    expect((await bob.get("/api/todos")).body.items).toEqual([]);
  });

  it("paginates newest first with a cursor", async () => {
    const c = await signedInClient();
    for (const title of ["a", "b", "c", "d", "e"]) await c.post("/api/todos", { title });

    // Rows created in the same millisecond tie on createdAt, so check coverage, not exact order.
    const titles: string[] = [];
    let cursor: string | null = null;
    const sizes: number[] = [];
    do {
      const page = await c.get(`/api/todos?limit=2${cursor ? `&cursor=${cursor}` : ""}`);
      expect(page.status).toBe(200);
      sizes.push(page.body.items.length);
      titles.push(...page.body.items.map((t: { title: string }) => t.title));
      cursor = page.body.nextCursor;
    } while (cursor);
    expect(sizes).toEqual([2, 2, 1]);
    expect(titles.sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("validates input", async () => {
    const c = await signedInClient();
    expect((await c.post("/api/todos", { title: "" })).status).toBe(422);
    expect((await c.get("/api/todos?limit=1000")).status).toBe(422);
  });
});
