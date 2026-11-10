---
name: new
description: Create a new personal setup plugin (e.g. "python-data", "mobile", "rust-cli") in the personal-plugins marketplace, optionally seeded from the current project's skills, agents, MCP servers, and hooks. Use when the user wants a new kind of setup.
argument-hint: "<name> [description]"
allowed-tools: Bash(setups *), Bash(git *)
---

# Create a new setup

1. Agree on a kebab-case name and a one-line description.
2. Choose official plugins worth depending on instead of copying them, such as the LSPs `pyright-lsp`, `rust-analyzer-lsp`, `gopls-lsp`, plus `context7`, `playwright`, `frontend-design`. The marketplace is allowed to depend on `claude-plugins-official`. List the available ones with `ls ~/.claude/plugins/marketplaces/claude-plugins-official/{plugins,external_plugins}`.
3. Scaffold it:
   ```
   setups new <name> -d "<description>" --depends pyright-lsp@claude-plugins-official context7@claude-plugins-official [--from-project]
   ```
   `--from-project` seeds it with every skill, agent, command, MCP server, and hook in this project.
4. Build out the plugin in `$(setups where)/plugins/<name>/`, following the existing `frontend` and `embedded` setups:
   - `skills/<skill>/SKILL.md`: focused, task-shaped skills with clear trigger descriptions
   - `agents/<agent>.md`: subagents for context-heavy or isolated work
   - `.mcp.json`: MCP servers, with secrets as `${ENV_VAR}`
   - `hooks/hooks.json`: guards and formatters, referencing scripts via `${CLAUDE_PLUGIN_ROOT}`
   - `bin/`: helper CLIs, which are added to PATH while the plugin is enabled
   - `README.md`: keep the `## Prerequisites` section, because `setups use` prints it
5. Run `setups validate`, commit with `setups sync --push`, then `setups use <name>` in the project.

Arguments: $ARGUMENTS
