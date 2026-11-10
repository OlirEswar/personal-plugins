#!/usr/bin/env python3
"""PreToolUse(Bash) guard for embedded work.

deny : interactive monitors/terminals that never exit (they hang the agent)
ask  : irreversible or bricking operations (eFuse burns, flash read-protection, mass erase, AVR fuses)
"""
import json
import os
import re
import sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
cmd = (data.get("tool_input") or {}).get("command", "")
if not cmd:
    sys.exit(0)

bounded = re.search(r"(^|[;&|]\s*|\s)(timeout|gtimeout)\s+\d", cmd) or "serial-tail" in cmd

MONITORS = [
    (r"\bidf\.py\b[^;&|]*\bmonitor\b", "idf.py monitor"),
    (r"\b(pio|platformio)\b[^;&|]*\bdevice\s+monitor\b", "pio device monitor"),
    (r"\bwest\b[^;&|]*\b(espressif\s+monitor|attach)\b", "west monitor/attach"),
    (r"(^|[;&|]\s*|\s)(screen|minicom|picocom|miniterm(\.py)?|tio|putty|cu)\s+(-\S+\s+)*\S*(/dev/|tty|COM\d)", "interactive serial terminal"),
    (r"\bpython3?\s+-m\s+serial\.tools\.miniterm\b", "pyserial miniterm"),
    (r"\barduino-cli\b[^;&|]*\bmonitor\b", "arduino-cli monitor"),
    (r"\bprobe-rs\s+(run|attach)\b(?![^;&|]*--no-?(rtt|location))", "probe-rs run/attach (streams RTT forever)"),
    (r"\bcargo\s+embed\b", "cargo embed (streams RTT forever)"),
]
# `cargo run` only hangs when the project's runner is a probe (embedded Rust)
cargo_cfg = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()), ".cargo", "config.toml")
try:
    if "probe-rs" in open(cargo_cfg).read():
        MONITORS.append((r"\bcargo\s+run\b", "cargo run with probe-rs runner (streams RTT forever)"))
except OSError:
    pass
DANGEROUS = [
    (r"\bespefuse(\.py)?\b[^;&|]*\bburn", "burning ESP32 eFuses is PERMANENT"),
    (r"\bidf\.py\b[^;&|]*\befuse-burn", "burning ESP32 eFuses is PERMANENT"),
    (r"\bespsecure(\.py)?\b|\bflash[-_]encryption\b|\bsecure[-_]boot\b", "secure boot / flash encryption can permanently lock the chip"),
    (r"\bSTM32_Programmer_CLI\b[^;&|]*\b(-ob|-rdp)\b|\bRDP\s*=\s*(1|2|0xCC|0xBB)", "changing STM32 option bytes / RDP (level 2 is permanent)"),
    (r"\bopenocd\b[^;&|]*\b(stm32\w*x\s+lock|option_write|flash\s+protect)", "flash lock/option-byte write via OpenOCD"),
    (r"\bavrdude\b[^;&|]*-U\s*((l|h|e)?fuse|lock):w", "writing AVR fuses/lock bits can brick the chip"),
    (r"\bnrfjprog\b[^;&|]*--(recover|eraseall|rbp)|\bnrfutil\b[^;&|]*(recover|erase)", "Nordic recover/erase-all/readback protection"),
    (r"\b(st-flash|pyocd|probe-rs)\b[^;&|]*\b(erase|--chip-erase|mass-erase)\b|\bmass[_-]erase\b", "full chip erase"),
]


def emit(decision, reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": decision,
        "permissionDecisionReason": reason,
    }}))
    sys.exit(0)


for pat, label in DANGEROUS:
    if re.search(pat, cmd, re.I):
        emit("ask", f"[embedded guard] {label}. Confirm this is intended for the connected device.")

if not bounded:
    for pat, label in MONITORS:
        if re.search(pat, cmd):
            emit("deny", f"[embedded guard] `{label}` is interactive and will hang this session. "
                 "Use `serial-tail <port> -b <baud> -t <seconds> [--until REGEX] [--reset]` to capture output, "
                 "or wrap the command in `timeout <seconds> ...`.")
sys.exit(0)
