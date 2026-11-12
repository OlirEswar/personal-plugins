// npm run db:seed: create a demo user with a few todos (safe to re-run).
//   email: demo@example.com   password: demo-password
import { eq } from "drizzle-orm";
import { closeDb, db } from "./client.ts";
import { todos, users } from "./schema.ts";
import { hashPassword } from "../auth/password.ts";

const email = "demo@example.com";
let [user] = await db.select().from(users).where(eq(users.email, email));
if (!user) {
  [user] = await db.insert(users).values({ email, passwordHash: await hashPassword("demo-password"), emailVerifiedAt: new Date() }).returning();
  await db.insert(todos).values(
    ["Read the API docs at /api/docs", "Wire the frontend to /api", "Ship it"].map((title) => ({
      userId: user!.id,
      title,
    })),
  );
  console.log(`Seeded ${email} / demo-password`);
} else {
  console.log(`${email} already exists; nothing to do.`);
}
await closeDb();
