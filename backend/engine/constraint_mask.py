# -*- coding: utf-8 -*-
"""
constraint_mask.py — Encode/Decode ConstraintSettings to/from a single integer
================================================================================
Packs all 12 soft-constraint toggles, 4-level intensity weights, and two tuning
parameters into a compact 41-bit integer.  Import and use independently of the
GA loop — zero per-generation overhead.

Bit layout (41 bits total, fits in int64):
    Bits  0–11  : on/off flags       — 1 bit per constraint (S1…S11, lab)
    Bits 12–35  : intensity level    — 2 bits per constraint (same order)
    Bits 36–37  : max_consecutive_periods
    Bits 38–39  : last_day_gap_days
    Bit  40     : reserved (always 0)
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ga_fitness import ConstraintSettings


# ──────────────────────────────────────────────────────────────────────────────
# Hardcoded Weight Table
# ──────────────────────────────────────────────────────────────────────────────
# INTENSITY_WEIGHTS[level][constraint_index]
# Constraint index order: S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, avoid_morning_lab

INTENSITY_WEIGHTS: list[list[float]] = [
    #  S1   S2   S3   S4   S5   S6   S7   S8   S9  S10   S11  lab
    [0.3, 0.2, 0.2, 0.5, 0.2, 0.3, 0.5, 0.3, 0.2, 0.5,  0.8, 0.2],  # 00 minimal
    [1.0, 0.8, 0.7, 2.0, 0.5, 1.2, 1.5, 1.0, 0.8, 2.0,  3.0, 0.5],  # 01 medium
    [2.0, 1.5, 1.5, 4.0, 1.0, 2.5, 2.5, 2.0, 1.5, 4.0,  6.0, 1.0],  # 10 hard
    [4.0, 3.0, 3.0, 8.0, 2.0, 5.0, 4.0, 4.0, 3.0, 8.0, 12.0, 2.0],  # 11 very strict
]

LEVEL_NAMES = ["minimal", "medium", "hard", "very strict"]

_FIELDS_ON = [
    "S1", "S2", "S3", "S4", "S5", "S6",
    "S7", "S8", "S9", "S10", "S11", "avoid_morning_lab",
]
_FIELDS_W = [
    "S1_weight", "S2_weight", "S3_weight", "S4_weight",
    "S5_weight", "S6_weight", "S7_weight", "S8_weight",
    "S9_weight", "S10_weight", "S11_weight", "avoid_morning_lab_weight",
]

_MCP_VALUES = [2, 3, 4, 5]   # max_consecutive_periods lookup
_LDG_VALUES = [0, 1, 2, 3]   # last_day_gap_days lookup


# ──────────────────────────────────────────────────────────────────────────────
# Named Presets
# ──────────────────────────────────────────────────────────────────────────────

PRESETS: dict[str, dict] = {
    "default": {
        "on":        [True, True, True, True, True, True, True, True, True, True, True, False],
        "intensity": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        "mcp": 1,  # 3 periods
        "ldg": 1,  # 1 day
    },
    "strict": {
        "on":        [True] * 12,
        "intensity": [3] * 12,
        "mcp": 0,  # 2 periods
        "ldg": 1,
    },
    "soft_off": {
        "on":        [False] * 12,
        "intensity": [1] * 12,
        "mcp": 1,
        "ldg": 1,
    },
    "gap_heavy": {
        "on":        [True, True, True, True, True, True, True, True, True, True, True, False],
        "intensity": [1, 1, 1, 3, 1, 1, 3, 3, 1, 2, 3, 1],
        "mcp": 1,
        "ldg": 1,
    },
}


# ──────────────────────────────────────────────────────────────────────────────
# Encode
# ──────────────────────────────────────────────────────────────────────────────

def encode_constraint_mask(cs: "ConstraintSettings") -> int:
    """
    Pack a ConstraintSettings into a 41-bit integer.

    Encoding steps:
      1. Bits 0–11: set bit i if the i-th constraint is enabled.
      2. Bits 12–35: for each constraint, find the intensity level whose
         hardcoded weight is closest to cs.*_weight, write the 2-bit level.
      3. Bits 36–37: encode max_consecutive_periods (snap to nearest in [2,3,4,5]).
      4. Bits 38–39: encode last_day_gap_days (snap to nearest in [0,1,2,3]).
    """
    flags   = [getattr(cs, f) for f in _FIELDS_ON]
    weights = [getattr(cs, f) for f in _FIELDS_W]

    n = 0

    # Bits 0–11: on/off flags
    for i, flag in enumerate(flags):
        if flag:
            n |= (1 << i)

    # Bits 12–35: intensity levels (2 bits each)
    for i, w in enumerate(weights):
        col   = [INTENSITY_WEIGHTS[lvl][i] for lvl in range(4)]
        level = min(range(4), key=lambda lvl: abs(col[lvl] - w))
        n |= (level << (12 + i * 2))

    # Bits 36–37: max_consecutive_periods
    mcp_idx = min(range(4), key=lambda j: abs(_MCP_VALUES[j] - cs.max_consecutive_periods))
    n |= (mcp_idx << 36)

    # Bits 38–39: last_day_gap_days
    ldg_idx = min(range(4), key=lambda j: abs(_LDG_VALUES[j] - cs.last_day_gap_days))
    n |= (ldg_idx << 38)

    return n


# ──────────────────────────────────────────────────────────────────────────────
# Decode
# ──────────────────────────────────────────────────────────────────────────────

def decode_constraint_mask(n: int) -> "ConstraintSettings":
    """
    Reconstruct a ConstraintSettings from a 41-bit integer.

    Weights are always set to the exact hardcoded INTENSITY_WEIGHTS value —
    never interpolated. This guarantees round-trip stability.
    """
    from ga_fitness import ConstraintSettings

    cs = ConstraintSettings()

    for i, (f_on, f_w) in enumerate(zip(_FIELDS_ON, _FIELDS_W)):
        setattr(cs, f_on, bool((n >> i) & 1))
        level = (n >> (12 + i * 2)) & 0b11
        setattr(cs, f_w, INTENSITY_WEIGHTS[level][i])

    cs.max_consecutive_periods = _MCP_VALUES[(n >> 36) & 0b11]
    cs.last_day_gap_days       = _LDG_VALUES[(n >> 38) & 0b11]

    return cs


# ──────────────────────────────────────────────────────────────────────────────
# Describe (human-readable)
# ──────────────────────────────────────────────────────────────────────────────

def describe_constraint_mask(n: int) -> str:
    """
    Return a human-readable summary string for logging or UI display.

    Example output:
        Constraint mask: 274952534207 (0x3FFFFFEABFF)
          S1    ON   medium       weight=1.0
          S2    ON   medium       weight=0.8
          ...
          max_consecutive = 3
          last_day_gap_days = 1
    """
    lines = [f"Constraint mask: {n} (0x{n:X})"]
    for i, f in enumerate(_FIELDS_ON):
        on    = bool((n >> i) & 1)
        level = (n >> (12 + i * 2)) & 0b11
        w     = INTENSITY_WEIGHTS[level][i]
        lines.append(
            f"  {f:22s}  {'ON ' if on else 'OFF'}  "
            f"{LEVEL_NAMES[level]:12s}  weight={w}"
        )
    lines.append(f"  max_consecutive_periods = {_MCP_VALUES[(n >> 36) & 0b11]}")
    lines.append(f"  last_day_gap_days       = {_LDG_VALUES[(n >> 38) & 0b11]}")
    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# Preset → Mask
# ──────────────────────────────────────────────────────────────────────────────

def mask_from_preset(name: str) -> int:
    """
    Return the encoded integer for a named preset.

    Available presets: 'default', 'strict', 'soft_off', 'gap_heavy'
    """
    from ga_fitness import ConstraintSettings

    if name not in PRESETS:
        raise ValueError(f"Unknown preset '{name}'. Choose from: {list(PRESETS)}")

    p  = PRESETS[name]
    cs = ConstraintSettings()
    for i, (f_on, f_w) in enumerate(zip(_FIELDS_ON, _FIELDS_W)):
        setattr(cs, f_on, p["on"][i])
        setattr(cs, f_w,  INTENSITY_WEIGHTS[p["intensity"][i]][i])
    cs.max_consecutive_periods = _MCP_VALUES[p["mcp"]]
    cs.last_day_gap_days       = _LDG_VALUES[p["ldg"]]
    return encode_constraint_mask(cs)
