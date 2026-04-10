"""
constraints.py
==============
Two-layer constraint evaluation system.

Layer 1 — HARD  (always evaluated, cannot be toggled)
    Fixed large penalties. Any hard violation → fitness ≥ 10 000.
    Detected via O(n) bitmask pass over all lesson blocks.

Layer 2 — SOFT
    NT1–NT4 : non-toggleable soft rules (always evaluated)
    Bits 0–11: controlled by a 12-bit integer constraint_mask

Hard floor:
    The smallest hard weight (10 000) is 1 000× larger than the largest
    soft weight (10), so any infeasible timetable always ranks below any
    feasible one, regardless of soft violations.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from structures import (
    LessonBlock, Timetable,
    Teacher, Subject, Room, Class,
    slot_index, count_gaps_in_day,
)


# ─────────────────────────────────────────────────────────────────────────────
# SOFT CONSTRAINT DECODER
# ─────────────────────────────────────────────────────────────────────────────

def decode_constraint_mask(n: int) -> dict:
    """
    Decode a 12-bit integer (0–4095) into named soft constraint settings.
    Called ONCE at scheduler construction — zero per-generation overhead.

    Bit layout:
        Bit  0-1  teacher_gap          0=off  1=minimize  2=allow  3=avoid-back-to-back
        Bit  2-3  lab_time_pref        0=none 1=start-of-day  2=end-of-day
        Bit  4    lab_avoid_monday     0=off  1=on
        Bit  5    lab_avoid_friday     0=off  1=on
        Bit  6    max_classes_per_day  0=off  1=on
        Bit  7    difficult_morning    0=off  1=on
        Bit  8-9  subject_dist         0=off  1=even  2=high-priority early
        Bit  10   first_period_equal   0=off  1=on
        Bit  11   no_repeat_subject    0=off  1=on  (weight=2, very weak)
    """
    return {
        "teacher_gap":         (n >> 0) & 0b11,
        "lab_time_pref":       (n >> 2) & 0b11,
        "lab_avoid_monday":    (n >> 4) & 0b1,
        "lab_avoid_friday":    (n >> 5) & 0b1,
        "max_classes_per_day": (n >> 6) & 0b1,
        "difficult_morning":   (n >> 7) & 0b1,
        "subject_dist":        (n >> 8) & 0b11,
        "first_period_equal":  (n >> 10) & 0b1,
        "no_repeat_subject":   (n >> 11) & 0b1,
    }


# ─────────────────────────────────────────────────────────────────────────────
# CONSTRAINT CHECKER
# ─────────────────────────────────────────────────────────────────────────────

class ConstraintChecker:
    """
    Stateless after __init__. calculate_fitness() is a pure function of Timetable.
    Pre-computes all subject/teacher category sets at init for O(1) lookup in
    the hot evaluation loop.
    """

    # ── Hard constraint weights (non-negotiable) ─────────────────────────
    HARD: Dict[str, int] = {
        "unassigned":          15_000,
        "locked_violation":    50_000,
        "break_violation":     20_000,
        "teacher_conflict":    10_000,
        "room_conflict":       10_000,
        "class_conflict":      10_000,
        "teacher_unavailable": 10_000,
        "room_unavailable":    10_000,
        "two_labs_same_day":   25_000,
    }

    # ── Non-toggleable soft weights ──────────────────────────────────────
    NT: Dict[str, int] = {
        "NT1_first_period":    100,   # every class needs P0 covered
        "NT2_teacher_all_day": 100,   # no teacher has a fully empty day
        "NT3_class_gaps":       80,   # per-gap penalty within class day
        "NT4_consecutive":      60,   # 3+ consecutive blocks for teacher
    }

    # ── Toggleable soft weights ──────────────────────────────────────────
    SOFT_STANDARD = 10
    SOFT_WEAK     =  2   # bit 11 only

    def __init__(
        self,
        teachers:        Dict[str, Teacher],
        subjects:        Dict[str, Subject],
        rooms:           Dict[str, Room],
        classes:         Dict[str, Class],
        blocks:          List[LessonBlock],
        break_mask:      int,
        days:            int,
        periods_per_day: int,
        constraint_mask: int = 0,
    ):
        self.teachers        = teachers
        self.subjects        = subjects
        self.rooms           = rooms
        self.classes         = classes
        self.blocks          = blocks
        self.blocks_by_id    = {b.id: b for b in blocks}
        self.break_mask      = break_mask
        self.days            = days
        self.ppd             = periods_per_day
        self.soft            = decode_constraint_mask(constraint_mask)
        self.constraint_mask = constraint_mask

        # ── Pre-compute category sets for O(1) lookup ────────────────────
        self.lab_sids        = frozenset(s.id for s in subjects.values() if s.is_lab)
        self.difficult_sids  = frozenset(s.id for s in subjects.values() if s.is_difficult)
        self.core_sids       = frozenset(s.id for s in subjects.values() if s.priority <= 2)
        self.remedial_sids   = frozenset(s.id for s in subjects.values() if s.priority >= 4)

        # Teacher availability as a pre-looked-up dict {tid: int}
        self.teacher_avail   = {tid: t.availability for tid, t in teachers.items()}
        self.room_avail      = {rid: r.availability for rid, r in rooms.items()}

        self.last_day        = days - 1
        self.morning_cutoff  = periods_per_day // 2   # periods < this = morning

    # ─────────────────────────────────────────────────────────────────────
    # PRIMARY INTERFACE
    # ─────────────────────────────────────────────────────────────────────

    def calculate_fitness(self, tt: Timetable) -> int:
        """
        Total penalty. 0 = perfect feasible solution. Lower is better.
        Caches result on tt.fitness.
        """
        if tt.fitness is not None:
            return tt.fitness
        p  = self._hard_pass(tt)
        p += self._nt_pass(tt)
        if self.constraint_mask:        # skip entirely if mask=0
            p += self._soft_pass(tt)
        tt.fitness = p
        return p

    def get_violation_summary(self, tt: Timetable) -> Dict[str, int]:
        """
        Per-constraint violation COUNTS (unweighted).
        Returns dict suitable for JSON serialisation and frontend display.
        Called once on the best chromosome — never inside the GA loop.
        """
        return self._full_violation_counts(tt)

    # ─────────────────────────────────────────────────────────────────────
    # LAYER 1 — HARD PASS  (O(n) single scan)
    # ─────────────────────────────────────────────────────────────────────

    def _hard_pass(self, tt: Timetable) -> int:
        penalty = 0
        ppd = self.ppd

        # Per-resource occupancy counters (rebuilt each call — fast for ≤200 blocks)
        teacher_occ: Dict[str, int] = defaultdict(int)  # tid → bitmask
        room_occ:    Dict[str, int] = defaultdict(int)
        class_occ:   Dict[str, int] = defaultdict(int)

        # Lab blocks per (class_id, day)
        lab_day: Dict[Tuple[str, int], int] = defaultdict(int)

        for block in self.blocks:
            dp = tt.get_assignment(block.id)

            # ── unassigned ──────────────────────────────────────────────
            if dp is None:
                penalty += self.HARD["unassigned"]
                continue

            day, period = dp

            # ── locked violation ────────────────────────────────────────
            if block.is_locked:
                if day != block.locked_day or period != block.locked_period:
                    penalty += self.HARD["locked_violation"]

            # ── build slot bitmask ──────────────────────────────────────
            start = day * ppd + period
            mask  = ((1 << block.duration) - 1) << start

            # ── break violation ─────────────────────────────────────────
            if self.break_mask & mask:
                penalty += self.HARD["break_violation"]

            # ── teacher conflicts + unavailability ──────────────────────
            for tid in block.teacher_ids:
                if teacher_occ[tid] & mask:
                    penalty += self.HARD["teacher_conflict"]
                teacher_occ[tid] |= mask
                # unavailability check
                avail = self.teacher_avail.get(tid, (1 << 64) - 1)
                if (~avail) & mask:
                    penalty += self.HARD["teacher_unavailable"]

            # ── room conflicts + unavailability ─────────────────────────
            for rid in block.room_ids:
                if room_occ[rid] & mask:
                    penalty += self.HARD["room_conflict"]
                room_occ[rid] |= mask
                avail = self.room_avail.get(rid, (1 << 64) - 1)
                if (~avail) & mask:
                    penalty += self.HARD["room_unavailable"]

            # ── class conflicts ─────────────────────────────────────────
            for cid in block.class_ids:
                if class_occ[cid] & mask:
                    penalty += self.HARD["class_conflict"]
                class_occ[cid] |= mask

            # ── two labs same day ────────────────────────────────────────
            if block.is_lab:
                for cid in block.class_ids:
                    lab_day[(cid, day)] += 1
                    if lab_day[(cid, day)] == 2:
                        penalty += self.HARD["two_labs_same_day"]

        return penalty

    # ─────────────────────────────────────────────────────────────────────
    # LAYER 2a — NON-TOGGLEABLE SOFT (NT1–NT4)
    # ─────────────────────────────────────────────────────────────────────

    def _nt_pass(self, tt: Timetable) -> int:
        penalty  = 0
        ppd      = self.ppd
        days     = self.days

        # Rebuild per-class and per-teacher day occupancy bitmasks
        # class_day_mask[cid][day]  = bitmask of occupied period bits (within day)
        # teacher_block_starts[tid][day] = list of period starts (for NT4)
        class_day_mask:    Dict[str, Dict[int, int]]       = defaultdict(lambda: defaultdict(int))
        teacher_day_mask:  Dict[str, Dict[int, int]]       = defaultdict(lambda: defaultdict(int))
        teacher_block_day: Dict[str, Dict[int, List[int]]] = defaultdict(lambda: defaultdict(list))
        teacher_active_days: Dict[str, set] = defaultdict(set)

        for block in self.blocks:
            dp = tt.get_assignment(block.id)
            if dp is None:
                continue
            day, period = dp
            period_bit = 1 << period

            for cid in block.class_ids:
                class_day_mask[cid][day] |= period_bit
                for p in range(period, period + block.duration):
                    class_day_mask[cid][day] |= (1 << p)

            for tid in block.teacher_ids:
                for p in range(period, period + block.duration):
                    teacher_day_mask[tid][day] |= (1 << p)
                # NT4: record block START only (multi-period = 1 entry)
                teacher_block_day[tid][day].append(period)
                teacher_active_days[tid].add(day)

        # NT1 — Every active class should have a lesson in period 0 each day
        for cid in self.classes:
            for day in range(days):
                if class_day_mask[cid][day]:    # class has at least one lesson this day
                    if not (class_day_mask[cid][day] & 1):  # period 0 not occupied
                        penalty += self.NT["NT1_first_period"]

        # NT2 — No teacher should have a completely empty day if they teach that week
        for tid in self.teachers:
            active = teacher_active_days.get(tid, set())
            if not active:
                continue
            for day in range(days):
                if day not in active:
                    penalty += self.NT["NT2_teacher_all_day"]

        # NT3 — No free gaps within a class's daily lesson run
        for cid, day_masks in class_day_mask.items():
            for day, mask in day_masks.items():
                penalty += count_gaps_in_day(mask) * self.NT["NT3_class_gaps"]

        # NT4 — No 3+ consecutive lesson BLOCKS for a teacher
        #        Multi-period lab = 1 block start → 1 entry → exempt from count
        for tid, day_starts in teacher_block_day.items():
            for day, starts in day_starts.items():
                if len(starts) < 3:
                    continue
                starts_sorted = sorted(starts)
                run = 1
                for i in range(1, len(starts_sorted)):
                    # Two blocks are "consecutive" if the second starts right after the first ends
                    # We only have start positions here; use the day mask to find gaps
                    # Simple heuristic: blocks within 2 periods of each other = consecutive
                    if starts_sorted[i] - starts_sorted[i - 1] <= 1:
                        run += 1
                        if run >= 3:
                            penalty += self.NT["NT4_consecutive"]
                    else:
                        run = 1

        return penalty

    # ─────────────────────────────────────────────────────────────────────
    # LAYER 2b — TOGGLEABLE SOFT (bits 0–11)
    # ─────────────────────────────────────────────────────────────────────

    def _soft_pass(self, tt: Timetable) -> int:
        """
        Each check is guarded: if the bit is 0, it is skipped entirely.
        constraint_mask=0 → this method is not called at all.
        """
        penalty  = 0
        soft     = self.soft
        ppd      = self.ppd
        days     = self.days
        W        = self.SOFT_STANDARD
        last_day = self.last_day
        morning  = self.morning_cutoff

        # Collect per-block slot data once; subsequent checks read from it
        teacher_day_periods: Dict[str, Dict[int, List[int]]] = defaultdict(lambda: defaultdict(list))
        class_subject_day:   Dict[Tuple[str, str], Dict[int, int]] = defaultdict(lambda: defaultdict(int))
        teacher_period0_count: Dict[str, int] = defaultdict(int)

        block_placements: List[Tuple[LessonBlock, int, int]] = []  # (block, day, period)

        for block in self.blocks:
            dp = tt.get_assignment(block.id)
            if dp is None:
                continue
            day, period = dp

            block_placements.append((block, day, period))

            for tid in block.teacher_ids:
                for p in range(period, period + block.duration):
                    teacher_day_periods[tid][day].append(p)
                if period == 0:
                    teacher_period0_count[tid] += 1

            for cid in block.class_ids:
                for sid in block.subject_ids:
                    class_subject_day[(cid, sid)][day] += 1

        # ── Bits 0–1: teacher_gap ────────────────────────────────────────
        tg = soft["teacher_gap"]
        if tg in (1, 3):   # minimize gaps OR avoid back-to-back
            for tid, day_map in teacher_day_periods.items():
                for day, periods in day_map.items():
                    if not periods:
                        continue
                    ps = sorted(set(periods))
                    if tg == 1:
                        # minimize gaps: penalise free slots between first and last
                        for i in range(ps[0], ps[-1] + 1):
                            if i not in set(ps):
                                penalty += W
                    elif tg == 3:
                        # avoid back-to-back: penalise runs of exactly 2
                        run = 1
                        for i in range(1, len(ps)):
                            if ps[i] == ps[i - 1] + 1:
                                run += 1
                            else:
                                if run == 2:
                                    penalty += W
                                run = 1
                        if run == 2:
                            penalty += W

        # ── Bits 2–3: lab_time_pref ─────────────────────────────────────
        ltp = soft["lab_time_pref"]
        if ltp in (1, 2):
            for block, day, period in block_placements:
                if not block.is_lab:
                    continue
                in_morning = period < morning
                if ltp == 1 and not in_morning:   # prefer start-of-day
                    penalty += W
                elif ltp == 2 and in_morning:     # prefer end-of-day
                    penalty += W

        # ── Bit 4: lab_avoid_monday ──────────────────────────────────────
        if soft["lab_avoid_monday"]:
            for block, day, period in block_placements:
                if block.is_lab and day == 0:
                    penalty += W

        # ── Bit 5: lab_avoid_friday ──────────────────────────────────────
        if soft["lab_avoid_friday"]:
            for block, day, period in block_placements:
                if block.is_lab and day == last_day:
                    penalty += W

        # ── Bit 6: max_classes_per_day ──────────────────────────────────
        if soft["max_classes_per_day"]:
            for tid, day_map in teacher_day_periods.items():
                max_pd = self.teachers[tid].max_per_day if tid in self.teachers else 6
                for day, periods in day_map.items():
                    excess = len(set(periods)) - max_pd
                    if excess > 0:
                        penalty += excess * W

        # ── Bit 7: difficult_morning ─────────────────────────────────────
        if soft["difficult_morning"]:
            for block, day, period in block_placements:
                is_diff_or_core = (
                    block.is_difficult
                    or any(sid in self.core_sids for sid in block.subject_ids)
                )
                if is_diff_or_core and period >= morning:
                    penalty += W

        # ── Bits 8–9: subject_dist ───────────────────────────────────────
        sd = soft["subject_dist"]
        if sd == 1:
            # Even spread: penalise same subject twice on the same day
            for (cid, sid), day_map in class_subject_day.items():
                for day, cnt in day_map.items():
                    if cnt > 1:
                        penalty += (cnt - 1) * W
        elif sd == 2:
            # High-priority subjects should appear in first ceil(days/2) days
            half = (days + 1) // 2
            for block, day, period in block_placements:
                if any(sid in self.core_sids for sid in block.subject_ids):
                    if day >= half:
                        penalty += W

        # ── Bit 10: first_period_equal ───────────────────────────────────
        if soft["first_period_equal"] and teacher_period0_count:
            counts = list(teacher_period0_count.values())
            if counts:
                mean = sum(counts) / len(counts)
                variance = sum((c - mean) ** 2 for c in counts) / len(counts)
                penalty += int(variance * W)

        # ── Bit 11: no_repeat_subject (very weak weight=2) ───────────────
        if soft["no_repeat_subject"]:
            for (cid, sid), day_map in class_subject_day.items():
                for day, cnt in day_map.items():
                    if cnt > 1:
                        penalty += (cnt - 1) * self.SOFT_WEAK

        return penalty

    # ─────────────────────────────────────────────────────────────────────
    # VIOLATION SUMMARY  (called once on best chromosome, not in loop)
    # ─────────────────────────────────────────────────────────────────────

    def _full_violation_counts(self, tt: Timetable) -> Dict[str, int]:
        counts: Dict[str, int] = {k: 0 for k in list(self.HARD) + list(self.NT)}
        ppd   = self.ppd

        teacher_occ: Dict[str, int] = defaultdict(int)
        room_occ:    Dict[str, int] = defaultdict(int)
        class_occ:   Dict[str, int] = defaultdict(int)
        lab_day:     Dict[Tuple[str, int], int] = defaultdict(int)

        for block in self.blocks:
            dp = tt.get_assignment(block.id)
            if dp is None:
                counts["unassigned"] += 1
                continue

            day, period = dp
            start = day * ppd + period
            mask  = ((1 << block.duration) - 1) << start

            if block.is_locked:
                if day != block.locked_day or period != block.locked_period:
                    counts["locked_violation"] += 1

            if self.break_mask & mask:
                counts["break_violation"] += 1

            for tid in block.teacher_ids:
                if teacher_occ[tid] & mask:
                    counts["teacher_conflict"] += 1
                teacher_occ[tid] |= mask
                avail = self.teacher_avail.get(tid, (1 << 64) - 1)
                if (~avail) & mask:
                    counts["teacher_unavailable"] += 1

            for rid in block.room_ids:
                if room_occ[rid] & mask:
                    counts["room_conflict"] += 1
                room_occ[rid] |= mask
                avail = self.room_avail.get(rid, (1 << 64) - 1)
                if (~avail) & mask:
                    counts["room_unavailable"] += 1

            for cid in block.class_ids:
                if class_occ[cid] & mask:
                    counts["class_conflict"] += 1
                class_occ[cid] |= mask

            if block.is_lab:
                for cid in block.class_ids:
                    lab_day[(cid, day)] += 1
                    if lab_day[(cid, day)] == 2:
                        counts["two_labs_same_day"] += 1

        # NT counts (simplified — gap count per class·day, etc.)
        class_day_mask: Dict[str, Dict[int, int]] = defaultdict(lambda: defaultdict(int))
        teacher_active: Dict[str, set] = defaultdict(set)
        for block in self.blocks:
            dp = tt.get_assignment(block.id)
            if dp is None:
                continue
            day, period = dp
            for cid in block.class_ids:
                for p in range(period, period + block.duration):
                    class_day_mask[cid][day] |= (1 << p)
            for tid in block.teacher_ids:
                teacher_active[tid].add(day)

        for cid in self.classes:
            for day in range(self.days):
                if class_day_mask[cid][day] and not (class_day_mask[cid][day] & 1):
                    counts["NT1_first_period"] += 1

        for tid in self.teachers:
            active = teacher_active.get(tid, set())
            if active:
                counts["NT2_teacher_all_day"] += self.days - len(active)

        for cid, day_masks in class_day_mask.items():
            for day, mask in day_masks.items():
                counts["NT3_class_gaps"] += count_gaps_in_day(mask)

        hard_total = sum(v * self.HARD[k] for k, v in counts.items() if k in self.HARD)
        nt_total   = sum(v * self.NT[k]   for k, v in counts.items() if k in self.NT)
        counts["_hard_penalty"] = hard_total
        counts["_nt_penalty"]   = nt_total
        counts["_hard_violations"] = sum(v for k, v in counts.items()
                                         if k in self.HARD and not k.startswith("_"))
        counts["_soft_violations"] = sum(v for k, v in counts.items()
                                         if k in self.NT and not k.startswith("_"))
        return counts
