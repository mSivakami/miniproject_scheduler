"""
ga_preflight.py — Pre-Flight Validator & Hill Climbing
=======================================================
PRE-FLIGHT VALIDATOR
  Checks feasibility BEFORE running the GA. This catches impossible
  inputs early, preventing the GA from wasting time on unsolvable problems.

  Checks:
  P1 : Total lesson-periods vs available slots per class
       If a class has more periods than working slots, it's impossible.
  P2 : Teacher load feasibility
       If a teacher is assigned more periods than their available slots, impossible.
  P3 : Room availability feasibility
       Enough rooms of the right type exist.
  P4 : Locked lesson slot validity
       Locked slots must be working slots (not breaks, within bounds).
  P5 : Locked lesson clash detection
       Two locked lessons cannot occupy the same teacher/room/class slot.
  P6 : Double/triple block fit check
       Duration ≤ periods_per_day; no period position forces a break crossing.

HILL CLIMBING POST-PROCESSOR
  After GA completes, runs a greedy swap-based hill climbing pass.
  Only runs if the GA found a zero hard-violation solution.

  Algorithm (Schaerf 1999):
  1. Try all (i, j) pairs of unlocked genes
  2. If swapping their (day, period) improves fitness, accept
  3. After any improvement, restart the scan
  4. Stop when no improvement found or time budget exhausted
"""

from __future__ import annotations
import time
from dataclasses import dataclass, field
from typing import List, Tuple
from ga_problem import ProblemData
from ga_fitness import Chromosome, ConstraintSettings, evaluate, Gene


# ──────────────────────────────────────────────────────────────────────────────
# Pre-flight result
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class PreflightResult:
    feasible:  bool
    warnings:  List[str] = field(default_factory=list)
    errors:    List[str] = field(default_factory=list)

    def print_report(self):
        status = "✓ FEASIBLE" if self.feasible else "✗ INFEASIBLE"
        print(f"\n  {'─'*60}")
        print(f"  Pre-flight Check: {status}")
        if self.errors:
            print(f"  ERRORS ({len(self.errors)}):")
            for e in self.errors:
                print(f"    ✗ {e}")
        if self.warnings:
            print(f"  WARNINGS ({len(self.warnings)}):")
            for w in self.warnings:
                print(f"    ⚠ {w}")
        if not self.errors and not self.warnings:
            print("  All checks passed — problem looks schedulable.")
        print(f"  {'─'*60}\n")


# ──────────────────────────────────────────────────────────────────────────────
# Pre-flight validator
# ──────────────────────────────────────────────────────────────────────────────

def preflight_check(data: ProblemData) -> PreflightResult:
    """
    Run all pre-flight checks on the problem data.
    Returns a PreflightResult with errors (fatal) and warnings (advisory).
    """
    errors:   List[str] = []
    warnings: List[str] = []
    periods   = data.periods
    days      = data.days
    working   = data.working_mask
    bk_mask   = data.break_mask

    # ── Count total working slots (non-break) ─────────────────────────────────
    total_working_slots = bin(working).count('1')

    # ── P4 & P5: Validate locked lessons ─────────────────────────────────────
    locked_teacher_slots: dict = {}   # teacher_idx → set of occupied slots
    locked_room_slots:    dict = {}
    locked_class_slots:   dict = {}

    for block in data.blocks:
        if not block.is_locked:
            continue

        ld  = block.locked_day
        lp  = block.locked_period
        dur = block.duration

        # P4a: Day/period within bounds
        if ld < 0 or ld >= days:
            errors.append(f"Locked block {block.id} ({block.subject_name}): "
                          f"day {ld} out of range [0, {days-1}]")
            continue
        if lp < 0 or lp + dur > periods:
            errors.append(f"Locked block {block.id} ({block.subject_name}): "
                          f"period {lp}+{dur} overflows day (max period={periods-1})")
            continue

        # P4b: All slots are working slots
        for off in range(dur):
            slot = ld * periods + lp + off
            bit  = 1 << slot
            if bk_mask & bit:
                errors.append(f"Locked block {block.id} ({block.subject_name}): "
                               f"Day{ld+1} P{lp+off+1} is a break slot")
            if not (working & bit):
                errors.append(f"Locked block {block.id} ({block.subject_name}): "
                               f"Day{ld+1} P{lp+off+1} is not a working slot")

        # P5: Clash detection between locked lessons
        for off in range(dur):
            slot = ld * periods + lp + off

            for ti in block.teacher_indices:
                s = locked_teacher_slots.setdefault(ti, set())
                if slot in s:
                    errors.append(f"Locked block {block.id}: teacher "
                                  f"{data.teachers[ti].id} clash at Day{ld+1} P{lp+off+1}")
                s.add(slot)

            for ri in block.room_indices:
                s = locked_room_slots.setdefault(ri, set())
                if slot in s:
                    errors.append(f"Locked block {block.id}: room "
                                  f"{data.rooms[ri].id} clash at Day{ld+1} P{lp+off+1}")
                s.add(slot)

            for ci in block.class_indices:
                s = locked_class_slots.setdefault(ci, set())
                if slot in s:
                    errors.append(f"Locked block {block.id}: class "
                                  f"{data.classes[ci].id} clash at Day{ld+1} P{lp+off+1}")
                s.add(slot)

    # ── P1: Class period load vs available slots ──────────────────────────────
    # Sum periods per class
    class_periods: dict = {}
    for block in data.blocks:
        for ci in block.class_indices:
            class_periods[ci] = class_periods.get(ci, 0) + block.duration * block.count

    for ci, total in class_periods.items():
        if total > total_working_slots:
            errors.append(
                f"Class {data.classes[ci].id}: needs {total} periods "
                f"but only {total_working_slots} working slots available")
        elif total > total_working_slots * 0.85:
            warnings.append(
                f"Class {data.classes[ci].id}: {total}/{total_working_slots} "
                f"slots used ({100*total/total_working_slots:.0f}%) — very tight schedule")

    # ── P2: Teacher load vs available slots ───────────────────────────────────
    teacher_periods: dict = {}
    for block in data.blocks:
        for ti in block.teacher_indices:
            teacher_periods[ti] = teacher_periods.get(ti, 0) + block.duration * block.count

    for ti, total in teacher_periods.items():
        t          = data.teachers[ti]
        avail_bits = bin(t.available_mask & working).count('1')

        if total > avail_bits:
            errors.append(
                f"Teacher {t.id}: assigned {total} periods "
                f"but only {avail_bits} available slots")
        elif total > t.max_per_week:
            warnings.append(
                f"Teacher {t.id}: {total} periods assigned vs "
                f"max_per_week={t.max_per_week}")
        elif total > avail_bits * 0.9:
            warnings.append(
                f"Teacher {t.id}: {total}/{avail_bits} available slots used "
                f"({100*total/avail_bits:.0f}%) — very tight")

    # ── P3: Room type availability ────────────────────────────────────────────
    # Count lab rooms and check lab block requirements
    lab_rooms      = sum(1 for r in data.rooms if r.is_lab)
    lab_slots_need = sum(block.duration * block.count
                         for block in data.blocks if block.is_lab)

    if lab_slots_need > 0 and lab_rooms == 0:
        errors.append(f"No lab rooms defined but {lab_slots_need} lab periods required")

    # ── P6: Double/triple fit check ───────────────────────────────────────────
    for block in data.blocks:
        if block.duration > periods:
            errors.append(
                f"Block {block.id} ({block.subject_name}): "
                f"duration {block.duration} > periods_per_day {periods}")

        if block.duration > 1:
            # Check that at least one valid contiguous slot exists
            valid_slots = data.settings.working_slots_for_duration(block.duration)
            if not valid_slots:
                errors.append(
                    f"Block {block.id} ({block.subject_name}): "
                    f"no valid contiguous {block.duration}-period slot exists "
                    f"(all slots either break or overflow day)")

    feasible = len(errors) == 0
    return PreflightResult(feasible=feasible, warnings=warnings, errors=errors)


