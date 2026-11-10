#!/usr/bin/env bash
# PostToolUse hook: format the file Claude just wrote using the PROJECT's formatter.
# Never installs anything, never fails the tool call. No formatter in the project -> no-op.
input="$(cat)"
file="$(printf '%s' "$input" | python3 -c 'import json,sys; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path",""))' 2>/dev/null)"
[ -n "$file" ] && [ -f "$file" ] || exit 0
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.css|*.scss|*.html|*.vue|*.svelte|*.astro|*.json|*.md|*.mdx) ;;
  *) exit 0 ;;
esac
case "$file" in */node_modules/*|*/dist/*|*/build/*|*/.next/*) exit 0 ;; esac

root="${CLAUDE_PROJECT_DIR:-$PWD}"
bin="$root/node_modules/.bin"
if [ -x "$bin/biome" ] && ls "$root"/biome.json* >/dev/null 2>&1; then
  "$bin/biome" format --write "$file" >/dev/null 2>&1
elif [ -x "$bin/prettier" ]; then
  "$bin/prettier" --write --log-level=silent "$file" >/dev/null 2>&1
fi
exit 0
