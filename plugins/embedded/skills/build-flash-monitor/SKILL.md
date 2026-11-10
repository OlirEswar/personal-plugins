---
name: build-flash-monitor
description: Build, flash and read output from firmware non-interactively for any common toolchain (CMake/arm-none-eabi, STM32Cube, ESP-IDF, Zephyr west, PlatformIO, embedded Rust/probe-rs, Pico SDK, Arduino CLI, nRF) without hanging on interactive monitors. Use whenever you need to compile firmware, fix build errors, flash a board, or check what the device prints.
argument-hint: "[build|flash|monitor|all]"
---

# Build → flash → observe

Get the exact commands from `HARDWARE.md` if it exists. Otherwise detect them (see `project-init`) and offer to record them there.

**Never start an interactive monitor.** (To bound any long-running command, use `timeout N cmd`. On macOS that's `gtimeout`, from coreutils.) The plugin's guard hook blocks `idf.py monitor`, `screen`, `minicom`, `pio device monitor`, and similar. Capture output with:
```
serial-tail <port> -b 115200 -t 8 --reset                 # reset board, capture 8s of boot log
serial-tail <port> -t 20 --until "(READY|panic|Guru|HardFault)"  # stop early on a marker (exit 3 if not seen)
serial-tail <port> --send "status\r\n" -t 3                # send a shell command, read reply
serial-tail --list                                         # find the port
```
The monitor must have the port to itself. If opening it fails with "busy", something else holds it: a stale monitor process or an IDE.

## Toolchain cheat sheet (build / flash)
| Stack | Build | Flash |
|---|---|---|
| CMake + arm-none-eabi | `cmake -B build -G Ninja -DCMAKE_TOOLCHAIN_FILE=… && cmake --build build` | `openocd -f interface/stlink.cfg -f target/stm32f4x.cfg -c "program build/app.elf verify reset exit"` · `probe-rs download --chip <CHIP> build/app.elf && probe-rs reset --chip <CHIP>` · `st-flash --reset write app.bin 0x08000000` · `STM32_Programmer_CLI -c port=SWD -w app.elf -v -rst` |
| ESP-IDF | `idf.py build` (`idf.py set-target esp32s3` once) | `idf.py -p <port> flash` (no `monitor`) |
| Zephyr | `west build -b <board> app [-p auto]` | `west flash [--runner jlink\|openocd\|pyocd\|nrfjprog]` |
| PlatformIO | `pio run [-e env]` | `pio run -t upload [-e env]`; tests: `pio test -e env --without-uploading` or on the device |
| Embedded Rust | `cargo build --release` | `probe-rs download --chip <CHIP> target/thumbv7em-none-eabihf/release/<bin>`, then `probe-rs reset` (avoid `cargo run`, which streams forever) |
| Pico SDK | `cmake -B build && cmake --build build` | `picotool load -f -x build/app.uf2` or copy the UF2 to the RPI-RP2 drive |
| Arduino CLI | `arduino-cli compile -b <fqbn>` | `arduino-cli upload -p <port> -b <fqbn>` |
| nRF (nrfutil) | `west build` | `west flash` or `nrfutil device program --firmware <hex>` |

ESP-IDF needs its environment. If `idf.py` isn't found, source it in the same command: `. $HOME/esp/esp-idf/export.sh >/dev/null && idf.py build`. The same applies to the Zephyr venv and the nRF toolchain.

## Build errors
- Read the **first** error, not the last. Re-run with `-j1` / `ninja -j1` / `VERBOSE=1` if the output is interleaved.
- **Linker** errors:
  - `region FLASH overflowed`: check `size`, the map file, and the optimization level.
  - `undefined reference`: a source file isn't in the build, a HAL module is disabled in `*_hal_conf.h` or `prj.conf` / `sdkconfig`, or C++ name mangling is missing `extern "C"`.
  - Multiple definitions: something defined in a header.
- **Config systems**: Zephyr and ESP-IDF features are toggled through Kconfig (`prj.conf`, `sdkconfig.defaults`). Change the defaults file, not the generated `sdkconfig` or `.config`. Check the merged result: `build/zephyr/.config` or `build/config/sdkconfig.h`.

## Footprint
After a build, report the size delta when it matters: `arm-none-eabi-size build/app.elf`, `idf.py size` / `size-components`, `west build -t rom_report` / `ram_report`, `cargo size --release`. Find the largest symbols with `arm-none-eabi-nm --size-sort -S -C build/app.elf | tail -20`.

## Flash failures
- "No target / cannot connect": check power, SWD wiring, and that the probe is attached. Try connect-under-reset (`-c "reset_config srst_only connect_assert_srst"`, or `--connect-under-reset`).
- Flash read-protected or locked: **stop and ask**. Unlocking erases the chip, and some levels are permanent.
- ESP "Failed to connect": hold BOOT, tap EN (or use the auto-reset circuit), and lower the baud with `-b 115200`.

After flashing, always confirm the device runs: capture a boot log with `serial-tail --reset` or read RTT.
