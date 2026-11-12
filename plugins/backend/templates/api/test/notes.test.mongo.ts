import { describe, expect, it } from "vitest";
import { client, signedInClient } from "./helpers.ts";

describe("notes (MongoDB)", () => {
  it("requires sign-in", async () => {
    expect((await client().get("/api/notes")).status).toBe(401);
  });

  it("creates, filters by tag, updates, deletes", async () => {
    const c = await signedInClient();
    const a = await c.post("/api/notes", { title: "groceries", tags: ["home"] });
    expect(a.status).toBe(201);
    await c.post("/api/notes", { title: "standup", tags: ["work"] });

    const home = await c.get("/api/notes?tag=home");
    expect(home.body.items.map((n: { title: string }) => n.title)).toEqual(["groceries"]);

    const patched = await c.patch(`/api/notes/${a.body.id}`, { body: "milk, eggs" });
    expect(patched.body.body).toBe("milk, eggs");

    expect((await c.delete(`/api/notes/${a.body.id}`)).status).toBe(204);
    expect((await c.get(`/api/notes/${a.body.id}`)).status).toBe(404);
  });

  it("hides other users' notes and rejects junk ids", async () => {
    const alice = await signedInClient();
    const bob = await signedInClient();
    const { body } = await alice.post("/api/notes", { title: "secret" });
    expect((await bob.get(`/api/notes/${body.id}`)).status).toBe(404);
    expect((await bob.get("/api/notes/not-an-object-id")).status).toBe(404);
  });
});
