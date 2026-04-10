# GA Engine — File Summary & Next-Prompt Handoff

## Generated Files

```
ga_engine/
├── structures.py      ← data containers + bitmask timetable engine
├── constraints.py     ← hard pass + NT1-NT4 + soft decoder
├── genetic.py         ← population init, crossover, mutation, evolve loop
└── scheduler.py       ← single public generate() entry point
```

---

## File-by-File Summary

### `structures.py`
**What it contains**
- `Teacher`, `Subject`, `Room`, `Class`, `Break` — pure dataclasses
- `LessonBlock` — the atomic gene carrier (supports co-teaching, merged classes, split rooms, double/triple periods, locked pinning via `locked_day`/`locked_period`)
- `Timetable` — the chromosome; bitmask occupancy masks per teacher/room/class; `assign()`, `unassign()`, `is_slot_free()`, `copy()`
- `LockedLessonBuilder` — fluent admin API for pinned lessons
- Slot math helpers: `slot_index`, `block_bitmask`, `make_break_mask`, `make_multi_break_mask`, `count_gaps_in_day`

**Key design choices retained from original code**
- Bitmask collision detection — `teacher_mask[tid] & slot_mask != 0` is O(1)
- `Timetable.fitness = None` cache-invalidation on any `assign()` call
- `copy()` method for elitism (no external dict copying)
- `locked_day` / `locked_period` fields replace the old `TimeSlot` object (simpler, JSON-friendly)

---

### `constraints.py`
**What it contains**
- `decode_constraint_mask(n)` — decodes 12-bit integer into named dict; called **once** at init
- `ConstraintChecker` — stateless after `__init__`; three-method evaluation:
  - `_hard_pass()` — O(n) single scan; 9 hard constraints
  - `_nt_pass()` — NT1–NT4 always-on soft constraints
  - `_soft_pass()` — 12-bit toggleable constraints; skipped entirely if `constraint_mask=0`
  - `get_violation_summary()` — unweighted counts per constraint; called **once** on best result

**Hard constraints (always active)**
| Key | Weight |
|---|---:|
| unassigned | 15 000 |
| locked_violation | 50 000 |
| break_violation | 20 000 |
| teacher_conflict | 10 000 |
| room_conflict | 10 000 |
| class_conflict | 10 000 |
| teacher_unavailable | 10 000 |
| room_unavailable | 10 000 |
| two_labs_same_day | 25 000 |

**Non-toggleable soft (NT1–NT4)**
| Code | Weight | Rule |
|---|---:|---|
| NT1 | 100 | Every active class needs a lesson in period 0 |
| NT2 | 100 | No teacher has a fully empty day |
| NT3 | 80 | No free-period gaps in a class's day |
| NT4 | 60 | No 3+ consecutive blocks for a teacher |

**Toggleable (12-bit mask)**
See `soft_constraint_map.md` for full bit layout. Standard weight = 10, bit 11 = 2.

---

### `genetic.py`
**What it contains**
- `GeneticScheduler` class — full GA engine
- `DEFAULT_PARAMS` dict — all tunable parameters with sensible defaults

**Population init — three strategies** (from AI best-practices doc)
- 30% DSATUR greedy (most-constrained block first, min-conflict slot)
- 40% greedy-random with shuffled block order
- 30% pure-random (structural validity only)

**Three crossover operators with adaptive selection**
| Operator | Default prob | Behaviour |
|---|---:|---|
| `block_group` | 60% | Split classes between parents; preserves class coherence |
| `day_preserving` | 25% | Each day taken entirely from one parent |
| `uniform` | 15% | Each gene independently from either parent |

**Three mutation operators with adaptive selection**
| Operator | Default prob | Behaviour |
|---|---:|---|
| `move` | 60% | Random new slot for one block (20 attempts) |
| `swap` | 25% | Swap slots between two equal-duration blocks |
| `day_swap` | 15% | Swap day only; keep time-of-day |

**Adaptive controls**
- Mutation rate: increases (×1.15) when stagnating >10 gens; decays (×0.95) otherwise; clamped to [base, 0.65]
- Operator probabilities: credit-based adaptation every 20 gens using fitness improvement as credit; epsilon=0.01 prevents zero-probability operators

**Fitness caching**
- `Timetable.fitness` is cached on the object itself
- Invalidated by `Timetable.assign()` and `Timetable.unassign()`
- No external hash-map cache (avoids memory bloat from original AI version)

**Termination**
- `fitness == 0` (perfect)
- `max_generations` reached (default 250)
- `stagnation_limit` reached (default 60 gens without improvement)

---

### `scheduler.py`
**What it contains**
- `GenerateResult` dataclass — fully serialisable result
- `_run_preflight()` — 9 checks (P1–P9) before GA starts
- `_build_warnings()` — non-fatal warnings (utilisation >85%)
- `generate()` — single entry point
- `build_break_mask()`, `build_multi_break_mask()`, `decode_mask()` — convenience re-exports

