---
name: eject
description: Copy a skill, agent, or command from a personal setup into the current project so it can be customized and tested locally before promoting it back. Use when the user wants to tweak or customize part of a setup.
argument-hint: "<setup> <skill|agent|command>:<name>"
allowed-tools: Bash(setups *)
---

# Eject a setup component for local tweaking

1. If the user didn't name the component, list the setup's contents from `$(setups where)/plugins/<setup>/README.md` (or its `skills/` and `agents/` dirs) and ask which one.
2. Run `setups eject <setup> <kind:name>`. This copies it into `.claude/skills/<name>/`, `.claude/agents/<name>.md`, or `.claude/commands/<name>.md`.
3. Make the requested edits to the local copy. While it is ejected, both versions load: the plugin's `/<setup>:<name>` and the local `/<name>`. Use the local one when testing.
4. Once the tweak works, promote it with `/setups:promote` (`setups promote <setup> <kind:name> --move`) so every project gets it.

Arguments: $ARGUMENTS
