# personal-plugins

My personal Claude Code plugin marketplace. Each plugin is a **setup**: a bundle of skills, subagents, MCP servers, hooks, and helper CLIs for one kind of project. Install a setup per project instead of loading everything globally.

| Setup | For | Highlights |
|---|---|---|
| [`frontend`](plugins/frontend) | Web UI and design-heavy work | design-review loop, WCAG 2.2 audits, Core Web Vitals, design tokens, Figma-to-code, motion · Playwright, Chrome DevTools, shadcn, and Figma MCPs · TS LSP |
| [`backend`](plugins/backend) | Production APIs and full-stack apps (pair with `frontend`) | tested Hono + Drizzle API scaffold (SQLite/Postgres, optional MongoDB) with full account auth, job queue, structured logs, Dockerfile and CI · OpenAPI contract and typed client · contract-first parallel frontend/backend workflow · `devctl` background dev servers · deploy skill, security and launch reviewers · guard against foreground servers and data wipes |
| [`embedded`](plugins/embedded) | Firmware and MCU work | shared datasheet library with page citations, SVD register lookup, serial capture, Cortex-M fault decoder, firmware reviewer · guard against hanging monitors and eFuse burns · clangd |
| [`setups`](plugins/setups) | The manager (install once, user scope) | `/setups:use`, `/setups:eject`, `/setups:promote`, `/setups:new`, `/setups:sync` |

## One-time setup (per machine)

```bash
git clone https://github.com/OlirEswar/personal-plugins ~/Projects/personal_plugins   # skip on this machine
claude plugin marketplace add ~/Projects/personal_plugins
claude plugin install setups@personal-plugins            # user scope: available everywhere
```

The marketplace is added from the **local checkout**, so Claude loads the plugins in place. When you edit this repo, every project gets the change on its next session or after `/reload-plugins`. No version bumps and no cache refreshes.

## Using a setup in a project

In Claude Code, inside the project:
```
/setups:use embedded          # or: frontend, backend, or several (frontend backend)
```
Or from a terminal: `setups use embedded`. The CLI lives at `plugins/setups/bin/setups`, so add that folder to your PATH or alias it.

This writes `enabledPlugins` to the project's `.claude/settings.json` (pass `--scope local` to keep it out of git) and installs the setup's official dependencies, such as `clangd-lsp` and `context7`. Run `/reload-plugins` to load it. To remove a setup, use `setups drop embedded`.

## Updating a setup from another project

You'll tweak setups while using them. Get the tweaks back here with one command:

1. **Customize in the project.** Add a skill in `.claude/skills/`, an agent in `.claude/agents/`, an MCP server in `.mcp.json`, or hooks in `.claude/settings.json`. Or run `setups eject embedded skill:datasheets` to copy an existing setup skill into the project and edit it there.
2. **See what's different**: `setups status` lists each item as new, modified, or identical. `setups diff embedded skill:datasheets` shows the changes.
3. **Promote it**: `/setups:promote embedded` asks Claude to review and generalize the change first, removing project-specific paths and turning secrets into `${ENV_VAR}`. The CLI equivalent is:
   ```bash
   setups promote embedded skill:datasheets agent:power-analyst mcp:platformio hook:PostToolUse --move --push
   ```
   This copies the items into `plugins/embedded/`, merges the MCP and hook configs (rewriting `.claude/hooks/*` script paths to `${CLAUDE_PLUGIN_ROOT}`), deletes the project copies (`--move`), commits, and optionally pushes. Literal API tokens are refused.
4. **Every other project** using `embedded` picks up the change on its next session. **Other machines** run `setups sync --pull`.

## Other commands

```bash
setups list                    # setups + which are enabled in this project
setups new python-data -d "Data science setup" --depends pyright-lsp@claude-plugins-official --from-project
setups sync                    # pull, commit, push, and refresh plugin caches
setups validate                # claude plugin validate on everything
setups where                   # path to this repo
```

## Layout

```
.claude-plugin/marketplace.json   # catalog (allows deps on claude-plugins-official)
plugins/<setup>/
  .claude-plugin/plugin.json      # no "version": installs track git commits
  skills/<name>/SKILL.md
  agents/<name>.md
  .mcp.json                       # MCP servers (secrets as ${ENV_VAR})
  hooks/hooks.json                # + scripts via ${CLAUDE_PLUGIN_ROOT}
  bin/                            # added to Claude's Bash PATH while enabled
  README.md                       # "## Prerequisites" is printed by `setups use`
```

## Notes

- Project-scoped plugins load only after you accept the workspace trust dialog for that folder.
- If a project's committed settings enable `embedded@personal-plugins` on a machine without this marketplace, the plugin isn't loaded there until you do the one-time setup.
- Token cost per setup: `claude plugin details embedded@personal-plugins`. Each is about 1.2k tokens always-on. Skill bodies load only when used.
