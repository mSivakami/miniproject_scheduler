# Constraint Mask Encoding — `ga_fitness` Soft Constraints

> **Purpose**: This document teaches Claude Code how to encode and decode all soft constraint settings for the timetable genetic algorithm into a single integer. It covers the bit layout, intensity levels, hardcoded weight tables, and the full Python implementation.

---

## Overview

`ConstraintSettings` controls which soft constraints are active and how strongly they are penalised during fitness evaluation. To make these settings shareable as a compact token, the entire configuration is packed into a **41-bit integer**.

A user can copy one number (e.g. `274952534207`) and another instance of the scheduler will reconstruct the exact same constraint configuration.

---

## Soft Constraints Reference

| ID | Field name | Description |
|----|-----------|-------------|
| S1 | `S1`, `S1_weight` | Teacher daily load ≤ max_per_day |
| S2 | `S2`, `S2_weight` | Difficult subjects not in last period |
| S3 | `S3`, `S3_weight` | Same subject not twice same day (per class) |
| S4 | `S4`, `S4_weight` | No gaps in class daily schedule (quadratic penalty) |
| S5 | `S5`, `S5_weight` | Teacher max consecutive periods |
| S6 | `S6`, `S6_weight` | Subject distribution across week |
| S7 | `S7`, `S7_weight` | No isolated single-period gaps in teacher schedule |
| S8 | `S8`, `S8_weight` | No consecutive distinct blocks for a teacher |
| S9 | `S9`, `S9_weight` | Pack lessons Mon–Thu; leave last day(s) light |
| S10 | `S10`, `S10_weight` | Max 1 lab per class per day |
| S11 | `S11`, `S11_weight` | First period must not be empty if classes are scheduled |
| lab | `avoid_morning_lab`, `avoid_morning_lab_weight` | Avoid scheduling labs in early morning |

---

## Bit Layout (41 bits total, fits in `int64`)

```
Bits  0–11  : on/off flags       — 1 bit per constraint (S1…S11, lab)
Bits 12–35  : intensity level    — 2 bits per constraint (same order)
Bits 36–37  : max_consecutive_periods
Bits 38–39  : last_day_gap_days
Bit  40     : reserved (always 0)
```

### On/off flags (bits 0–11)

| Bit | Constraint |
|-----|-----------|
| 0 | S1 |
| 1 | S2 |
| 2 | S3 |
| 3 | S4 |
| 4 | S5 |
| 5 | S6 |
| 6 | S7 |
| 7 | S8 |
| 8 | S9 |
| 9 | S10 |
| 10 | S11 |
| 11 | avoid_morning_lab |

### Intensity levels (bits 12–35, 2 bits per constraint)

Each constraint's weight is not stored as a raw float. Instead it is quantised into one of four named intensity levels:

| Bits | Level name | Description |
|------|-----------|-------------|
| `00` | minimal | Almost ignored; only a gentle nudge |
| `01` | medium | Default balanced penalty |
| `10` | hard | Strongly discouraged |
| `11` | very strict | Near-mandatory; heavily penalised |

Intensity bit positions:

| Bits | Constraint |
|------|-----------|
| 12–13 | S1 |
| 14–15 | S2 |
| 16–17 | S3 |
| 18–19 | S4 |
| 20–21 | S5 |
| 22–23 | S6 |
| 24–25 | S7 |
| 26–27 | S8 |
| 28–29 | S9 |
| 30–31 | S10 |
| 32–33 | S11 |
| 34–35 | avoid_morning_lab |

### Tuning parameters (bits 36–39)

| Bits | Parameter | `00` | `01` | `10` | `11` |
|------|----------|------|------|------|------|
| 36–37 | `max_consecutive_periods` | 2 | 3 | 4 | 5 |
| 38–39 | `last_day_gap_days` | 0 | 1 | 2 | 3 |

---

## Hardcoded Weight Table

Each intensity level maps to a fixed float weight per constraint. These are the **only** valid weight values — never interpolate between them.