# ──────────────────────────────────────────────────────────────────────────────
# Hill Climbing Post-Processor
# ──────────────────────────────────────────────────────────────────────────────

def hill_climb(
    chr_:          Chromosome,
    data:          ProblemData,
    cs:            ConstraintSettings,
    time_limit_ms: int = 5000,
    verbose:       bool = False,
) -> Tuple[Chromosome, int]:
    """
    Greedy swap-based hill climbing (Schaerf 1999).

    Tries all pairs of unlocked genes; accepts any swap that improves fitness.
    Restarts scan after each improvement.
    Stops when no improvement found or time budget exceeded.

    Args:
        chr_          : chromosome to optimize (modified in-place)
        data          : problem data
        cs            : constraint settings
        time_limit_ms : maximum time budget in milliseconds
        verbose       : print improvement progress

    Returns:
        (improved_chromosome, improvement_count)
    """
    start    = time.perf_counter()
    n        = len(chr_.genes)
    improved = True
    swaps    = 0

    current_fitness = evaluate(chr_, data, cs)

    # Get unlocked gene indices once
    unlocked = [i for i, g in enumerate(chr_.genes)
                if not data.blocks[g.block_idx].is_locked]

    if len(unlocked) < 2:
        return chr_, 0

    def time_ok() -> bool:
        elapsed = (time.perf_counter() - start) * 1000
        return elapsed < time_limit_ms

    while improved and time_ok():
        improved = False

        for ia in range(len(unlocked)):
            if not time_ok():
                break

            for ib in range(ia + 1, len(unlocked)):
                if not time_ok():
                    break

                i = unlocked[ia]
                j = unlocked[ib]
                ga = chr_.genes[i]
                gb = chr_.genes[j]
                ba = data.blocks[ga.block_idx]
                bb = data.blocks[gb.block_idx]

                # Validate the swap is legal
                def valid(block_idx, day, sp):
                    block = data.blocks[block_idx]
                    if sp + block.duration > data.periods:
                        return False
                    for off in range(block.duration):
                        slot = day * data.periods + sp + off
                        bit  = 1 << slot
                        if not (data.working_mask & bit) or (data.break_mask & bit):
                            return False
                    return True

                if not valid(ga.block_idx, gb.day, gb.start_period):
                    continue
                if not valid(gb.block_idx, ga.day, ga.start_period):
                    continue

                # Perform swap
                ga.day, gb.day = gb.day, ga.day
                ga.start_period, gb.start_period = gb.start_period, ga.start_period
                chr_.dirty = True

                new_fitness = evaluate(chr_, data, cs)

                if new_fitness > current_fitness + 0.01:
                    current_fitness = new_fitness
                    swaps += 1
                    improved = True
                    if verbose:
                        print(f"    HC swap {swaps}: fitness {new_fitness:.1f}")
                    break   # restart outer loop
                else:
                    # Revert
                    ga.day, gb.day = gb.day, ga.day
                    ga.start_period, gb.start_period = gb.start_period, ga.start_period
                    chr_.dirty = False

            if improved:
                break

    chr_.fitness = current_fitness
    return chr_, swaps