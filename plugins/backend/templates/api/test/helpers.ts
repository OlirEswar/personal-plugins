// Test helpers: call the app in-process and carry the session cookie between requests.
// Requests send the frontend's Origin header, as a browser would.
import { app } from "../src/app.ts";

const origin = (process.env.WEB_ORIGIN ?? "http://localhost:5173").split(",")[0]!;

export type Client = ReturnType<typeof client>;

// Each client gets its own fake IP (TRUST_PROXY=1 in .env.test), so rate limits don't leak between tests.
const randomIp = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 256)).join(".")}`;

export function client(cookie = "", ip = randomIp()) {
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, {
      method,
      headers: { Origin: origin, "X-Forwarded-For": ip, ...(body !== undefined && { "Content-Type": "application/json" }), ...(cookie && { Cookie: cookie }) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0]!;
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };
  return {
    get: (path: string) => call("GET", path),
    post: (path: string, body?: unknown) => call("POST", path, body),
    patch: (path: string, body?: unknown) => call("PATCH", path, body),
    delete: (path: string) => call("DELETE", path),
    get cookie() {
      return cookie;
    },
  };
}

export async function signedInClient() {
  const c = client();
  const email = `user-${crypto.randomUUID()}@example.com`;
  const res = await c.post("/api/auth/signup", { email, password: "correct-horse-battery" });
  if (res.status !== 201) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return Object.assign(c, { email });
}
