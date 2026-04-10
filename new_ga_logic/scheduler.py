"""
scheduler.py
============
Single public entry point for the GA backend.

The backend calls generate() with all scheduling data packed into one call.
Nothing else in this package needs to be imported by the backend.

Typical call:
    from scheduler import generate, make_break_mask
    from structures import Teacher, Subject, Room, Class, LessonBlock, Break

    result = generate(
        teachers        = teachers_dict,
        subjects        = subjects_dict,
        rooms           = rooms_dict,
        classes         = classes_dict,
        blocks          = lesson_blocks_list,
        days            = 5,
        periods_per_day = 8,
        break_periods   = [3],          # period 3 blocked every day
        constraint_mask = 0b10000101,   # teacher-gap + difficult-morning
        ga_params       = {"population_size": 100},
        seed            = 42,
    )
"""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Union

from structures import (
    Teacher, Subject, Room, Class, LessonBlock,
    Timetable, Break,
    make_break_mask, make_multi_break_mask,
    decode_daily_masks,
    block_bitmask,
)
from constraints import ConstraintChecker, decode_constraint_mask
from genetic import GeneticScheduler


# ─────────────────────────────────────────────────────────────────────────────
# RESULT TYPE
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class GenerateResult:
    """
    Returned by generate(). Fully serialisable: genes dict and
    violation_detail are both plain Python dicts of primitives.
    """
    # The best timetable found
    timetable:        Timetable

    # Scalar quality metrics
    fitness:          int
    hard_violations:  int
    soft_violations:  int
    is_feasible:      bool           # True if hard_violations == 0

    # Detailed per-constraint violation counts (unweighted)
    violation_detail: Dict[str, int]

    # GA convergence history
    fitness_history:  List[int]

    # Flat gene dict for easy JSON serialisation
    # { block_id: {"day": int, "period": int} }
    genes_export:     Dict[str, dict]

    elapsed_seconds:  float
    generations_run:  int
    warnings:         List[str] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# PRE-FLIGHT VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

class PreflightError(ValueError):
    """Raised when the scheduling configuration is provably infeasible."""
    def __init__(self, errors: List[str]):
        self.errors = errors
        super().__init__("\n".join(errors))


def _run_preflight(
    teachers:        Dict[str, Teacher],
    subjects:        Dict[str, Subject],
    rooms:           Dict[str, Room],
    classes:         Dict[str, Class],
    blocks:          List[LessonBlock],
    days:            int,
    ppd:             int,
    break_mask:      int,
    constraint_mask: int,
) -> List[str]:
    """
    Returns a list of error strings. Empty list = all checks passed.
    Checks:
        P1  days × ppd ≤ 64  (bitmask limit)
        P2  constraint_mask ∈ [0, 4095]
        P3  No duplicate block IDs
        P4  Every locked block has locked_day and locked_period set
        P5  Locked block slot within valid range
        P6  Locked block does not fall on a break
        P7  Locked block conflicts (teacher, room, class) between each other
        P8  Total lesson-period demand vs available working slots
        P9  Double/triple block: start + duration ≤ ppd
    Warnings (non-fatal) added to result.warnings separately.
    """
    errors: List[str] = []

    # P1
    total_slots = days * ppd
    if total_slots > 64:
        errors.append(
            f"P1: days×periods_per_day ({total_slots}) exceeds 64-slot bitmask limit."
        )

    # P2
    if not (0 <= constraint_mask <= 4095):
        errors.append(f"P2: constraint_mask {constraint_mask} out of range [0, 4095].")

    # P3
    seen_ids: set = set()
    for b in blocks:
        if b.id in seen_ids:
            errors.append(f"P3: Duplicate block id '{b.id}'.")
        seen_ids.add(b.id)

    # P4 / P5 / P6
    locked_teacher_occ: Dict[str, int] = defaultdict(int)
    locked_room_occ:    Dict[str, int] = defaultdict(int)
    locked_class_occ:   Dict[str, int] = defaultdict(int)

    for b in blocks:
        if not b.is_locked:
            continue
        if b.locked_day is None or b.locked_period is None:
            errors.append(f"P4: Block '{b.id}' is_locked but has no locked_day/locked_period.")
            continue
        day, period = b.locked_day, b.locked_period
        if day < 0 or day >= days:
            errors.append(f"P5: Block '{b.id}' locked_day={day} out of range [0, {days-1}].")
        if period < 0 or period + b.duration > ppd:
            errors.append(
                f"P5: Block '{b.id}' locked_period={period} + duration={b.duration} "
                f"exceeds periods_per_day={ppd}."
            )
        # P6 break collision
        for p in range(period, period + b.duration):
            idx = day * ppd + p
            if break_mask & (1 << idx):
                errors.append(f"P6: Block '{b.id}' locked at day={day} period={p} which is a break slot.")

        # P7 locked conflicts
        mask = block_bitmask(day * ppd + period, b.duration)
        for tid in b.teacher_ids:
            if locked_teacher_occ[tid] & mask:
                errors.append(f"P7: Teacher '{tid}' double-booked among locked lessons.")
            locked_teacher_occ[tid] |= mask
        for rid in b.room_ids:
            if locked_room_occ[rid] & mask:
                errors.append(f"P7: Room '{rid}' double-booked among locked lessons.")
            locked_room_occ[rid] |= mask
        for cid in b.class_ids:
            if locked_class_occ[cid] & mask:
                errors.append(f"P7: Class '{cid}' double-booked among locked lessons.")
            locked_class_occ[cid] |= mask

    # P8 capacity check (per class)
    # Count available working slots per day
    working_slots_per_day = 0
    for p in range(ppd):
        # Check period 0, day 0 as representative
        if not (break_mask & (1 << p)):
            working_slots_per_day += 1
    total_working = working_slots_per_day * days

    class_demand: Dict[str, int] = defaultdict(int)
    for b in blocks:
        for cid in b.class_ids:
            class_demand[cid] += b.duration

    for cid, demand in class_demand.items():
        if demand > total_working:
            errors.append(
                f"P8: Class '{cid}' requires {demand} periods but only "
                f"{total_working} working slots available."
            )
        elif demand > total_working * 0.95:
            # Near-impossible — warn but don't error
            pass   # Will surface in warnings

    # P9 double/triple blocks fit within a day
    for b in blocks:
        if b.duration > ppd:
            errors.append(
                f"P9: Block '{b.id}' duration={b.duration} exceeds periods_per_day={ppd}."
            )

    return errors


