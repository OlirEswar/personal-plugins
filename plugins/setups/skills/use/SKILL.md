---
name: use
description: Install one or more personal setups (e.g. frontend, embedded) into the current project, or list/remove them. Use when the user wants to add, switch, list, or drop a setup/toolkit for this project.
argument-hint: "[setup...] | list | drop <setup>"
allowed-tools: Bash(setups *)
---

# Install a setup into this project

`setups` is on PATH (from this plugin's `bin/`). If it is not, use `"${CLAUDE_PLUGIN_ROOT}/bin/setups"`.

1. If no setup was named, or the user asked to list: run `setups list` and ask which to install. Briefly say what each one brings, using its description.
2. Install: `setups use <name> [<name>...]`.
   - Default scope is `project`, which writes `.claude/settings.json`. That file is committed, so the setup follows the repo to other machines.
   - Use `--scope local` (`.claude/settings.local.json`, not committed) for a shared or team repo where others don't use this marketplace. If you're unsure, ask.
3. To switch setups, `setups drop <old>` and then `setups use <new>`. Setups can be combined: a web dashboard for a device can use both `frontend` and `embedded`.
4. Pass on any **prerequisites** the command prints, such as language servers or CLIs to install, and offer to install them.
5. Tell the user to run `/reload-plugins`, or restart Claude Code, so the setup loads.

Arguments: $ARGUMENTS
