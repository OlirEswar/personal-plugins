# embedded

A setup for firmware and embedded projects (STM32/Cortex-M, ESP32, nRF, RP2040, Zephyr, FreeRTOS, embedded Rust).

## Prerequisites

- Python 3 (all helper CLIs use only the stdlib)
- `clangd` for C/C++ code intelligence (Xcode CLT or `brew install llvm`). Generate `compile_commands.json`: CMake `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`, ESP-IDF and Zephyr produce it in `build/`, PlatformIO `pio run -t compiledb`
- Datasheet text extraction: `brew install poppler` (best), otherwise `uv` (falls back to pypdf)
- Your toolchain and probe tools as needed: `arm-none-eabi-gcc`, `openocd` / `probe-rs` / J-Link, ESP-IDF, west, PlatformIO

## Contents

| Kind | Name | Purpose |
|---|---|---|
| skill | `project-init` | Detects MCU, toolchain, probe, and ports, then writes `HARDWARE.md` and links it from CLAUDE.md |
| skill | `datasheets` | Shared PDF library with page-cited search. Never quote specs from memory |
| skill | `registers` | CMSIS-SVD lookups: addresses, bitfields, reset values, decoding raw values |
| skill | `build-flash-monitor` | Per-toolchain build and flash, plus non-interactive serial capture |
| skill | `hardware-debug` | GDB batch, HardFault/panic triage, hangs and resets, stack, RTT, bus debugging |
| skill | `driver-bringup` | Datasheet to layered driver, verified step by step on hardware |
| skill | `firmware-guidelines` | ISR, atomic, DMA/cache, integer, memory, and robustness rules |
| agent | `datasheet-researcher` | Reads many pages in its own context and returns cited facts |
| agent | `firmware-reviewer` | Read-only embedded-specific code review, verified against the SVD |
| bin | `serial-tail` | Bounded serial capture with reset, send, and stop-on-regex |
| bin | `datasheet` | `add` / `list` / `search` / `page` / `toc` for the shared library (`~/.local/share/datasheets`) |
| bin | `svd` | `peripherals` / `show` / `search` / `decode` / `addr` from SVD files |
| bin | `cortexm-fault` | Decodes CFSR/HFSR/MMFAR/BFAR/EXC_RETURN, plus addr2line |
| hook | PreToolUse(Bash) | Denies hanging interactive monitors; asks before eFuse, RDP, fuse, or mass-erase operations |
| dep | `clangd-lsp` | C/C++ LSP (official marketplace) |
| dep | `context7` | SDK docs: ESP-IDF, Zephyr, STM32 HAL, Pico SDK, and more (official marketplace) |

## Optional MCP servers worth trying per project

The embedded MCP ecosystem is still young, so these aren't bundled. Try one in a project, then `/setups:promote` it here if it earns its place:
- PlatformIO MCP servers (build, upload, monitor, and test through `pio`)
- ESP-IDF MCP servers (build, flash, monitor; `horw/esp-mcp` and others)
- Zephyr/west workspace analyzers
