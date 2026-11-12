// Logging. Use this instead of console.* so every line has a level and searchable fields.
//   log.info("user signed up", { user: id })
//   development: 12:01:02 INFO  user signed up user=4f1c...
//   production:  {"time":"2026-01-01T12:01:02.000Z","level":"info","msg":"user signed up","user":"4f1c..."}
// LOG_LEVEL (debug | info | warn | error) sets the minimum level. Default: info, and silent in tests.
// Never log passwords, tokens, cookies, or full request bodies.
import { env } from "../env.ts";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minimum = env.LOG_LEVEL ? ORDER[env.LOG_LEVEL] : env.NODE_ENV === "test" ? 100 : ORDER.info;

function errorFields(err: unknown): Fields {
  return err instanceof Error ? { error: err.message, stack: err.stack } : { error: String(err) };
}

function write(level: Level, msg: string, fields: Fields = {}) {
  if (ORDER[level] < minimum) return;
  const { err, ...rest } = fields;
  const all = err === undefined ? rest : { ...rest, ...errorFields(err) };
  const out = level === "error" || level === "warn" ? process.stderr : process.stdout;
  if (env.isProd) {
    out.write(JSON.stringify({ time: new Date().toISOString(), level, msg, ...all }) + "\n");
    return;
  }
  const { stack, ...inline } = all;
  const kv = Object.entries(inline)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ");
  const time = new Date().toTimeString().slice(0, 8);
  out.write(`${time} ${level.toUpperCase().padEnd(5)} ${msg}${kv ? " " + kv : ""}\n${stack ? stack + "\n" : ""}`);
}

export const log = {
  debug: (msg: string, fields?: Fields) => write("debug", msg, fields),
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  // Pass the caught error as `err` to get its message and stack.
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};
