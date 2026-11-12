#!/usr/bin/env python3
"""PreToolUse(Bash) guard for backend work.

deny : long-running servers/watchers started in the foreground (they block the session).
       Allowed when run_in_background is set, via devctl, bounded with timeout, or backgrounded with &.
ask  : commands that destroy data (dropping databases or tables, deleting Docker volumes,
       resetting migrations, or wiping a SQLite file).
"""
import json
import re
import sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
tool_input = data.get("tool_input") or {}
cmd = tool_input.get("command", "")
if not cmd:
    sys.exit(0)


def emit(decision, reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": reason,
    }}))
    sys.exit(0)


SEP = r"(^|[;&|(]\s*|\s)"
DESTRUCTIVE = [
    (r"\bdocker[- ]compose\b[^;&|]*\bdown\b[^;&|]*(\s-v\b|--volumes)", "`docker compose down -v` deletes the database volumes (all local data)"),
    (r"\bdocker\s+volume\s+(rm|prune)\b|\bdocker\s+system\s+prune\b[^;&|]*--volumes", "removing Docker volumes deletes database data"),
    (r"\bdrop\s+(database|schema|table)\b", "DROP DATABASE/SCHEMA/TABLE deletes data"),
    (r"\btruncate\s+(table\s+)?[\w\"]+", "TRUNCATE deletes every row"),
    (r"\bdelete\s+from\s+[\w\".]+\s*(;|\"|'|$)", "DELETE without WHERE deletes every row"),
    (r"\.drop(Database|Collection)?\s*\(|\bdeleteMany\s*\(\s*\{\s*\}\s*\)", "dropping/emptying MongoDB data"),
    (r"\bdrizzle-kit\b[^;&|]*\b(push\b[^;&|]*--force|drop)\b", "drizzle-kit push --force / drop can delete columns and data"),
    (r"\bprisma\s+(migrate\s+reset|db\s+push\b[^;&|]*--(force-reset|accept-data-loss))", "Prisma reset/force push deletes data"),
    (r"\bredis-cli\b[^;&|]*\bflush(all|db)\b", "FLUSHALL/FLUSHDB deletes Redis data"),
    (r"\brm\s+(-\w+\s+)*[^;&|]*\.(db|sqlite3?)(-wal|-shm)?\b", "deleting a SQLite database file"),
]
for pat, why in DESTRUCTIVE:
    if re.search(pat, cmd, re.I):
        emit("ask", f"Data-destroying command: {why}. Confirm this is a local/dev database you mean to wipe.")

if tool_input.get("run_in_background"):
    sys.exit(0)
if re.search(SEP + r"(devctl|timeout|gtimeout)\s", cmd) or re.search(r"&\s*$|&\s*(disown|wait)?\s*$", cmd.strip()):
    sys.exit(0)

SERVERS = [
    (r"\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start|serve|watch|test:watch)\b", "a dev/start script"),
    (r"\bnode\s+(--\S+\s+)*--watch\b|\btsx\s+watch\b|\bnodemon\b", "a file watcher"),
    (r"\bnext\s+(dev|start)\b|\bvite\b(\s+(dev|serve|preview))?\s*($|[;&|])|\bastro\s+dev\b|\bwrangler\s+dev\b", "a frontend dev server"),
    (r"\bvitest\b(?![^;&|]*\b(run|--run)\b)", "vitest in watch mode (use `vitest run`)"),
    (r"\b(uvicorn|gunicorn|flask\s+run|fastapi\s+(dev|run)|rails\s+s(erver)?|manage\.py\s+runserver)\b", "an app server"),
    (r"\bdocker[- ]compose\b[^;&|]*\bup\b(?![^;&|]*(\s-d\b|--detach|--wait))", "`docker compose up` without -d"),
    (r"\b(docker[- ]compose|docker)\b[^;&|]*\blogs\b[^;&|]*(\s-f\b|--follow)|\btail\s+-[a-zA-Z]*f", "a follow-mode log tail"),
]
for pat, label in SERVERS:
    if re.search(pat, cmd, re.I):
        emit("deny", f"This starts {label} in the foreground, which blocks the session. "
                     "Use `devctl start <name> --port <port> --cwd <dir> -- <command>` (then `devctl logs <name>`), "
                     "run it with run_in_background, or add -d / `vitest run` / `devctl logs` instead of following.")
sys.exit(0)
