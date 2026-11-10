# personal-plugins

This repo is a Claude Code plugin marketplace (`.claude-plugin/marketplace.json`). Each plugin under `plugins/` is a **setup**, a per-project toolkit. `plugins/setups` is the manager, with the `setups` CLI in `plugins/setups/bin/setups`.

## Conventions
- Each plugin has `.claude-plugin/plugin.json` (no `version`, so installs track git commits), `README.md` (with a `## Prerequisites` section that `setups use` prints, and a Contents table), `skills/<name>/SKILL.md`, `agents/<name>.md`, an optional `.mcp.json`, `hooks/hooks.json`, and `bin/`.
- Reuse official plugins through `dependencies: ["name@claude-plugins-official"]` instead of copying them. The marketplace allowlists that marketplace.
- Hook and MCP commands reference files with `${CLAUDE_PLUGIN_ROOT}`. Persistent state goes in `${CLAUDE_PLUGIN_DATA}`. Never commit secrets: MCP configs use `${ENV_VAR}`.
- Helper scripts use only the Python stdlib so they run anywhere.
- Skill descriptions say *when* to trigger. Bodies stay concise and task-shaped.
- When adding a plugin, also add its entry to `.claude-plugin/marketplace.json` (or use `setups new`).

## Checks
`python3 plugins/setups/bin/setups validate` runs `claude plugin validate` on the marketplace and every plugin. Run it before committing.
