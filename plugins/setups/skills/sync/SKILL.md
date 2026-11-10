---
name: sync
description: Sync the personal-plugins marketplace with GitHub (pull others' changes / push local changes) and refresh Claude's plugin caches so every project sees the latest setups. Use when the user says sync, pull my setups, push my setups, or a setup looks out of date.
argument-hint: "[--pull | --push]"
allowed-tools: Bash(setups *), Bash(git *)
---

# Sync setups

- `setups sync` pulls (rebase), commits any uncommitted changes, pushes, and refreshes the marketplace and plugin caches.
- `setups sync --pull` only pulls. Use it on a second machine to fetch tweaks made elsewhere.
- `setups sync --push -m "msg"` only commits and pushes.

Before pushing, run `git -C "$(setups where)" status` and `git -C "$(setups where)" diff --stat` and summarize what will go up. If there are rebase conflicts, resolve them in the repo; never force-push.

When it finishes, tell the user to run `/reload-plugins` or restart.

Arguments: $ARGUMENTS
