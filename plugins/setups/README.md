# setups

The manager for this marketplace. Install it once at **user** scope. It adds `/setups:*` skills and a `setups` CLI to the Bash PATH.

## Prerequisites

- Python 3, git, and the `claude` CLI

## Contents

| Kind | Name | Purpose |
|---|---|---|
| skill | `use` | Install, list, or drop setups for the current project |
| skill | `promote` | Push project tweaks back into a setup (diff, generalize, copy, commit) |
| skill | `eject` | Copy a setup component into the project to customize it |
| skill | `new` | Scaffold a new setup, optionally from the current project |
| skill | `sync` | Pull or push the repo with GitHub and refresh Claude's caches |
| bin | `setups` | CLI behind all of the above (`setups -h`) |
