---
name: project-init
description: Set up an embedded project for Claude - detect MCU, board, toolchain, build system, flash/debug probe and serial port, then write a HARDWARE.md fact sheet and link relevant datasheets so later sessions don't re-derive (or hallucinate) hardware facts. Use at the start of work in a new firmware repo, or when HARDWARE.md is missing or stale.
argument-hint: "[board or MCU]"
---

# Initialize an embedded project

Hardware facts must come from the repo, the datasheets, or the user. Never guess them. This skill writes them down once in `HARDWARE.md` at the project root and adds a pointer to it in `CLAUDE.md`.

## 1. Detect (read-only)
- **Build system**: `CMakeLists.txt` + toolchain file (bare-metal or STM32Cube), `sdkconfig` / `idf_component.yml` (ESP-IDF), `west.yml` / `prj.conf` / `boards/` (Zephyr), `platformio.ini`, `Cargo.toml` + `.cargo/config.toml` + `memory.x` (embedded Rust), `*.ioc` (CubeMX), `Makefile` with `arm-none-eabi-`, `*.ino` (Arduino), `pico_sdk_import.cmake`.
- **MCU and board**: `*.ioc`, `sdkconfig` (`CONFIG_IDF_TARGET`), the Zephyr `BOARD` value or `-b` flag in scripts or CI, the `board =` line in `platformio.ini`, linker scripts (`*.ld`: FLASH and RAM origin and length), startup files (`startup_stm32f407xx.s`), device headers, `memory.x`, and the `chip` setting in `Embed.toml` / `.cargo/config.toml`.
- **Toolchain**: `which arm-none-eabi-gcc idf.py west pio cargo probe-rs openocd JLinkExe STM32_Programmer_CLI pyocd nrfjprog esptool.py` plus versions. Note the C standard and flags from the build files.
- **Probe and ports**: `serial-tail --list`, `probe-rs list` (if installed), and `lsusb` / `system_profiler SPUSBDataType | grep -A2 -i -E "st-link|j-link|cmsis|cp210|ch340|ftdi|esp"`.
- **Pin map and peripherals**: the `.ioc` pin assignments, the devicetree (`*.dts`, `*.overlay`), `pins.h`/`board.h`, and the sdkconfig GPIO settings.
- **SVD**: `svd find`.
- **Datasheets**: `datasheet list`.

## 2. Ask for what can't be detected
Board revision, external parts (sensors, radios, PMIC) and their buses and addresses, which debug probe is used, and any errata the user already knows about. Ask only for what's missing, in one batch.

## 3. Write `HARDWARE.md`
```markdown
# Hardware
- MCU: <exact part, e.g. STM32F407VGT6> (core, max clock, flash/RAM sizes from the linker script)
- Board: <name + revision>   Clock tree: <HSE freq, SYSCLK, bus clocks as configured>
- Toolchain: <compiler + version>  Build: `<exact build command>`
- Flash: `<exact flash command>`   Probe: <ST-Link V3 / J-Link / USB-JTAG / UF2>
- Serial console: <port pattern> @ <baud>  -> `serial-tail <port> -b <baud> -t 5 --reset`
- Debug: `<gdb/openocd/probe-rs command>`
- SVD: <path>      Datasheets (in `datasheet list`): <slugs>
## Memory map
<regions from the linker script, bootloader offset, NVS/partitions>
## Pins / peripherals
| Signal | Pin | Peripheral/AF | Notes |
## External devices
| Part | Bus | Address/CS | Datasheet slug |
## Known errata / gotchas
```

## 4. Wire it up
- Add `@HARDWARE.md` to the project's `CLAUDE.md` (create the file if needed) so every session loads it.
- If a key datasheet or reference manual isn't in the library, offer to add it with the `datasheets` skill.
- If there's no SVD, offer to fetch one (see the `registers` skill).
