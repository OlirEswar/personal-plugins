---
name: registers
description: Get register addresses, bitfields, reset values and enumerations from the vendor CMSIS-SVD file, decode raw register dumps, and verify register-level code against the SVD. Use when writing or reviewing bare-metal/register code, decoding a peripheral register value read from a debugger, or checking a HAL's behavior.
argument-hint: "<PERIPH.REG | address | value>"
---

# Registers via SVD

The SVD file is the machine-readable register map. Use it instead of recalling addresses or bit positions from memory. The `svd` CLI is on PATH.

## Find an SVD
- `svd find` (searches the project), or `svd find ~/STMicroelectronics ~/.platformio/packages ~/esp ~/ncs`.
- Sources: the vendor CMSIS-Pack (`.pack` is a zip containing `*.svd`), the `cmsis-svd/cmsis-svd-data` GitHub repo, the STM32CubeIDE install, the Nordic MDK (`nrf52840.svd`), Pico SDK `src/rp2040/hardware_regs/rp2040.svd`, Espressif `esp-pacs` / `svd/` (ESP32-C3/S3 and others), and Rust PAC crates (`stm32-rs` has patched, corrected SVDs).
- Record its path in `HARDWARE.md`.

## Use
```
svd peripherals <file.svd> [filter]          # base addresses
svd show <file.svd> RCC                       # registers, offsets, reset values
svd show <file.svd> RCC.PLLCFGR               # fields with bit ranges + descriptions
svd search <file.svd> PLLM                    # where is this field?
svd decode <file.svd> GPIOA.MODER 0xA8000000  # decode a value read with GDB: x/wx 0x40020000
svd addr <file.svd> 0x40023804                # what register is this address?
```

## Writing register code
- Use the vendor device header's names (`RCC->PLLCFGR`, `RCC_PLLCFGR_PLLM_Pos`) or a PAC. Don't hand-define addresses unless no header exists, and if you must, cross-check every address and mask against `svd show`.
- Do read-modify-write with explicit masks (`reg = (reg & ~MASK) | (val << POS)`). Watch for **write-1-to-clear** status bits, where a RMW clears other flags. The SVD marks these as `oneToClear`, and the reference manual says "rc_w1".
- Respect required sequences that the SVD doesn't encode, such as enabling the clock before accessing the peripheral, unlock keys, wait-for-ready flags, and reserved bits that must keep their reset value. Get these from the reference manual with the `datasheets` skill.
- SVDs sometimes have mistakes. If the SVD and the reference manual disagree, trust the RM and errata and note the discrepancy.
