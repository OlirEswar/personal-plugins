---
name: firmware-guidelines
description: Embedded C/C++/Rust correctness rules - volatile and memory ordering, ISR safety, critical sections and atomics, DMA and cache coherency, integer pitfalls, no heap after init, stack/timing budgets, watchdog, power and fail-safe behavior. Use when writing or reviewing firmware code, especially interrupts, drivers, RTOS tasks, or anything touching shared state or hardware registers.
user-invocable: true
---

# Firmware guidelines

Apply these when writing firmware and check every diff against them. They apply to C, C++, and Rust (where Rust's type system already covers a rule, rely on it).

## Concurrency (ISR ↔ main ↔ tasks)
- Data shared with an ISR must be `volatile` (C) **and** accessed atomically. On a 32-bit MCU, multi-word values, read-modify-writes, and 64-bit counters need a critical section or C11 atomics. In Rust, use `critical_section::Mutex`, atomics, or RTIC resources.
- `volatile` isn't a memory barrier. Use `__DMB()` / `__DSB()` (or atomics with the right ordering) around DMA handoffs and before sleeping (`__DSB(); __WFI();`).
- Keep critical sections short. Save and restore PRIMASK (`__get_PRIMASK`) instead of blindly re-enabling interrupts.
- ISRs stay short and bounded: no blocking, no `printf`, no malloc, and RTOS calls only in their `FromISR` variants. Defer the work to a task (queue, notification, flag).
- Clear interrupt flags correctly: write-1-to-clear, clear early enough to avoid re-entry, and read back where the core needs the write to complete before exit.
- NVIC priorities: with FreeRTOS, ISRs that call the API must be numerically ≥ `configMAX_SYSCALL_INTERRUPT_PRIORITY`.

## DMA and caches (Cortex-M7, ESP32, and others)
- Buffers used by DMA must be cache-line aligned (32 bytes) and sized to whole lines, or placed in non-cacheable memory (MPU region, DTCM where DMA can reach it). Clean the D-cache before a TX DMA and invalidate it after RX.
- DMA buffers must live in memory the DMA controller can access (some SRAM banks, CCM, and DTCM are not reachable on some parts), and they must outlive the transfer, so not on the stack of a function that has returned.

## Memory
- No heap after init, or no heap at all. Use static allocation and fixed pools. Every buffer write is bounds-checked, using `snprintf` and never `sprintf`.
- Know the stack budget per task or ISR (`-fstack-usage`) and avoid large locals and recursion.
- Put `const` data in flash (`const`, or `PROGMEM` on AVR). Watch for accidental copies into RAM.

## Integers and types
- Use `<stdint.h>` fixed-width types for registers and protocol fields. Watch integer promotion (`uint8_t` ops promote to `int`), signed overflow (undefined behavior), and shifts by ≥ the type width.
- Make units explicit in names (`timeout_ms`, `temp_centi_c`). Make fixed-point scaling explicit. Avoid floats in ISRs, and don't use them at all on FPU-less cores unless budgeted.
- Tick-count comparisons must survive wrap-around: `(int32_t)(now - deadline) >= 0`.
- Protocol and storage structs need explicit endianness and packing. Use memcpy or a serializer, never casts of unaligned pointers.

## Hardware access
- Peripheral clock first, then configure, then enable. Respect documented sequences and delays, and cite the RM page in a comment.
- Every wait-for-hardware loop has a timeout and an error path.
- Preserve reserved bits. Use read-modify-write with masks (except on write-1-to-clear registers).

## Robustness
- Watchdog: feed it from a point that proves the whole system is healthy (e.g. all tasks have checked in), never from a timer ISR.
- Define a safe state for outputs (motors, heaters, radios) on fault and reset. Check brown-out and reset-reason handling.
- Firmware update and persistent storage: handle power loss at every step (A/B images, journaling, CRCs, versioned layouts).
- Validate all external input (RX buffers, BLE writes, CAN frames) for length and range.

## Style
Follow the project's existing standard (MISRA C subset, Barr-C, Zephyr or ESP-IDF style) and its formatter (`.clang-format`). Compile cleanly with `-Wall -Wextra -Wshadow -Wconversion` where the codebase allows it, and run static analysis if it's configured (`clang-tidy`, `cppcheck --addon=misra`, `cargo clippy`).
