---
name: promote
description: Push tweaks made in this project (new or edited skills, agents, commands, MCP servers, hooks) back into a personal setup plugin so every other project using that setup gets them. Use when the user says "update the embedded setup with this", "save this to my frontend setup", "promote", or "sync my changes back".
argument-hint: "<setup> [kind:name...]"
allowed-tools: Bash(setups *), Bash(git *)
---

# Promote project tweaks back into a setup

The setups live in the user's `personal-plugins` marketplace repo, which `setups where` prints. Promoting copies components from this project's `.claude/` (and `.mcp.json`) into `plugins/<setup>/` in that repo and commits.

## Workflow

1. **See what changed.** Run `setups status`. It lists every project-local component and labels it:
   - `new`: exists only in this project.
   - `modified vs <setup>`: an ejected or edited copy that differs from the setup's version.
   - `identical to <setup>`: already in the setup. Offer to delete the local copy.
2. **Choose the target setup.** If the user didn't name one, infer it from the enabled setups and confirm.
3. **Review the diffs.** For each `modified` item, run `setups diff <setup> <kind:name>` and summarize the change in a sentence. For `new` items, read them.
4. **Generalize before promoting.** A setup is shared by every project, so remove or parameterize anything specific to this one:
   - hard-coded paths, part numbers, board names, ports, or project names in skills and agents
   - MCP servers with literal tokens: replace them with `${ENV_VAR}` references (the CLI refuses literal secrets)
   - hooks that assume this repo's layout

   Make those edits in the project copy first, then promote.
5. **Promote:**
   ```
   setups promote <setup> skill:foo agent:bar mcp:baz hook:PostToolUse --move -m "<setup>: <what and why>"
   ```
   - `--all` promotes every new or modified item. Prefer explicit items unless the user asked for everything.
   - `--move` deletes the project copies afterwards so the plugin is the single source of truth. Recommend it, and skip it if the user wants to keep experimenting locally.
   - `--dry-run` previews the result.
   - `--push` pushes to GitHub right away. Ask the user first, unless they have already said to push.
6. **Keep docs in sync.** If you added a new component, add a row for it to the Contents table in `plugins/<setup>/README.md` in the repo, then run `setups sync --push` (or a plain commit, if they don't want to push).
7. **Tell the user how it propagates.** With the local-directory marketplace, other projects get the change on their next session or after `/reload-plugins`. On other machines, run `setups sync --pull`.

## Editing a setup directly

When the user wants to change a setup component that isn't in this project, either:
- `setups eject <setup> <kind:name>`, edit it, test it here, then promote it back (safest), or
- edit `$(setups where)/plugins/<setup>/...` directly and commit with `setups sync --push`.

Arguments: $ARGUMENTS
