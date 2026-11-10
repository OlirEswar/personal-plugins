---
name: hardware-debug
description: Debug firmware on real hardware non-interactively - GDB batch scripts with OpenOCD/J-Link/probe-rs, HardFault/panic triage with cortexm-fault, backtrace decoding (addr2line, ESP-IDF panics, Zephyr fatal errors), stack overflow detection, RTT logging, and logic-analyzer/scope-driven bus debugging. Use when firmware crashes, hangs, resets, misbehaves on hardware, or a peripheral doesn't respond.
argument-hint: "[symptom]"
---

# Hardware debugging

Form a hypothesis, collect evidence from the device, then change exactly one thing. Write down what's been ruled out.

## Run GDB non-interactively
Start the GDB server in the background, then drive GDB in batch mode:
```
openocd -f interface/stlink.cfg -f target/stm32f4x.cfg > /tmp/openocd.log 2>&1 &   # or: JLinkGDBServer -device <DEV> -if SWD ; probe-rs gdb --chip <CHIP>
arm-none-eabi-gdb -q -batch build/app.elf \
  -ex "target extended-remote :3333" -ex "monitor reset halt" \
  -ex "break main" -ex "continue" -ex "bt" -ex "info registers" \
  -ex "x/4wx 0xE000ED28" -ex "x/wx 0xE000ED34" -ex "x/wx 0xE000ED38" \
  -ex "detach"
```
Put longer sequences in a `.gdb` file and run them with `-x script.gdb`. To attach without resetting, use `monitor halt` and don't run `load`. Kill the server when you're finished.

## Crash triage (Cortex-M)
1. Halt in the fault handler, or catch it with `break HardFault_Handler`.
2. Read `CFSR` (0xE000ED28), `HFSR` (0xE000ED2C), `MMFAR` (0xE000ED34), and `BFAR` (0xE000ED38), plus the stacked frame: `x/8wx $sp`, or `$psp` when LR=0xFFFFFFFD (RTOS task).
3. Decode them: `cortexm-fault --cfsr 0x… --hfsr 0x… --bfar 0x… --pc <stacked pc> --lr <stacked lr> --elf build/app.elf`.
4. Common causes:
   - stack overflow (STKERR/MSTKERR, or a corrupted LR)
   - NULL or dangling pointer (PRECISERR with BFAR near 0)
   - FPU not enabled (NOCP)
   - calling through a function pointer with bit 0 clear (INVSTATE)
   - a peripheral accessed before its clock is enabled (bus fault at the peripheral address)
   - an imprecise bus fault from a DMA or write buffer

**ESP-IDF panic** ("Guru Meditation"): capture it with `serial-tail --until "Rebooting" -t 20`. Decode the `Backtrace:` addresses with `xtensa-esp32-elf-addr2line -pfiaC -e build/app.elf <addrs>` (or `riscv32-esp-elf-addr2line`), or with `idf.py monitor`'s decoder through `timeout`. Enable core dumps for post-mortem analysis with `idf.py coredump-info`.

**Zephyr**: fatal error logs include the faulting PC and thread. Enable `CONFIG_ASSERT`, `CONFIG_STACK_SENTINEL` or `CONFIG_MPU_STACK_GUARD`, and `CONFIG_THREAD_ANALYZER`.

## Hangs and resets
- A hang: halt, then run `bt` to see where it's stuck. The usual culprits are busy-waits on flags that never set (clock off, wrong flag, errata), deadlocks, and priority inversion.
- Unexpected resets: read the reset cause register (RCC_CSR, ESP `esp_reset_reason()`, NRF RESETREAS) at boot. The usual culprits are watchdog, brown-out (check power during radio TX or motor start), and lockup.
- **Stack sizing**: compile with `-fstack-usage` (and `-Wstack-usage=N`) and check the RTOS high-water marks (`uxTaskGetStackHighWaterMark`, Zephyr thread analyzer). Paint the stack with a pattern and inspect it later.

## Logging without a UART
SEGGER RTT and defmt (Rust), read with `probe-rs attach` through `timeout`/`gtimeout`, or with `JLinkRTTLogger`. Semihosting is slow and halts without a debugger, so never ship it.

## Peripherals that "don't work"
Check in this order: clock enabled → pins in the right AF/mode (`svd decode … GPIOx.MODER/AFR`) → peripheral registers after init (dump them with GDB and decode with `svd`) → interrupts enabled in both the peripheral and the NVIC, with the correct handler name (a weak default handler means a name typo) → errata. Then look at the wire: ask the user for a logic analyzer capture (sigrok-cli or Saleae export) for I2C, SPI, or UART. Check pull-ups, idle levels, clock polarity and phase, and addressing (7-bit vs 8-bit).