```python
# INTENSITY_WEIGHTS[level][constraint_index]
# Constraint index order: S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, avoid_morning_lab

INTENSITY_WEIGHTS: list[list[float]] = [
    #  S1   S2   S3   S4   S5   S6   S7   S8   S9  S10   S11  lab
    [0.3, 0.2, 0.2, 0.5, 0.2, 0.3, 0.1, 0.3, 0.2, 0.5,  0.8, 0.2],  # 00 minimal
    [1.0, 0.8, 0.7, 2.0, 0.5, 1.2, 0.3, 1.0, 0.8, 2.0,  3.0, 0.5],  # 01 medium
    [2.0, 1.5, 1.5, 4.0, 1.0, 2.5, 0.7, 2.0, 1.5, 4.0,  6.0, 1.0],  # 10 hard
    [4.0, 3.0, 3.0, 8.0, 2.0, 5.0, 1.5, 4.0, 3.0, 8.0, 12.0, 2.0],  # 11 very strict
]
```

**Rule**: `decode_constraint_mask` always writes the exact value from this table. It never stores or reconstructs arbitrary floats. `encode_constraint_mask` snaps any existing float weight to the nearest level in this table.

---

## Named Presets

These presets cover the most common use cases and are the recommended starting points:

| Preset name | Description | Typical use |
|-------------|-------------|-------------|
| `default` | All S1–S11 on at medium; S7/lab off | General-purpose scheduling |
| `strict` | All constraints on at very strict | Exam/final timetables |
| `soft_off` | All soft constraints off | Hard-constraint debugging only |
| `gap_heavy` | S4/S7/S8/S11 at very strict; rest medium | Schools that penalise student free periods heavily |

```python
PRESETS: dict[str, dict] = {
    "default": {
        "on":        [True,True,True,True,True,True,False,True,True,True,True,False],
        "intensity": [1,   1,   1,   1,   1,   1,   1,   1,  1,   1,   1,  1   ],
        "mcp": 1,  # 3 periods
        "ldg": 1,  # 1 day
    },
    "strict": {
        "on":        [True]*12,
        "intensity": [3]*12,
        "mcp": 0,  # 2 periods
        "ldg": 1,
    },
    "soft_off": {
        "on":        [False]*12,
        "intensity": [1]*12,
        "mcp": 1,
        "ldg": 1,
    },
    "gap_heavy": {
        "on":        [True,True,True,True,True,True,True,True,True,True,True,False],
        "intensity": [1,   1,   1,   3,   1,   1,   3,   3,  1,   2,   3,  1   ],
        "mcp": 1,
        "ldg": 1,
    },
}
```

---

## Full Python Implementation

Place this in a new file `constraint_mask.py` alongside `ga_fitness.py`.