**`generate()` full signature**
```python
def generate(
    teachers:        Dict[str, Teacher],
    subjects:        Dict[str, Subject],
    rooms:           Dict[str, Room],
    classes:         Dict[str, Class],
    blocks:          List[LessonBlock],
    days:            int = 5,
    periods_per_day: int = 8,
    break_periods:   Optional[List[int]] = None,   # simplest break config
    break_mask:      int = 0,                       # pre-built mask alternative
    constraint_mask: int = 0,                       # 0-4095, see bit map
    ga_params:       Optional[Dict] = None,
    seed:            Optional[int] = None,
    skip_preflight:  bool = False,
) -> GenerateResult
```

**`GenerateResult` fields**
| Field | Type | Description |
|---|---|---|
| `timetable` | `Timetable` | Best chromosome |
| `fitness` | `int` | Final total penalty |
| `hard_violations` | `int` | Count of hard violations |
| `soft_violations` | `int` | Count of soft violations |
| `is_feasible` | `bool` | `hard_violations == 0` |
| `violation_detail` | `dict` | Per-constraint counts |
| `fitness_history` | `list[int]` | Best fitness per generation |
| `genes_export` | `dict` | `{block_id: {day, period, ...}}` — JSON-ready |
| `elapsed_seconds` | `float` | Wall-clock time |
| `generations_run` | `int` | Actual generations completed |
| `warnings` | `list[str]` | Non-fatal notices |

---

## What the Backend Needs to Do

The backend (FastAPI route) must:

1. **Query DB** — fetch Institution, Teachers, Classrooms, Subjects, Rooms, LessonBlocks for the requested `institution_id` (and optional `mini_group_id`).

2. **Map ORM → dataclasses** — convert SQLAlchemy models into `structures.py` dataclasses:
   - `Teacher.availability` from DB `BigInt` → pass directly
   - `LessonBlock` — populate `locked_day`, `locked_period` from DB `locked_day`/`locked_period` columns
   - `LessonBlock.is_lab` and `is_difficult` should be denormalised on the block (already in DB model)

3. **Call `generate()`**:
```python
from scheduler import generate, build_break_mask

result = generate(
    teachers        = teachers_dict,    # {id: Teacher}
    subjects        = subjects_dict,
    rooms           = rooms_dict,
    classes         = classes_dict,
    blocks          = blocks_list,
    days            = institution.days_per_week,
    periods_per_day = institution.periods_per_day,
    break_periods   = [institution.break_after_period],  # or pass break_mask
    constraint_mask = constraint_settings.mask_integer,  # from DB
    ga_params       = None,             # use defaults
    seed            = None,
)
```

4. **Handle `PreflightError`** — return HTTP 422 with `result.errors` list.

5. **Serialise and return**:
```python
return {
    "fitness":           result.fitness,
    "is_feasible":       result.is_feasible,
    "hard_violations":   result.hard_violations,
    "soft_violations":   result.soft_violations,
    "violation_detail":  result.violation_detail,
    "genes":             result.genes_export,      # {block_id: {day, period, ...}}
    "fitness_history":   result.fitness_history,
    "elapsed_seconds":   result.elapsed_seconds,
    "generations_run":   result.generations_run,
    "warnings":          result.warnings,
}
```

6. **Persist** — store `genes_export` as `timetable_json` in `generated_timetables`.

---

## What Is NOT in These Files (Next Steps)

The following are intentionally outside this GA engine package:

| Component | Where it lives | Notes |
|---|---|---|
| FastAPI routes | `backend/routers/` | Calls `generate()` |
| SQLAlchemy models | `backend/models.py` | Already designed (see earlier session) |
| ORM → dataclass mapper | `backend/services/ga_runner.py` | Converts DB objects → structures |
| PDF export | `backend/services/pdf_export.py` | Reads `genes_export` |
| Drag-and-drop swap validator | `backend/services/swap_validator.py` | Calls `Timetable.is_slot_free()` |
| Timetable grid serialiser | `backend/services/timetable_view.py` | Builds teacher/class/room views |
| Mini-group logic | `backend/routers/groups.py` | Calls `generate()` per group |
| Auth (JWT) | `backend/auth.py` | Unchanged from existing system |

---

## ga_params Keys (for frontend advanced settings)

Pass any subset as `ga_params` dict to `generate()`:

```python
{
    "population_size":         80,   # individuals per generation
    "max_generations":        250,   # hard generation cap
    "elite_size":               8,   # top individuals carried over unchanged
    "tournament_size":          4,   # GA selection pressure
    "base_mutation_rate":    0.30,   # default mutation probability
    "max_mutation_rate":     0.65,   # cap during stagnation
    "stagnation_threshold":    10,   # gens before mutation heating
    "stagnation_limit":        60,   # hard stop on stagnation
    "max_placement_attempts":  60,   # attempts per block at init
}
```

---

## Constraint Mask Quick Reference

```
Bit:  11   10    9    8    7    6    5    4    3    2    1    0
      AVD  FPD  [SUBJ_DIST]  DIF  MAX  FRI  MON  [LAB_TIME]  [TGAP]
```

| Preset | Integer | Active |
|---|---:|---|
| Hard + NT only | `0` | Nothing toggleable |
| Standard | `129` | Teacher-gap minimize + difficult-morning |
| Lab-heavy | `52` | Lab end-of-day + avoid Mon/Fri |
| Full | `4095` | All constraints |

---

*Four files. One `generate()` call. Everything else is backend plumbing.*