def _build_warnings(
    blocks: List[LessonBlock],
    days:   int,
    ppd:    int,
    break_mask: int,
) -> List[str]:
    """Non-fatal warnings returned in GenerateResult.warnings."""
    warnings: List[str] = []
    working_slots = sum(
        1 for p in range(ppd)
        if not (break_mask & (1 << p))
    ) * days

    class_demand: Dict[str, int] = defaultdict(int)
    for b in blocks:
        for cid in b.class_ids:
            class_demand[cid] += b.duration

    for cid, demand in class_demand.items():
        utilisation = demand / working_slots if working_slots else 0
        if utilisation > 0.85:
            warnings.append(
                f"Class '{cid}' utilisation is {utilisation*100:.0f}% "
                f"({demand}/{working_slots} slots). GA may struggle to place all lessons."
            )

    return warnings


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def generate(
    # ── scheduling entities ───────────────────────────────────────────────
    teachers:        Dict[str, Teacher],
    subjects:        Dict[str, Subject],
    rooms:           Dict[str, Room],
    classes:         Dict[str, Class],
    blocks:          List[LessonBlock],

    # ── timetable dimensions ──────────────────────────────────────────────
    days:            int = 5,
    periods_per_day: int = 7,

    # ── break configuration ───────────────────────────────────────────────
    # Pass EITHER break_periods (list of period indices blocked every day)
    # OR a pre-built break_mask integer.
    # break_periods takes priority when both are given.
    break_periods:   Optional[List[int]] = None,
    break_mask:      Optional[Union[int, List[int]]] = None,

    # ── soft constraint toggle (12-bit integer 0–4095) ────────────────────
    constraint_mask: int = 0,

    # ── optional GA tuning ────────────────────────────────────────────────
    # Pass any subset of keys from genetic.DEFAULT_PARAMS.
    ga_params:       Optional[Dict] = None,

    # ── reproducibility ──────────────────────────────────────────────────
    seed:            Optional[int] = None,

    # ── catch-all for dynamic backend unpacking ──────────────────────────
    **kwargs,
) -> GenerateResult:
    """
    The single public function the backend calls.

    Parameters
    ----------
    teachers        {id: Teacher}
    subjects        {id: Subject}
    rooms           {id: Room}
    classes         {id: Class}
    blocks          List[LessonBlock]  (locked + free)
    days            Number of school days per week (default 5)
    periods_per_day Number of periods per day (default 8)
    break_periods   [int, ...]  Period indices (0-based) that are breaks every day.
                    Simplest way to configure breaks.
    break_mask      Pre-built 64-bit integer break mask (overridden by break_periods).
    constraint_mask 12-bit integer encoding toggleable soft constraints.
                    0  = hard constraints + NT1–NT4 only (fastest).
                    4095 = all soft constraints active.
                    See soft_constraint_map.md for full bit layout.
    ga_params       Dict overriding any key in genetic.DEFAULT_PARAMS.
    seed            Random seed for reproducibility.
    skip_preflight  Skip pre-flight validation (testing only).

    Returns
    -------
    GenerateResult  Fully serialisable result object.

    Raises
    ------
    PreflightError  If the configuration is provably infeasible.
    ValueError      For out-of-range parameter values.
    """
    t_start = time.time()

    # ── Resolve break mask ───────────────────────────────────────────────
    resolved_break_mask = 0
    if break_periods:
        resolved_break_mask = make_multi_break_mask(break_periods, days, periods_per_day)
    elif break_mask is not None:
        if isinstance(break_mask, list):
            # Acceptance of integer mask as availability list
            resolved_break_mask = decode_daily_masks(break_mask, periods_per_day)
        else:
            resolved_break_mask = break_mask

    # Handle skip_preflight from kwargs
    skip_preflight = kwargs.get("skip_preflight", False)

    # ── Basic parameter validation ───────────────────────────────────────
    if not (1 <= days <= 7):
        raise ValueError(f"days must be in [1, 7]; got {days}.")
    if not (1 <= periods_per_day <= 12):
        raise ValueError(f"periods_per_day must be in [1, 12]; got {periods_per_day}.")
    if days * periods_per_day > 64:
        raise ValueError(
            f"days × periods_per_day = {days * periods_per_day} exceeds 64-slot bitmask limit."
        )
    if not (0 <= constraint_mask <= 4095):
        raise ValueError(f"constraint_mask must be in [0, 4095]; got {constraint_mask}.")
    if not blocks:
        return GenerateResult(
            timetable       = Timetable(days, periods_per_day, resolved_break_mask),
            fitness         = 0,
            hard_violations = 0,
            soft_violations = 0,
            is_feasible     = True,
            violation_detail= {},
            fitness_history = [],
            genes_export    = {},
            elapsed_seconds = time.time() - t_start,
            generations_run = 0,
            warnings        = ["No blocks to schedule."],
        )

    # ── Pre-flight validation ─────────────────────────────────────────────
    if not skip_preflight:
        errors = _run_preflight(
            teachers, subjects, rooms, classes, blocks,
            days, periods_per_day, resolved_break_mask, constraint_mask,
        )
        if errors:
            raise PreflightError(errors)

    warnings = _build_warnings(blocks, days, periods_per_day, resolved_break_mask)

    # ── Build constraint checker ─────────────────────────────────────────
    checker = ConstraintChecker(
        teachers        = teachers,
        subjects        = subjects,
        rooms           = rooms,
        classes         = classes,
        blocks          = blocks,
        break_mask      = resolved_break_mask,
        days            = days,
        periods_per_day = periods_per_day,
        constraint_mask = constraint_mask,
    )

    # ── Run GA ──────────────────────────────────────────────────────────
    ga = GeneticScheduler(
        teachers        = teachers,
        subjects        = subjects,
        rooms           = rooms,
        classes         = classes,
        blocks          = blocks,
        break_mask      = resolved_break_mask,
        days            = days,
        periods_per_day = periods_per_day,
        checker         = checker,
        params          = ga_params,
        seed            = seed,
    )

    best_tt, history = ga.evolve()

    # ── Final scoring ────────────────────────────────────────────────────
    final_fitness = checker.calculate_fitness(best_tt)
    violations    = checker.get_violation_summary(best_tt)

    hard_count = violations.get("_hard_violations", 0)
    soft_count = violations.get("_soft_violations", 0)

    # ── Build genes_export dict for JSON serialisation ───────────────────
    genes_export: Dict[str, dict] = {}
    for block in blocks:
        dp = best_tt.get_assignment(block.id)
        if dp:
            day, period = dp
            genes_export[block.id] = {
                "day":         day,
                "period":      period,
                "duration":    block.duration,
                "teacher_ids": block.teacher_ids,
                "subject_ids": block.subject_ids,
                "class_ids":   block.class_ids,
                "room_ids":    block.room_ids,
                "subject_name": block.subject_name,
                "is_locked":   block.is_locked,
                "is_lab":      block.is_lab,
            }
        else:
            genes_export[block.id] = None   # unassigned

    elapsed = time.time() - t_start
    print(f"  [scheduler] Total time: {elapsed:.1f}s | fitness: {final_fitness:,}", flush=True)

    return GenerateResult(
        timetable       = best_tt,
        fitness         = final_fitness,
        hard_violations = hard_count,
        soft_violations = soft_count,
        is_feasible     = (hard_count == 0),
        violation_detail= violations,
        fitness_history = history,
        genes_export    = genes_export,
        elapsed_seconds = elapsed,
        generations_run = len(history),
        warnings        = warnings,
    )


# ─────────────────────────────────────────────────────────────────────────────
# CONVENIENCE BREAK MASK BUILDERS  (re-exported for backend convenience)
# ─────────────────────────────────────────────────────────────────────────────

def build_break_mask(period: int, days: int, ppd: int) -> int:
    """Block one period index every day."""
    return make_break_mask(period, days, ppd)

def build_multi_break_mask(periods: List[int], days: int, ppd: int) -> int:
    """Block multiple period indices every day."""
    return make_multi_break_mask(periods, days, ppd)

def build_daily_break_mask(daily_masks: List[int], ppd: int) -> int:
    """Convert daily bitmask list to global 64-bit mask."""
    return decode_daily_masks(daily_masks, ppd)

def decode_mask(constraint_mask: int) -> dict:
    """Expose the decoder for frontend constraint panel serialisation."""
    return decode_constraint_mask(constraint_mask)
