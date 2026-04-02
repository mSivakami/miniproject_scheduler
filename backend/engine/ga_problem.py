"""
ga_problem.py — GA Problem Representation & Bitmask Utilities
==============================================================
Converts the high-level domain structures (Teacher, Subject, Room,
LessonBlock) into flat integer-indexed arrays suitable for the GA engine.

Bitmask convention (CRITICAL — must match everywhere):
  slot_index = day * periods_per_day + period   (both 0-indexed)
  bit N of a uint64 = slot N
  1 = slot is AVAILABLE / OCCUPIED (context-dependent)

  working_mask  : 1 = slot is a working slot (not a break, not weekend)
  break_mask    : 1 = slot is a break (mutually exclusive with working_mask bits)
  teacher.available_mask : 1 = teacher available at this slot
  teacher_used  : 1 = teacher has a lesson at this slot (runtime tracking)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional
from structures import Teacher, Subject, Room, Class, LessonBlock


# ──────────────────────────────────────────────────────────────────────────────
# Institution Settings
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class InstitutionSettings:
    """
    Defines the weekly schedule grid.

    days        : working days per week (typically 5 or 6)
    periods     : periods per day (typically 6–9)
    break_slots : list of (day, period) tuples marking break slots (0-indexed)
                  These slots cannot be assigned any lesson.

    Computed:
      total_slots   = days * periods
      working_mask  : uint64 with 1 at every non-break slot
      break_mask    : uint64 with 1 at every break slot
    """
    days:           int
    periods:        int
    break_slots:    List[Tuple[int, int]] = field(default_factory=list)

    # Derived
    total_slots:  int   = field(init=False)
    working_mask: int   = field(init=False)
    break_mask:   int   = field(init=False)

    def __post_init__(self):
        self.total_slots = self.days * self.periods
        if self.total_slots > 64:
            raise ValueError(
                f"total_slots={self.total_slots} exceeds uint64 capacity (max 64). "
                f"Reduce days ({self.days}) or periods ({self.periods})."
            )

        self.break_mask   = 0
        self.working_mask = 0

        for day in range(self.days):
            for period in range(self.periods):
                slot = day * self.periods + period
                bit  = 1 << slot
                if (day, period) in self.break_slots or (day, period) in [s for s in self.break_slots]:
                    self.break_mask |= bit
                else:
                    self.working_mask |= bit

    @classmethod
    def standard_5x8(cls, break_period: int = 4) -> "InstitutionSettings":
        """5 working days, 8 periods, one break period per day."""
        breaks = [(d, break_period) for d in range(5)]
        return cls(days=5, periods=8, break_slots=breaks)

    @classmethod
    def standard_5x7(cls) -> "InstitutionSettings":
        """5 working days, 7 periods, no built-in breaks."""
        return cls(days=5, periods=7)

    def slot_to_day_period(self, slot: int) -> Tuple[int, int]:
        return divmod(slot, self.periods)

    def day_period_to_slot(self, day: int, period: int) -> int:
        return day * self.periods + period

    def is_working_slot(self, day: int, period: int) -> bool:
        slot = self.day_period_to_slot(day, period)
        return bool(self.working_mask & (1 << slot))

    def working_slots_for_duration(self, duration: int) -> List[Tuple[int, int]]:
        """
        Returns all (day, start_period) pairs where a block of `duration`
        consecutive periods can be placed (no breaks, fits in day).
        """
        valid = []
        for day in range(self.days):
            for start in range(self.periods - duration + 1):
                ok = all(
                    self.is_working_slot(day, start + off)
                    for off in range(duration)
                )
                if ok:
                    valid.append((day, start))
        return valid


# ──────────────────────────────────────────────────────────────────────────────
# Flat Problem Representation (GA-internal)
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class FlatTeacher:
    id:             str
    index:          int
    available_mask: int
    max_per_day:    int
    max_per_week:   int


@dataclass
class FlatRoom:
    id:             str
    index:          int
    is_lab:         bool
    available_mask: int


@dataclass
class FlatClass:
    id:    str
    index: int


@dataclass
class FlatBlock:
    """Flat representation of a LessonBlock — all IDs resolved to indices."""
    id:                str
    index:             int
    duration:          int          # 1, 2, or 3
    count:             int          # occurrences per week
    is_locked:         bool
    locked_day:        int          # 0-indexed
    locked_period:     int          # 0-indexed
    is_lab:            bool
    is_difficult:      bool
    teacher_indices:   List[int]
    room_indices:      List[int]
    class_indices:     List[int]
    subject_id:        str
    subject_name:      str


@dataclass
class ProblemData:
    """
    Complete flat problem representation ready for GA consumption.

    All references are by integer index into the respective lists.
    This structure is built once and passed to all GA functions.
    """
    settings:     InstitutionSettings
    teachers:     List[FlatTeacher]
    rooms:        List[FlatRoom]
    classes:      List[FlatClass]
    blocks:       List[FlatBlock]

    # Original domain objects (for display/export)
    orig_teachers:  Dict[str, Teacher]  = field(default_factory=dict)
    orig_rooms:     Dict[str, Room]     = field(default_factory=dict)
    orig_classes:   Dict[str, Class]    = field(default_factory=dict)
    orig_subjects:  Dict[str, Subject]  = field(default_factory=dict)

    # Derived
    gene_count:     int = field(init=False)

    def __post_init__(self):
        self.gene_count = sum(b.count for b in self.blocks)

    @property
    def days(self) -> int:
        return self.settings.days

    @property
    def periods(self) -> int:
        return self.settings.periods

    @property
    def working_mask(self) -> int:
        return self.settings.working_mask

    @property
    def break_mask(self) -> int:
        return self.settings.break_mask


def build_problem_data(
    teachers:      Dict[str, Teacher],
    subjects:      Dict[str, Subject],
    rooms:         Dict[str, Room],
    classes:       Dict[str, Class],
    lesson_blocks: List[LessonBlock],
    settings:      InstitutionSettings,
) -> ProblemData:
    """
    Convert domain objects into a flat ProblemData for the GA engine.

    Performs validation and index mapping.
    Raises ValueError if references are inconsistent.
    """
    # ── Build index maps ──────────────────────────────────────────────────────
    teacher_idx = {tid: i for i, tid in enumerate(teachers)}
    room_idx    = {rid: i for i, rid in enumerate(rooms)}
    class_idx   = {cid: i for i, cid in enumerate(classes)}
    subject_map = dict(subjects)

    # ── Flat teachers ─────────────────────────────────────────────────────────
    flat_teachers = []
    for i, (tid, t) in enumerate(teachers.items()):
        flat_teachers.append(FlatTeacher(
            id=tid,
            index=i,
            available_mask=t.available_mask,
            max_per_day=t.max_per_day,
            max_per_week=t.max_per_week,
        ))

    # ── Flat rooms ────────────────────────────────────────────────────────────
    flat_rooms = []
    for i, (rid, r) in enumerate(rooms.items()):
        flat_rooms.append(FlatRoom(
            id=rid,
            index=i,
            is_lab=r.is_lab,
            available_mask=r.available_mask,
        ))

    # ── Flat classes ──────────────────────────────────────────────────────────
    flat_classes = []
    for i, (cid, c) in enumerate(classes.items()):
        flat_classes.append(FlatClass(id=cid, index=i))

    # ── Flat blocks ───────────────────────────────────────────────────────────
    flat_blocks = []
    for i, lb in enumerate(lesson_blocks):
        # Resolve teacher IDs → indices
        t_indices = []
        for tid in lb.teacher_ids:
            if tid not in teacher_idx:
                raise ValueError(f"LessonBlock {lb.id}: unknown teacher ID {tid!r}")
            t_indices.append(teacher_idx[tid])

        # Resolve room IDs → indices
        r_indices = []
        for rid in lb.room_ids:
            if rid not in room_idx:
                raise ValueError(f"LessonBlock {lb.id}: unknown room ID {rid!r}")
            r_indices.append(room_idx[rid])

        # Resolve class IDs → indices
        c_indices = []
        for cid in lb.class_ids:
            if cid not in class_idx:
                raise ValueError(f"LessonBlock {lb.id}: unknown class ID {cid!r}")
            c_indices.append(class_idx[cid])

        # Subject metadata
        subj = subject_map.get(lb.subject_id)
        is_lab       = lb.is_lab or (subj.is_lab       if subj else False)
        is_difficult = lb.is_difficult or (subj.is_difficult if subj else False)
        subj_name    = lb.subject_name or (subj.name if subj else lb.subject_id)

        flat_blocks.append(FlatBlock(
            id=lb.id,
            index=i,
            duration=lb.duration,
            count=lb.count,
            is_locked=lb.is_locked,
            locked_day=lb.locked_day,
            locked_period=lb.locked_period,
            is_lab=is_lab,
            is_difficult=is_difficult,
            teacher_indices=t_indices,
            room_indices=r_indices,
            class_indices=c_indices,
            subject_id=lb.subject_id,
            subject_name=subj_name,
        ))

    return ProblemData(
        settings=settings,
        teachers=flat_teachers,
        rooms=flat_rooms,
        classes=flat_classes,
        blocks=flat_blocks,
        orig_teachers=dict(teachers),
        orig_rooms=dict(rooms),
        orig_classes=dict(classes),
        orig_subjects=dict(subjects),
    )


# ──────────────────────────────────────────────────────────────────────────────
# Bitmask Utilities
# ──────────────────────────────────────────────────────────────────────────────

def slot_bit(day: int, period: int, periods_per_day: int) -> int:
    """Return the bitmask bit for a given (day, period)."""
    return 1 << (day * periods_per_day + period)


def mask_for_range(day: int, start_period: int, duration: int, periods_per_day: int) -> int:
    """Return a bitmask covering all periods of a block."""
    mask = 0
    for off in range(duration):
        mask |= slot_bit(day, start_period + off, periods_per_day)
    return mask


def count_bits(mask: int) -> int:
    """Popcount — number of 1 bits."""
    return bin(mask).count('1')


def print_bitmask_grid(mask: int, days: int, periods: int, label: str = ""):
    """Debug utility: print a bitmask as a day × period grid."""
    print(f"\n  {label} bitmask (days={days}, periods={periods}):")
    header = "       " + "".join(f"P{p:<2}" for p in range(periods))
    print(f"  {header}")
    for d in range(days):
        row = f"  Day{d}  "
        for p in range(periods):
            bit = 1 << (d * periods + p)
            row += "1  " if (mask & bit) else ".  "
        print(row)