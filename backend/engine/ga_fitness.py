"""
ga_fitness.py — Constraint Definitions & Fitness Evaluation
============================================================
Implements the complete fitness function with all hard and soft constraints.

Constraint taxonomy (from 04_GA_LOGIC.md):
  Hard (penalty = HARD_PENALTY = 1000 per violation):
    H1 : No teacher teaches two blocks simultaneously
    H2 : No room used by two blocks simultaneously
    H3 : Teacher available at assigned slot
    H4 : Room available at assigned slot
    H7 : Lab block assigned only to lab room
    H8 : Double/triple blocks have no break in their span; fit within day
    H9 : No classroom (class) used by two blocks simultaneously

  Soft (penalty = SOFT_BASE × weight per violation):
    S1 : Teacher daily load ≤ max_per_day
    S2 : Difficult subjects not in last period
    S3 : Same subject not twice same day (for same class)
    S4 : No gaps in class daily schedule — quadratic penalty, break-aware
    S5 : Teacher not teaching more than N consecutive periods
    S6 : Subject distribution across week — tighter threshold, extra same-day penalty
    S7 : No isolated single-period gaps in teacher schedule
    S8 : No consecutive blocks for a teacher (requires a gap or break)
    S9 : Pack lessons Mon–Thu; leave last day(s) light (configurable trailing days)
    S10: Max 1 lab per class per day
    S11: First period must not be empty if classes are scheduled that day

Fitness formula:
  F = BASE_FITNESS - total_penalty   (HIGHER is BETTER)
  BASE_FITNESS = 100,000 (ensures positive fitness for partial solutions)
  Perfect schedule = 100,000 (zero penalties)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List
import numpy as np
from ga_problem import ProblemData, FlatBlock


# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

BASE_FITNESS   = 100_000.0
HARD_PENALTY   = 1_000.0
SOFT_BASE      =     50.0


# ──────────────────────────────────────────────────────────────────────────────
# Constraint Mask — which constraints are active and their weights
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class ConstraintSettings:
    """
    Controls which constraints are evaluated and their relative weights.
    All hard constraints default ON; all soft constraints default ON with weight 1.0.
    """
    # Hard constraints (bool)
    H1: bool = True    # teacher clash
    H2: bool = True    # room clash
    H3: bool = True    # teacher availability
    H4: bool = True    # room availability
    H7: bool = True    # lab room requirement
    H8: bool = True    # contiguous blocks / no break crossing
    H9: bool = True    # classroom clash

    # Soft constraints (bool + float weight 0.0–1.0)
    S1: bool  = True;  S1_weight: float = 1.0   # teacher daily load
    S2: bool  = True;  S2_weight: float = 0.8   # difficult last period
    S3: bool  = True;  S3_weight: float = 0.7   # same subject twice same day
    S4: bool  = True;  S4_weight: float = 2.0   # no gaps in class daily schedule (strong — UX critical)
    S5: bool  = True;  S5_weight: float = 0.5   # max consecutive periods
    S6: bool  = True;  S6_weight: float = 1.2   # subject distribution across week (stronger)
    S7: bool  = False; S7_weight: float = 0.3   # isolated gaps (expensive, off by default)
    S8: bool  = True;  S8_weight: float = 1.0   # consecutive distinct blocks for teacher
    S9: bool  = True;  S9_weight: float = 0.8   # prefer gaps on last day(s) of week — pack Mon–Thu
    S10: bool = True;  S10_weight: float = 2.0  # max 1 lab per class per day
    S11: bool = True;  S11_weight: float = 3.0  # first period must not be empty if there are assigned classes that day

    # S9 tuning: how many trailing days to treat as "prefer-empty"
    # e.g. last_day_gap_days=1 → penalise lessons on Fri only
    #      last_day_gap_days=2 → penalise lessons on Thu+Fri
    last_day_gap_days: int = 1

    # Soft constraint tuning
    max_consecutive_periods: int = 3   # for S5

    @classmethod
    def all_hard_only(cls) -> "ConstraintSettings":
        """Only hard constraints — fastest fitness evaluation."""
        c = cls()
        c.S1 = c.S2 = c.S3 = c.S4 = c.S5 = c.S6 = c.S7 = c.S8 = c.S9 = c.S10 = c.S11 = False
        return c

    @classmethod
    def full(cls) -> "ConstraintSettings":
        """All constraints, default weights."""
        c = cls()
        c.S7 = True
        return c


# ──────────────────────────────────────────────────────────────────────────────
# Evaluation State (per-chromosome scratch space)
# ──────────────────────────────────────────────────────────────────────────────

class EvalState:
    """
    Mutable scratch space for fitness evaluation.
    Reset before each chromosome evaluation.
    Uses numpy arrays for bulk zero-initialization.

    MAX_* constants sized for the typical problem range.
    Using numpy int64 arrays as bitmask proxies — Python int is unlimited,
    but we simulate the C++ bitmask logic in Python using plain ints for
    correctness, then numpy for fast daily-count arrays.
    """
    __slots__ = (
        "teacher_used",      # dict[teacher_idx] → int bitmask
        "room_used",         # dict[room_idx]    → int bitmask
        "class_used",        # dict[class_idx]   → int bitmask
        "teacher_daily",     # list[teacher_idx][day] = period_count
        "class_lab_daily",   # list[class_idx][day] = lab_block_count
        "subject_day_class", # (subject_id, day, class_idx) → count
        "teacher_slots",     # list[teacher_idx][slot] = block_idx
    )

    def __init__(self, n_teachers: int, n_rooms: int, n_classes: int, days: int, periods: int):
        self.teacher_used  = [0] * n_teachers
        self.room_used     = [0] * n_rooms
        self.class_used    = [0] * n_classes
        self.teacher_daily = [[0] * days for _ in range(n_teachers)]
        self.class_lab_daily = [[0] * days for _ in range(n_classes)]
        self.subject_day_class: dict = {}   # (subject_id, day, class_idx) → int
        self.teacher_slots = [[-1] * (days * periods) for _ in range(n_teachers)]


# ──────────────────────────────────────────────────────────────────────────────
# Gene — the core scheduling assignment
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class Gene:
    """
    One gene = one (block, occurrence) → (day, start_period) assignment.

    block_idx  : index into ProblemData.blocks
    occurrence : which occurrence of this block (0..count-1)
    day        : assigned day (0-indexed)
    start_period: assigned start period (0-indexed)
    """
    block_idx:    int
    occurrence:   int
    day:          int
    start_period: int

    def __repr__(self):
        return f"Gene(blk={self.block_idx}[{self.occurrence}] → d{self.day}p{self.start_period})"


# ──────────────────────────────────────────────────────────────────────────────
# Chromosome
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class Chromosome:
    """
    A complete timetable assignment — one gene per (block, occurrence) pair.

    genes          : list of Gene, ordered by (block_idx, occurrence)
    fitness        : last computed fitness score (may be stale if dirty=True)
    dirty          : needs re-evaluation
    hard_violations: count of hard constraint violations (last eval)
    soft_violations: count of soft constraint violations (last eval)
    """
    genes:           List[Gene]
    fitness:         float = 0.0
    dirty:           bool  = True
    hard_violations: int   = 0
    soft_violations: int   = 0

    def copy(self) -> "Chromosome":
        return Chromosome(
            genes=[Gene(g.block_idx, g.occurrence, g.day, g.start_period)
                   for g in self.genes],
            fitness=self.fitness,
            dirty=self.dirty,
            hard_violations=self.hard_violations,
            soft_violations=self.soft_violations,
        )

    def __lt__(self, other):
        return self.fitness < other.fitness

    def __le__(self, other):
        return self.fitness <= other.fitness


# ──────────────────────────────────────────────────────────────────────────────
# Core Fitness Evaluation
# ──────────────────────────────────────────────────────────────────────────────

def evaluate(chr_: Chromosome, data: ProblemData, cs: ConstraintSettings) -> float:
    """
    Evaluate the fitness of a chromosome.

    Returns the fitness score (higher = better).
    Also updates chr_.hard_violations and chr_.soft_violations in-place.

    Algorithm:
      1. Zero-initialize EvalState
      2. Loop over all genes
         a. For each period in the block's duration:
            - Check H1, H2, H3, H4, H8, H9 using bitmasks
            - Mark resources as used AFTER all checks (critical ordering)
            - Accumulate teacher_daily counts for S1
         b. Check H7 (lab room) once per block
         c. Check S2 (difficult last period) once per block
         d. Check S3 (same subject same day) once per block
      3. Post-loop: check S1, S5, S6, S7
      4. Return BASE_FITNESS - total_penalty
    """
    state = EvalState(
        n_teachers=len(data.teachers),
        n_rooms=len(data.rooms),
        n_classes=len(data.classes),
        days=data.days,
        periods=data.periods,
    )

    penalty = 0.0
    hard_count = 0
    soft_count = 0
    periods    = data.periods
    break_mask = data.break_mask

    for gene in chr_.genes:
        block = data.blocks[gene.block_idx]
        dur   = block.duration
        day   = gene.day
        sp    = gene.start_period

        # ── H8a: Block must fit within the day ────────────────────────────────
        if cs.H8 and sp + dur > periods:
            penalty += HARD_PENALTY
            hard_count += 1
            # Can't check further slots — clamp to avoid index errors
            continue

        # ── Per-period checks (H1, H2, H3, H4, H8b, H9) ──────────────────────
        for off in range(dur):
            period   = sp + off
            slot     = day * periods + period
            slot_bit = 1 << slot

            # H8b: No break slot in block span
            if cs.H8 and (break_mask & slot_bit):
                penalty += HARD_PENALTY
                hard_count += 1

            # H1: Teacher clash
            if cs.H1:
                for ti in block.teacher_indices:
                    if state.teacher_used[ti] & slot_bit:
                        penalty += HARD_PENALTY
                        hard_count += 1

            # H2: Room clash
            if cs.H2:
                for ri in block.room_indices:
                    if state.room_used[ri] & slot_bit:
                        penalty += HARD_PENALTY
                        hard_count += 1

            # H3: Teacher availability
            if cs.H3:
                for ti in block.teacher_indices:
                    if not (data.teachers[ti].available_mask & slot_bit):
                        penalty += HARD_PENALTY
                        hard_count += 1

            # H4: Room availability
            if cs.H4:
                for ri in block.room_indices:
                    if not (data.rooms[ri].available_mask & slot_bit):
                        penalty += HARD_PENALTY
                        hard_count += 1

            # H9: Classroom clash
            if cs.H9:
                for ci in block.class_indices:
                    if state.class_used[ci] & slot_bit:
                        penalty += HARD_PENALTY
                        hard_count += 1

            # Mark all resources as used AFTER all checks
            for ti in block.teacher_indices:
                state.teacher_used[ti] |= slot_bit
                state.teacher_slots[ti][slot] = gene.block_idx
            for ri in block.room_indices:
                state.room_used[ri] |= slot_bit
            for ci in block.class_indices:
                state.class_used[ci] |= slot_bit

        # ── Accumulate daily teacher periods ──────────────────────────────────
        if cs.S1:
            for ti in block.teacher_indices:
                state.teacher_daily[ti][day] += dur

        # ── H7: Lab room requirement ──────────────────────────────────────────
        if cs.H7 and block.is_lab:
            for ri in block.room_indices:
                if not data.rooms[ri].is_lab:
                    penalty += HARD_PENALTY
                    hard_count += 1

        # ── S10: Max 1 lab per day ───────────────────────────────────────────
        if cs.S10 and block.is_lab:
            for ci in block.class_indices:
                state.class_lab_daily[ci][day] += 1

        # ── S2: Difficult subject not in last period ──────────────────────────
        if cs.S2 and block.is_difficult:
            last_period = sp + dur - 1
            if last_period >= periods - 1:
                penalty += SOFT_BASE * cs.S2_weight
                soft_count += 1

        # ── S3: Same subject same day same class ──────────────────────────────
        if cs.S3:
            for ci in block.class_indices:
                key = (block.subject_id, day, ci)
                cnt = state.subject_day_class.get(key, 0)
                if cnt >= 1:
                    penalty += SOFT_BASE * cs.S3_weight
                    soft_count += 1
                state.subject_day_class[key] = cnt + 1

    # ── S1: Teacher daily overload ────────────────────────────────────────────
    if cs.S1:
        for ti, teacher in enumerate(data.teachers):
            for d in range(data.days):
                excess = state.teacher_daily[ti][d] - teacher.max_per_day
                if excess > 0:
                    penalty += SOFT_BASE * cs.S1_weight * excess
                    soft_count += 1

    # ── S5: Max consecutive periods ───────────────────────────────────────────
    if cs.S5:
        p, sc = _check_consecutive(state, data, cs)
        penalty    += p
        soft_count += sc

    # ── S6: Subject distribution variance ────────────────────────────────────
    if cs.S6:
        p, sc = _check_distribution(chr_, data, cs)
        penalty    += p
        soft_count += sc

    # ── S7: Isolated gaps ────────────────────────────────────────────────────
    if cs.S7:
        p, sc = _check_isolated_gaps(state, data, cs)
        penalty    += p
        soft_count += sc

    # ── S4: Class schedule gaps ──────────────────────────────────────────────
    if cs.S4:
        p, sc = _check_class_gaps(state, data, cs)
        penalty    += p
        soft_count += sc

    # ── S8: Consecutive blocks for teacher ───────────────────────────────────
    if cs.S8:
        p, sc = _check_consecutive_blocks(state, data, cs)
        penalty    += p
        soft_count += sc

    # ── S9: Pack lessons early in week — leave last day(s) light ────────────
    if cs.S9:
        p, sc = _check_last_day_gaps(chr_, data, cs)
        penalty    += p
        soft_count += sc

    # ── S10: Max 1 lab per day per class ──────────────────────────────────────
    if cs.S10:
        for ci in range(len(data.classes)):
            for d in range(data.days):
                labs = state.class_lab_daily[ci][d]
                if labs > 1:
                    penalty    += SOFT_BASE * cs.S10_weight * (labs - 1)
                    soft_count += (labs - 1)

    # ── S11: First period empty ──────────────────────────────────────────────
    if cs.S11:
        for ci in range(len(data.classes)):
            mask = state.class_used[ci]
            for d in range(data.days):
                has_classes = False
                for p in range(data.periods):
                    if mask & (1 << (d * data.periods + p)):
                        has_classes = True
                        break
                
                if has_classes:
                    slot0 = d * data.periods + 0
                    if not (mask & (1 << slot0)): # First period empty
                        penalty    += SOFT_BASE * cs.S11_weight
                        soft_count += 1

    chr_.hard_violations = hard_count
    chr_.soft_violations = soft_count
    chr_.dirty = False

    return BASE_FITNESS - penalty


def _check_consecutive(state: EvalState, data: ProblemData, cs: ConstraintSettings):
    """
    S5: Penalize teacher teaching more than `max_consecutive` periods in a row.
    Only counts non-break slots (break periods naturally reset the run counter).
    """
    penalty = 0.0
    count   = 0
    max_c   = cs.max_consecutive_periods
    periods = data.periods

    for ti in range(len(data.teachers)):
        mask = state.teacher_used[ti]
        for day in range(data.days):
            run = 0
            for p in range(periods):
                slot = day * periods + p
                if mask & (1 << slot):
                    run += 1
                    if run > max_c:
                        penalty += SOFT_BASE * cs.S5_weight
                        count   += 1
                else:
                    run = 0

    return penalty, count


def _check_distribution(chr_: Chromosome, data: ProblemData, cs: ConstraintSettings):
    """
    S6: Penalize uneven distribution of subject occurrences across the week.

    For each (subject, class) pair with ≥2 occurrences, we compute the
    variance of per-day counts and penalise proportionally.

    Threshold tightened to 0.2 (was 0.5) so that even mild clustering is
    caught early.  Weight is also higher in ConstraintSettings (1.2 vs 0.4).

    Additionally, if any single day has ≥2 occurrences of the same subject
    for the same class, apply a flat extra penalty per extra occurrence to
    drive the GA towards true spread.
    """
    day_counts: dict = {}

    for gene in chr_.genes:
        block = data.blocks[gene.block_idx]
        for ci in block.class_indices:
            key = (block.subject_id, ci)
            if key not in day_counts:
                day_counts[key] = [0] * data.days
            day_counts[key][gene.day] += 1

    penalty = 0.0
    count   = 0

    for counts in day_counts.values():
        total = sum(counts)
        if total <= 1:
            continue

        mean = total / data.days
        variance = sum((c - mean) ** 2 for c in counts) / data.days

        # Tighter threshold: 0.2 instead of 0.5
        if variance > 0.2:
            penalty += SOFT_BASE * cs.S6_weight * variance
            count   += 1

        # Extra flat penalty for any day that has ≥2 of the same subject
        for c in counts:
            if c >= 2:
                penalty += SOFT_BASE * cs.S6_weight * (c - 1)
                count   += 1

    return penalty, count


def _check_last_day_gaps(chr_: Chromosome, data: ProblemData, cs: ConstraintSettings):
    """
    S9: Prefer leaving the last `last_day_gap_days` days of the week lightly
    loaded or empty — i.e. pack lessons into earlier days.

    Logic:
      - For each class, count lessons on the "gap days" (the last N days).
      - Penalise proportionally to how many lessons are on those days.
      - This creates selection pressure to shift lessons earlier in the week,
        naturally leaving Friday (and optionally Thursday) with fewer classes.

    The penalty per lesson on a gap-day is:
        SOFT_BASE * S9_weight * (day_weight)
    where day_weight = 1.0 for the very last day, 0.5 for the second-to-last,
    giving a gradient so the GA nudges lessons as far forward as possible.
    """
    if data.days < 2:
        return 0.0, 0

    gap_days = cs.last_day_gap_days
    penalty  = 0.0
    count    = 0

    # Build per-class, per-day lesson counts
    class_day_count: dict = {}   # ci → [count_per_day]
    for gene in chr_.genes:
        block = data.blocks[gene.block_idx]
        for ci in block.class_indices:
            if ci not in class_day_count:
                class_day_count[ci] = [0] * data.days
            # Count the full duration as "lessons on this day"
            class_day_count[ci][gene.day] += block.duration

    # Penalise lessons on the trailing gap_days
    for ci, day_counts in class_day_count.items():
        for offset in range(gap_days):
            gap_day = data.days - 1 - offset          # e.g. day 4 (Fri), then day 3 (Thu)
            day_weight = 1.0 / (offset + 1)           # 1.0 for Fri, 0.5 for Thu, 0.33 for Wed…
            lessons_on_day = day_counts[gap_day]
            if lessons_on_day > 0:
                penalty += SOFT_BASE * cs.S9_weight * day_weight * lessons_on_day
                count   += 1

    return penalty, count


def _check_isolated_gaps(state: EvalState, data: ProblemData, cs: ConstraintSettings):
    """
    S7: Penalize isolated single-period gaps in teacher schedule.
    A gap at period p is "isolated" if p-1 and p+1 are both occupied.
    """
    penalty = 0.0
    count   = 0
    periods = data.periods

    for ti in range(len(data.teachers)):
        mask = state.teacher_used[ti]
        for day in range(data.days):
            for p in range(1, periods - 1):
                slot  = day * periods + p
                prev  = day * periods + (p - 1)
                next_ = day * periods + (p + 1)
                if not (mask & (1 << slot)):   # gap at p
                    if (mask & (1 << prev)) and (mask & (1 << next_)):
                        penalty += SOFT_BASE * cs.S7_weight
                        count   += 1

    return penalty, count


def _check_class_gaps(state: EvalState, data: ProblemData, cs: ConstraintSettings):
    """
    S4: Penalize gaps in class daily schedule.

    A "gap" is any working period between a class's first and last lesson of
    the day that has no lesson assigned.  Break slots are NOT counted as gaps
    (they are expected).

    Penalty is QUADRATIC in the gap count per day so that days with many
    gaps are punished much harder than days with a single gap:
        penalty += SOFT_BASE * S4_weight * gap_count²

    This strongly encourages the GA to pack lessons into a continuous block
    rather than spreading them across the whole day.
    """
    penalty = 0.0
    count   = 0
    periods = data.periods
    w_mask  = data.working_mask
    b_mask  = data.break_mask

    for ci in range(len(data.classes)):
        mask = state.class_used[ci]
        for day in range(data.days):
            first_p = -1
            last_p  = -1
            for p in range(periods):
                slot = day * periods + p
                if mask & (1 << slot):
                    if first_p == -1:
                        first_p = p
                    last_p = p

            if first_p == -1:
                continue   # no lessons this day — nothing to check

            # Count working (non-break) periods between first and last that are empty
            gaps = 0
            for p in range(first_p + 1, last_p):
                slot = day * periods + p
                # Skip break slots — they are not gaps
                if b_mask & (1 << slot):
                    continue
                if (w_mask & (1 << slot)) and not (mask & (1 << slot)):
                    gaps += 1

            if gaps > 0:
                # Quadratic penalty: 1 gap → ×1, 2 gaps → ×4, 3 gaps → ×9 …
                penalty += SOFT_BASE * cs.S4_weight * (gaps ** 2)
                count   += gaps

    return penalty, count


def _check_consecutive_blocks(state: EvalState, data: ProblemData, cs: ConstraintSettings):
    """
    S8: Penalize back-to-back lesson blocks for a teacher.
    A teacher cannot transition from one block to a DIFFERENT block immediately without a free period or break.
    """
    penalty = 0.0
    count   = 0
    periods = data.periods
    b_mask  = data.break_mask
    
    for ti in range(len(data.teachers)):
        slots = state.teacher_slots[ti]
        for day in range(data.days):
            prev_block = -1
            for p in range(periods):
                slot = day * periods + p
                curr_block = slots[slot]
                
                # If break slot, reset the consecutive tracker
                if b_mask & (1 << slot):
                    prev_block = -1
                    continue
                
                if curr_block != -1:
                    if prev_block != -1 and curr_block != prev_block:
                        penalty += SOFT_BASE * cs.S8_weight
                        count += 1
                
                prev_block = curr_block
                
    return penalty, count


# ──────────────────────────────────────────────────────────────────────────────
# Violation Reporter — for human-readable output
# ──────────────────────────────────────────────────────────────────────────────

def get_violation_details(chr_: Chromosome, data: ProblemData, cs: ConstraintSettings) -> list:
    """
    Returns a list of dicts describing each constraint violation.
    Mirrors evaluate() exactly — slower, for reporting only (not during GA).
    Checks all H1-H9 hard constraints and S1-S7 soft constraints.
    """
    violations = []
    state = EvalState(
        n_teachers=len(data.teachers),
        n_rooms=len(data.rooms),
        n_classes=len(data.classes),
        days=data.days,
        periods=data.periods,
    )
    periods    = data.periods
    break_mask = data.break_mask

    def add(type_, desc, block_id=""):
        violations.append({"type": type_, "description": desc, "block_id": block_id})

    for gene in chr_.genes:
        block = data.blocks[gene.block_idx]
        dur   = block.duration
        day   = gene.day
        sp    = gene.start_period

        # H8a: block overflows day
        if cs.H8 and sp + dur > periods:
            add("H8", f"Block {block.id} ({block.subject_name}) overflows day {day+1}", block.id)
            continue

        for off in range(dur):
            period   = sp + off
            slot     = day * periods + period
            slot_bit = 1 << slot

            # H8b: break slot in block span
            if cs.H8 and (break_mask & slot_bit):
                add("H8", f"{block.subject_name} on Day{day+1} P{period+1}: spans a break slot", block.id)

            # H1: Teacher clash
            if cs.H1:
                for ti in block.teacher_indices:
                    if state.teacher_used[ti] & slot_bit:
                        add("H1", f"Teacher {data.teachers[ti].id} double-booked at Day{day+1} P{period+1}", block.id)

            # H2: Room clash
            if cs.H2:
                for ri in block.room_indices:
                    if state.room_used[ri] & slot_bit:
                        add("H2", f"Room {data.rooms[ri].id} double-booked at Day{day+1} P{period+1}", block.id)

            # H3: Teacher availability
            if cs.H3:
                for ti in block.teacher_indices:
                    if not (data.teachers[ti].available_mask & slot_bit):
                        add("H3", f"Teacher {data.teachers[ti].id} unavailable at Day{day+1} P{period+1}", block.id)

            # H4: Room availability
            if cs.H4:
                for ri in block.room_indices:
                    if not (data.rooms[ri].available_mask & slot_bit):
                        add("H4", f"Room {data.rooms[ri].id} unavailable at Day{day+1} P{period+1}", block.id)

            # H9: Class clash
            if cs.H9:
                for ci in block.class_indices:
                    if state.class_used[ci] & slot_bit:
                        add("H9", f"Class {data.classes[ci].id} double-booked at Day{day+1} P{period+1}", block.id)

            # Mark all resources used AFTER all checks (mirrors evaluate() ordering)
            for ti in block.teacher_indices:
                state.teacher_used[ti] |= slot_bit
                state.teacher_slots[ti][slot] = gene.block_idx
            for ri in block.room_indices:
                state.room_used[ri] |= slot_bit
            for ci in block.class_indices:
                state.class_used[ci] |= slot_bit

        # H7: Lab room requirement
        if cs.H7 and block.is_lab:
            for ri in block.room_indices:
                if not data.rooms[ri].is_lab:
                    add("H7", f"{block.subject_name} assigned to non-lab room {data.rooms[ri].id}", block.id)

        # S2: Difficult subject not in last period
        if cs.S2 and block.is_difficult:
            if sp + dur - 1 >= periods - 1:
                add("S2", f"{block.subject_name} ends at last period on Day{day+1}", block.id)


        # S3: Same subject twice same day same class
        if cs.S3:
            for ci in block.class_indices:
                key = (block.subject_id, day, ci)
                cnt = state.subject_day_class.get(key, 0)
                if cnt >= 1:
                    add("S3", f"{block.subject_name} twice on Day{day+1} for class {data.classes[ci].id}", block.id)
                state.subject_day_class[key] = cnt + 1

        # Accumulate daily teacher periods for S1
        if cs.S1:
            for ti in block.teacher_indices:
                state.teacher_daily[ti][day] += dur

    # S1: Teacher daily overload
    if cs.S1:
        for ti, teacher in enumerate(data.teachers):
            for d in range(data.days):
                excess = state.teacher_daily[ti][d] - teacher.max_per_day
                if excess > 0:
                    add("S1", f"Teacher {teacher.id} overloaded on Day{d+1}: "
                              f"{state.teacher_daily[ti][d]} periods > max {teacher.max_per_day}")

    # S5: Max consecutive periods
    if cs.S5:
        max_c = cs.max_consecutive_periods
        for ti in range(len(data.teachers)):
            mask = state.teacher_used[ti]
            for d in range(data.days):
                run = 0
                for p in range(periods):
                    slot = d * periods + p
                    if mask & (1 << slot):
                        run += 1
                        if run > max_c:
                            add("S5", f"Teacher {data.teachers[ti].id} has {run} consecutive "
                                      f"periods on Day{d+1} at P{p+1}")
                    else:
                        run = 0

    # S6: Subject distribution variance
    if cs.S6:
        day_counts: dict = {}
        for gene in chr_.genes:
            block = data.blocks[gene.block_idx]
            for ci in block.class_indices:
                key = (block.subject_id, ci)
                if key not in day_counts:
                    day_counts[key] = [0] * data.days
                day_counts[key][gene.day] += 1
        for (sid, ci), counts in day_counts.items():
            total = sum(counts)
            if total <= 1:
                continue
            mean = total / data.days
            variance = sum((c - mean) ** 2 for c in counts) / data.days
            if variance > 0.5:
                add("S6", f"Subject {sid} for class {data.classes[ci].id} "
                          f"unevenly distributed (variance={variance:.2f})")

    # S7: Isolated teacher gaps
    if cs.S7:
        for ti in range(len(data.teachers)):
            mask = state.teacher_used[ti]
            for d in range(data.days):
                for p in range(1, periods - 1):
                    slot  = d * periods + p
                    prev  = d * periods + (p - 1)
                    next_ = d * periods + (p + 1)
                    if not (mask & (1 << slot)):
                        if (mask & (1 << prev)) and (mask & (1 << next_)):
                            add("S7", f"Teacher {data.teachers[ti].id} isolated gap "
                                      f"on Day{d+1} P{p+1}")

    # S4: Class schedule gaps
    if cs.S4:
        w_mask = data.working_mask
        for ci in range(len(data.classes)):
            mask = state.class_used[ci]
            for d in range(data.days):
                first_p = -1
                last_p  = -1
                for p in range(periods):
                    slot = d * periods + p
                    if mask & (1 << slot):
                        if first_p == -1: first_p = p
                        last_p = p
                if first_p != -1:
                    # Every unused working period BEFORE the last assigned period is a gap
                    for p in range(first_p + 1, last_p):
                        slot = d * periods + p
                        if (w_mask & (1 << slot)) and not (mask & (1 << slot)):
                            add("S4", f"Class {data.classes[ci].id} has a free period "
                                      f"before end of Day{d+1} at P{p+1}")

        # S10: Max 1 lab per day per class
        if cs.S10:
            for ci in block.class_indices:
                if block.is_lab and state.class_lab_daily[ci][gene.day] > 1:
                    add("S10", f"Class {data.classes[ci].id} has multiple lab sessions "
                               f"on Day{gene.day+1}", block.id)

        # S11: First period empty
        if cs.S11:
            for ci in range(len(data.classes)):
                mask = state.class_used[ci]
                for d in range(data.days):
                    has_classes = False
                    for p in range(periods):
                        if mask & (1 << (d * periods + p)):
                            has_classes = True
                            break
                    if has_classes:
                        if not (mask & (1 << (d * periods + 0))):
                            add("S11", f"Class {data.classes[ci].id} has classes on Day{d+1} "
                                       f"but the first period is empty", "")

    # S8: Consecutive distinct blocks for teacher
    if cs.S8:
        for ti in range(len(data.teachers)):
            slots = state.teacher_slots[ti]
            for d in range(data.days):
                prev_block = -1
                for p in range(periods):
                    slot = d * periods + p
                    curr_block = slots[slot]
                    if break_mask & (1 << slot):
                        prev_block = -1
                        continue
                    if curr_block != -1:
                        if prev_block != -1 and curr_block != prev_block:
                            add("S8", f"Teacher {data.teachers[ti].id} has back-to-back "
                                      f"distinct courses/blocks at Day{d+1} P{p+1}")
                    prev_block = curr_block

    # S9: Lessons on last day(s) of week
    if cs.S9:
        gap_days = cs.last_day_gap_days
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        class_day_count: dict = {}
        for gene in chr_.genes:
            block = data.blocks[gene.block_idx]
            for ci in block.class_indices:
                if ci not in class_day_count:
                    class_day_count[ci] = [0] * data.days
                class_day_count[ci][gene.day] += block.duration
        for ci, day_counts in class_day_count.items():
            for offset in range(gap_days):
                gap_day = data.days - 1 - offset
                lessons = day_counts[gap_day]
                if lessons > 0:
                    dname = day_names[gap_day] if gap_day < len(day_names) else f"Day{gap_day+1}"
                    add("S9", f"Class {data.classes[ci].id} has {lessons} periods on {dname} "
                               f"(prefer earlier days)")

    return violations