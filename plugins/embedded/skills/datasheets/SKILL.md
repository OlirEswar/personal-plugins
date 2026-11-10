---
name: datasheets
description: Look up facts in datasheets, reference manuals, errata and app notes with page citations - add PDFs to the shared datasheet library, search it, and read only the relevant pages. Use whenever a task depends on electrical specs, timing, register behavior, pinouts, protocol details or errata for a specific part - never answer those from memory.
argument-hint: "<part or question>"
---

# Datasheet research

Rule: **hardware numbers come from the document, with a page citation.** This covers register bits, timing, voltage and current limits, I2C addresses, clock limits, and errata. If the document isn't in the library, say so and get it rather than guessing.

The `datasheet` CLI (on PATH from this plugin) keeps a shared library in `~/.local/share/datasheets`, with one text file per page. It's shared across all projects, so a reference manual only needs to be added once.

## Add documents
```
datasheet add <path-or-url.pdf> --slug stm32f4-rm --title "RM0090 STM32F405/7 reference manual" --kind reference-manual --part STM32F407
```
- Typical MCU work needs the **datasheet** (pinout, electrical, AF mapping), the **reference manual** (peripherals and registers), the **errata sheet**, and the **programming manual** (core, NVIC, faults). External parts usually have a single datasheet.
- Name slugs as `<part>-<kind>`: `-ds`, `-rm`, `-errata`, `-pm`, `-an1234`.
- If a vendor URL returns HTML instead of a PDF (login or cookie wall), ask the user to download the file and give you the path.
- A scanned PDF with no text layer needs OCR first: `ocrmypdf in.pdf out.pdf`.

## Query
1. `datasheet list` shows what's available.
2. `datasheet toc <slug> <filter>` jumps to a section when the PDF has an outline.
3. `datasheet search "<register or term>" --doc <slug> -C 2` finds the pages. Search for exact register names (`RCC_PLLCFGR`, `CTRL_REG1`) and parameter names (`t_SU;STA`, `V_IH`). Use `-E` for regex.
4. `datasheet page <slug> <start> [end]` reads only those pages, up to 16 at a time. Register tables and timing diagrams often continue onto the next page, so read it as well.
5. **Always check the errata** for the peripheral you're using: `datasheet search "<peripheral>" --doc <part>-errata`.

## Answer format
State the fact and its source together, for example: "PLLM must be 2–63 and VCO input 1–2 MHz (stm32f4-rm p.226, RCC_PLLCFGR)." If two documents conflict (datasheet vs. reference manual, or rev A vs. rev B), point out the conflict, and treat errata and the newest revision as authoritative.

For broad questions that need many pages, such as "summarize every constraint for configuring the ADC with DMA", delegate to the **datasheet-researcher** agent. It digs through the pages in its own context and returns a cited summary.

If the information still can't be found, use `context7` for SDK/HAL API docs (ESP-IDF, Zephyr, STM32 HAL, nRF Connect SDK, Pico SDK), or ask the user.
