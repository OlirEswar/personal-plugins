---
name: driver-bringup
description: Write and bring up a peripheral or external-device driver (sensor, radio, display, PMIC, memory) over I2C/SPI/UART/CAN from its datasheet - register map, init sequence, timing, error handling, and on-hardware verification. Use when adding support for a new chip/peripheral or porting a driver to a new platform.
argument-hint: "<part number> [bus]"
---

# Driver bring-up

## 1. Gather facts (cite pages)
With the `datasheets` skill, collect: bus and mode (I2C address and 7-bit form, SPI mode and max clock, UART framing), power-up timing, reset and enable pins, the chip-ID register and its expected value, the register map, the init sequence, conversion and settling times, the interrupt or data-ready pin behavior, endianness and data format (two's complement, left-justified, scaling), and **errata**. Check whether the vendor or the SDK already has a driver (Zephyr `drivers/sensor`, ESP-IDF components, the vendor GitHub). If a maintained one exists, wrap it instead of rewriting.

## 2. Design
- Layer it as: **bus abstraction** (read and write register functions passed in, so the driver is testable on the host) → **register layer** (constants generated from the datasheet, one place) → **device API** (`init`, `read`, `configure`, `sleep`).
- Follow the platform's conventions: Zephyr device-model and devicetree bindings, ESP-IDF components and `esp_err_t`, HAL handles, or `embedded-hal` traits in Rust.
- No dynamic allocation. The caller owns the state struct. Every bus call returns an error that gets propagated, never ignored.
- Use timeouts on every wait-for-flag loop. Never `while (!(REG & FLAG));`.

## 3. Bring up incrementally on hardware
1. Bus sanity check: scan I2C addresses, or read the chip-ID register and print it. **Stop here until the ID matches.**
2. Soft reset, then poll the ready status with a timeout.
3. Configure the minimal mode and read raw values. Sanity-check them against physics (room temperature, 1 g at rest).
4. Apply conversion and scaling, and compare against a reference (another sensor, a multimeter, the datasheet's typical values).
5. Add interrupts or DMA, low-power modes, and error recovery: a bus stuck low (clock out 9 pulses), NACK retries, and re-init after a brown-out.

Verify each step with `serial-tail` output. If it fails, use the peripheral checklist in `hardware-debug` and ask for a logic analyzer trace before you start guessing.

## 4. Finish
- Host unit tests for scaling and parsing using a fake bus (Unity, Ceedling, ztest, or `cargo test` on the host).
- Document the part, datasheet revision, pages used, wiring, and known limitations in a header comment, and add a row to HARDWARE.md.