```python
# constraint_mask.py
# Encode/decode ConstraintSettings to/from a single integer.
# Import and use independently of the GA loop — zero per-generation overhead.

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ga_fitness import ConstraintSettings

INTENSITY_WEIGHTS: list[list[float]] = [
    [0.3, 0.2, 0.2, 0.5, 0.2, 0.3, 0.1, 0.3, 0.2, 0.5,  0.8, 0.2],
    [1.0, 0.8, 0.7, 2.0, 0.5, 1.2, 0.3, 1.0, 0.8, 2.0,  3.0, 0.5],
    [2.0, 1.5, 1.5, 4.0, 1.0, 2.5, 0.7, 2.0, 1.5, 4.0,  6.0, 1.0],
    [4.0, 3.0, 3.0, 8.0, 2.0, 5.0, 1.5, 4.0, 3.0, 8.0, 12.0, 2.0],
]

LEVEL_NAMES = ["minimal", "medium", "hard", "very strict"]

_FIELDS_ON = [
    "S1","S2","S3","S4","S5","S6",
    "S7","S8","S9","S10","S11","avoid_morning_lab",
]
_FIELDS_W = [
    "S1_weight","S2_weight","S3_weight","S4_weight",
    "S5_weight","S6_weight","S7_weight","S8_weight",
    "S9_weight","S10_weight","S11_weight","avoid_morning_lab_weight",
]

_MCP_VALUES = [2, 3, 4, 5]   # max_consecutive_periods lookup
_LDG_VALUES = [0, 1, 2, 3]   # last_day_gap_days lookup


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

    for i, flag in enumerate(flags):
        if flag:
            n |= (1 << i)

    for i, w in enumerate(weights):
        col   = [INTENSITY_WEIGHTS[lvl][i] for lvl in range(4)]
        level = min(range(4), key=lambda lvl: abs(col[lvl] - w))
        n |= (level << (12 + i * 2))

    mcp_idx = min(range(4), key=lambda j: abs(_MCP_VALUES[j] - cs.max_consecutive_periods))
    ldg_idx = min(range(4), key=lambda j: abs(_LDG_VALUES[j] - cs.last_day_gap_days))
    n |= (mcp_idx << 36)
    n |= (ldg_idx << 38)

    return n


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


def mask_from_preset(name: str) -> int:
    """
    Return the encoded integer for a named preset.

    Available presets: 'default', 'strict', 'soft_off', 'gap_heavy'
    """
    from ga_fitness import ConstraintSettings

    PRESETS = {
        "default":  {"on":[True,True,True,True,True,True,False,True,True,True,True,False], "intensity":[1]*12, "mcp":1,"ldg":1},
        "strict":   {"on":[True]*12,  "intensity":[3]*12, "mcp":0,"ldg":1},
        "soft_off": {"on":[False]*12, "intensity":[1]*12, "mcp":1,"ldg":1},
        "gap_heavy":{"on":[True,True,True,True,True,True,True,True,True,True,True,False],"intensity":[1,1,1,3,1,1,3,3,1,2,3,1],"mcp":1,"ldg":1},
    }

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
```

---

## Usage Examples

```python
from constraint_mask import (
    encode_constraint_mask,
    decode_constraint_mask,
    describe_constraint_mask,
    mask_from_preset,
)
from ga_fitness import ConstraintSettings

# 1. Encode an existing ConstraintSettings
cs = ConstraintSettings()
token = encode_constraint_mask(cs)
print(token)                          # e.g. 274952534207

# 2. Decode back
cs2 = decode_constraint_mask(token)
assert cs2.S4_weight == 2.0           # exact hardcoded value, no float drift

# 3. Human-readable log
print(describe_constraint_mask(token))

# 4. Use a named preset
token = mask_from_preset("gap_heavy")
cs    = decode_constraint_mask(token)

# 5. Share between users — just pass the integer
# User A sends: 274952534207
# User B does:
cs = decode_constraint_mask(274952534207)
```

---

## Rules Claude Code Must Follow

1. **Never store raw floats in the mask.** Always snap to the nearest `INTENSITY_WEIGHTS` level during encode.
2. **Never interpolate weights during decode.** Always write the exact value from `INTENSITY_WEIGHTS[level][i]`.
3. **The column order in `INTENSITY_WEIGHTS` is fixed**: S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, avoid_morning_lab. Do not reorder.
4. **Bit 40 is reserved.** Do not use it. Mask with `& 0xFF_FFFF_FFFF` if needed to stay within 40 active bits.
5. **`decode_constraint_mask` must import `ConstraintSettings` lazily** (inside the function) to avoid circular imports with `ga_fitness.py`.
6. **`encode_constraint_mask` is lossless for preset values.** If a weight does not match any level exactly, it snaps to the nearest — this is expected and acceptable.
7. **`mask_from_preset` is the canonical way to produce tokens for the four named presets.** Do not hardcode preset integers as magic numbers elsewhere in the codebase.
8. **Adding a new soft constraint** requires: adding a row entry to `INTENSITY_WEIGHTS` (all four levels), adding the field names to `_FIELDS_ON` and `_FIELDS_W`, and incrementing the bit positions of `max_consecutive_periods` (bits 36–37) and `last_day_gap_days` (bits 38–39) accordingly.
