"""
structures.py
=============
Pure dataclasses and the bitmask timetable engine.
Zero business logic — only data containers and the Timetable bitmask engine.

Slot index convention (used everywhere):
    slot_index = day * periods_per_day + period
    Maximum supported: 64 slots (fits in a Python int used as a 64-bit mask).

Availability mask convention (Teacher, Room):
    bit i = 1  →  available at slot i
    bit i = 0  →  unavailable / blocked

Break mask (Break.mask):
    bit i = 1  →  slot i IS a break (lessons forbidden)
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Union


# ─────────────────────────────────────────────────────────────────────────────
# SLOT HELPERS  (module-level, import-safe)
# ─────────────────────────────────────────────────────────────────────────────

def slot_index(day: int, period: int, ppd: int) -> int:
    return day * ppd + period

def slot_to_day_period(slot: int, ppd: int) -> Tuple[int, int]:
    return divmod(slot, ppd)

def block_bitmask(start_slot: int, duration: int) -> int:
    """Bitmask for a block starting at start_slot with given duration."""
    return ((1 << duration) - 1) << start_slot

def make_break_mask(period: int, days: int, ppd: int) -> int:
    """Block a single period on every day."""
    mask = 0
    for d in range(days):
        mask |= 1 << (d * ppd + period)
    return mask

def make_multi_break_mask(periods: List[int], days: int, ppd: int) -> int:
    """Block multiple periods on every day."""
    mask = 0
    for p in periods:
        mask |= make_break_mask(p, days, ppd)
    return mask

def make_daily_break_mask(ppd: int, daily_breaks: Dict[int, List[int]]) -> int:
    """
    Block different periods on different days.
    daily_breaks: {day_index: [period_indices...]}
    """
    mask = 0
    for day, periods in daily_breaks.items():
        for p in periods:
            mask |= (1 << (day * ppd + p))
    return mask

def decode_daily_masks(daily_masks: List[int], ppd: int) -> int:
    """
    Convert a list of daily bitmasks (e.g. from a DB/Frontend) into a single 64-bit global mask.
    bit i = 1 in daily_masks[d] -> bit (d*ppd + i) = 1 in the result.
    """
    global_mask = 0
    for d, day_mask in enumerate(daily_masks):
        for p in range(ppd):
            if day_mask & (1 << p):
                global_mask |= (1 << (d * ppd + p))
    return global_mask

def count_gaps_in_day(day_mask: int) -> int:
    """
    Number of free period slots between the first and last occupied slot
    within a single day's occupancy bitmask.
    """
    if not day_mask:
        return 0
    first = (day_mask & -day_mask).bit_length() - 1
    last  = day_mask.bit_length() - 1
    span  = ((1 << (last - first + 1)) - 1) << first
    return (span & ~day_mask).bit_count()


# ─────────────────────────────────────────────────────────────────────────────
# CORE ENTITY DATACLASSES
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Teacher:
    """
    id            String ID (UUID from DB or short code).
    name          Full display name.
    short_name    2–4 char abbreviation for timetable cells.
    availability  40-bit mask (5d × 8p default). bit i=1 → available.
                  Default: all bits set = fully available.
    max_per_day   Maximum lesson blocks per day (soft constraint reference).
    max_per_week  Maximum lesson blocks per week (pre-flight reference).
    """
    id:           str
    name:         str
    short_name:   str = "X"
    availability: int = field(default_factory=lambda: (1 << 64) - 1)
    max_per_day:  int = 6
    max_per_week: int = 30

    def __post_init__(self):
        if not self.short_name:
            self.short_name = self.name[:4].upper()


@dataclass
class Subject:
    """
    priority  1 = highest importance (core), 5 = lowest (elective/remedial).
    """
    id:           str
    name:         str
    short_name:   str = "X"
    is_lab:       bool = False
    is_difficult: bool = False
    priority:     int  = 3        # 1 (core) – 5 (elective)

    def __post_init__(self):
        if not self.short_name:
            self.short_name = self.id


@dataclass
class Room:
    id:           str
    name:         str
    capacity:     int  = 40
    is_lab:       bool = False
    availability: int  = field(default_factory=lambda: (1 << 64) - 1)


@dataclass
class Class:
    id:         str
    name:       str
    short_name: str = "X"

    def __post_init__(self):
        if not self.short_name:
            self.short_name = self.name[:6]


@dataclass
class Break:
    """
    Encodes all break slots for the institution.
    mask: bit i = 1 means slot i is a break (lessons forbidden).

    Build with:
        Break("Lunch", mask=make_break_mask(period=3, days=5, ppd=8))
    or:
        Break("Breaks", mask=make_multi_break_mask([3, 6], days=5, ppd=8))
    """
    name: str
    mask: int = 0


# ─────────────────────────────────────────────────────────────────────────────
# LESSON BLOCK  — the atomic scheduling unit / gene carrier
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class LessonBlock:
    """
    One row in the final timetable. One gene in the chromosome.

    id              Unique string (UUID from DB).
    teacher_ids     Co-teaching: list ≥1 teacher ids.
    subject_ids     Combined block: list ≥1 subject ids (usually 1).
    class_ids       Merged sections: list ≥1 class ids.
    room_ids        Split-room / lab+theory: list ≥1 room ids.
    duration        Periods occupied (1 = single, 2 = double, 3 = triple).
    is_locked       If True, block is pinned to locked_day / locked_period.
                    locked_day and locked_period MUST be set.
                    Locked blocks are never touched by GA operators.
    is_lab          Convenience flag — mirrors subject is_lab; used in
                    fitness without subject lookup.
    is_difficult    Convenience flag — mirrors subject is_difficult.
    subject_name    Denormalised display string for the timetable cell.
    """
    id:           str
    teacher_ids:  List[str]
    subject_ids:  List[str]
    class_ids:    List[str]
    room_ids:     List[str]
    duration:     int  = 1
    is_locked:    bool = False
    locked_day:   Optional[int] = None   # 0-indexed day
    locked_period: Optional[int] = None  # 0-indexed period within day
    is_lab:       bool = False
    is_difficult: bool = False
    subject_name: str  = ""

    # ── backward-compat shims ────────────────────────────────────────────
    @property
    def teacher_id(self) -> Optional[str]:
        return self.teacher_ids[0] if self.teacher_ids else None

    @property
    def subject_id(self) -> Optional[str]:
        return self.subject_ids[0] if self.subject_ids else None

    @property
    def class_id(self) -> Optional[str]:
        return self.class_ids[0] if self.class_ids else None

    @property
    def room_id(self) -> Optional[str]:
        return self.room_ids[0] if self.room_ids else None

    @property
    def locked_slot(self) -> Optional[int]:
        """Global slot index for locked blocks. None if not locked."""
        if self.is_locked and self.locked_day is not None and self.locked_period is not None:
            # ppd not available here — caller must compute externally
            return None   # use locked_day / locked_period directly
        return None


# ─────────────────────────────────────────────────────────────────────────────
# TIMETABLE  — the chromosome
# ─────────────────────────────────────────────────────────────────────────────

class Timetable:
    """
    A chromosome in the GA population.

    assignments     {block_id: (day, start_period)}
                    Locked blocks are pre-seeded and never modified.

    Bitmask occupancy masks (teacher_mask, room_mask, class_mask):
        key   → resource id (str)
        value → 64-bit occupancy integer; bit i=1 means slot i is occupied

    fitness         Cached penalty score (lower = better; 0 = perfect).
                    Set to None whenever assignments change.
    """

    __slots__ = (
        "days", "periods_per_day", "break_mask", "locked_lessons",
        "assignments",
        "teacher_mask", "room_mask", "class_mask",
        "fitness",
    )

    def __init__(
        self,
        days:            int,
        periods_per_day: int,
        break_mask:      int = 0,
        locked_lessons:  Optional[List[LessonBlock]] = None,
    ):
        self.days            = days
        self.periods_per_day = periods_per_day
        self.break_mask      = break_mask

        self.assignments: Dict[str, Tuple[int, int]] = {}  # id → (day, period)
        self.teacher_mask: Dict[str, int] = defaultdict(int)
        self.room_mask:    Dict[str, int] = defaultdict(int)
        self.class_mask:   Dict[str, int] = defaultdict(int)
        self.fitness:      Optional[int]  = None

        self.locked_lessons = locked_lessons or []
        self._init_locked()

    # ── internal helpers ─────────────────────────────────────────────────

    def _bitmask(self, day: int, period: int, duration: int) -> int:
        start = day * self.periods_per_day + period
        return block_bitmask(start, duration)

    def _apply_mask(self, lesson: LessonBlock, day: int, period: int, add: bool):
        mask = self._bitmask(day, period, lesson.duration)
        if add:
            for tid in lesson.teacher_ids:  self.teacher_mask[tid] |= mask
            for cid in lesson.class_ids:    self.class_mask[cid]   |= mask
            for rid in lesson.room_ids:     self.room_mask[rid]    |= mask
        else:
            inv = ~mask
            for tid in lesson.teacher_ids:  self.teacher_mask[tid] &= inv
            for cid in lesson.class_ids:    self.class_mask[cid]   &= inv
            for rid in lesson.room_ids:     self.room_mask[rid]    &= inv

    def _init_locked(self):
        for lesson in self.locked_lessons:
            if (lesson.is_locked
                    and lesson.locked_day is not None
                    and lesson.locked_period is not None):
                self.assign(lesson, lesson.locked_day, lesson.locked_period)

    # ── read ─────────────────────────────────────────────────────────────

    def get_assignment(self, lesson_id: str) -> Optional[Tuple[int, int]]:
        """Returns (day, period) or None."""
        return self.assignments.get(lesson_id)

    def is_break_slot(self, day: int, period: int) -> bool:
        idx = day * self.periods_per_day + period
        return bool(self.break_mask & (1 << idx))

    # ── feasibility checks ───────────────────────────────────────────────

    def can_place(self, lesson: LessonBlock, day: int, period: int) -> bool:
        """
        Structural validity only (bounds + no day-wrap + no break).
        Does NOT check resource conflicts — use the mask checks for that.
        """
        if day < 0 or day >= self.days:
            return False
        if period < 0 or period + lesson.duration > self.periods_per_day:
            return False
        # Check each period for break
        for p in range(period, period + lesson.duration):
            if self.is_break_slot(day, p):
                return False
        return True

    def are_teachers_free(self, teacher_ids: List[str], day: int, period: int, duration: int) -> bool:
        mask = self._bitmask(day, period, duration)
        return all(not (self.teacher_mask[tid] & mask) for tid in teacher_ids)

    def are_rooms_free(self, room_ids: List[str], day: int, period: int, duration: int) -> bool:
        mask = self._bitmask(day, period, duration)
        return all(not (self.room_mask[rid] & mask) for rid in room_ids)

    def are_classes_free(self, class_ids: List[str], day: int, period: int, duration: int) -> bool:
        mask = self._bitmask(day, period, duration)
        return all(not (self.class_mask[cid] & mask) for cid in class_ids)

    def is_slot_free(self, lesson: LessonBlock, day: int, period: int) -> bool:
        """Full check: structural + all resource conflicts."""
        return (
            self.can_place(lesson, day, period)
            and self.are_teachers_free(lesson.teacher_ids, day, period, lesson.duration)
            and self.are_rooms_free(lesson.room_ids, day, period, lesson.duration)
            and self.are_classes_free(lesson.class_ids, day, period, lesson.duration)
        )

    # ── write ─────────────────────────────────────────────────────────────

    def assign(self, lesson: LessonBlock, day: int, period: int):
        """Assign lesson to (day, period). Removes previous assignment first."""
        old = self.assignments.get(lesson.id)
        if old:
            self._apply_mask(lesson, old[0], old[1], False)
        self.assignments[lesson.id] = (day, period)
        self._apply_mask(lesson, day, period, True)
        self.fitness = None

    def unassign(self, lesson: LessonBlock):
        old = self.assignments.pop(lesson.id, None)
        if old:
            self._apply_mask(lesson, old[0], old[1], False)
            self.fitness = None

    def copy(self) -> "Timetable":
        """Shallow-copy chromosome for elitism / crossover child seeding."""
        tt = Timetable(
            self.days, self.periods_per_day,
            self.break_mask, self.locked_lessons,
        )
        # Copy occupancy masks
        tt.teacher_mask = defaultdict(int, self.teacher_mask)
        tt.room_mask    = defaultdict(int, self.room_mask)
        tt.class_mask   = defaultdict(int, self.class_mask)
        tt.assignments  = dict(self.assignments)
        tt.fitness      = self.fitness
        return tt


# ─────────────────────────────────────────────────────────────────────────────
# LOCKED LESSON BUILDER  — fluent API for pinned lessons
# ─────────────────────────────────────────────────────────────────────────────

def _as_list(x: Union[str, List[str]]) -> List[str]:
    return [x] if isinstance(x, str) else list(x)


@dataclass
class LockedLessonConfig:
    subject_id:   str
    subject_name: str
    teacher_ids:  List[str]
    class_ids:    List[str]
    room_ids:     List[str]
    day:          int
    period:       int
    duration:     int = 1
    is_lab:       bool = False
    description:  str = ""


class LockedLessonBuilder:
    """
    Fluent builder for admin-pinned lesson blocks.

    Usage:
        builder = LockedLessonBuilder()
        builder.add(
            subject_id="ASSEMBLY", subject_name="Assembly",
            teacher_ids="T01", class_ids="C_S2", room_ids="HALL",
            day=0, period=0,
        )
        builder.add_for_each_class(
            subject_id="LIBRARY", subject_name="Library",
            teacher_ids="T10",
            class_ids=["C_S2", "C_S4"],
            room_ids="LIB",
            day=4, period=6,
        )
        subjects.update(builder.get_subjects())
        lesson_blocks.extend(builder.build(id_gen))
    """

    def __init__(self):
        self._configs: List[LockedLessonConfig] = []

    def add(
        self,
        subject_id:   str,
        subject_name: str,
        teacher_ids:  Union[str, List[str]],
        class_ids:    Union[str, List[str]],
        room_ids:     Union[str, List[str]],
        day:          int,
        period:       int,
        duration:     int = 1,
        is_lab:       bool = False,
        description:  str = "",
    ) -> "LockedLessonBuilder":
        self._configs.append(LockedLessonConfig(
            subject_id   = subject_id,
            subject_name = subject_name,
            teacher_ids  = _as_list(teacher_ids),
            class_ids    = _as_list(class_ids),
            room_ids     = _as_list(room_ids),
            day          = day,
            period       = period,
            duration     = duration,
            is_lab       = is_lab,
            description  = description,
        ))
        return self

    def add_for_each_class(
        self,
        subject_id:   str,
        subject_name: str,
        teacher_ids:  Union[str, List[str]],
        class_ids:    List[str],
        room_ids:     Union[str, List[str]],
        day:          int,
        period:       int,
        duration:     int = 1,
        is_lab:       bool = False,
        description:  str = "",
    ) -> "LockedLessonBuilder":
        for cid in class_ids:
            self.add(
                subject_id=subject_id, subject_name=subject_name,
                teacher_ids=teacher_ids, class_ids=cid, room_ids=room_ids,
                day=day, period=period, duration=duration,
                is_lab=is_lab,
                description=f"{description} [{cid}]".strip(),
            )
        return self

    def build(self, id_gen) -> List[LessonBlock]:
        blocks = []
        for cfg in self._configs:
            blocks.append(LessonBlock(
                id           = id_gen(),
                teacher_ids  = cfg.teacher_ids,
                subject_ids  = [cfg.subject_id],
                class_ids    = cfg.class_ids,
                room_ids     = cfg.room_ids,
                duration     = cfg.duration,
                is_locked    = True,
                locked_day   = cfg.day,
                locked_period= cfg.period,
                is_lab       = cfg.is_lab,
                subject_name = cfg.subject_name,
            ))
        return blocks

    def get_subjects(self) -> Dict[str, Subject]:
        out: Dict[str, Subject] = {}
        for cfg in self._configs:
            if cfg.subject_id not in out:
                out[cfg.subject_id] = Subject(
                    id=cfg.subject_id, name=cfg.subject_name,
                    is_lab=cfg.is_lab, priority=5,
                )
        return out

    def print_summary(self):
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        print("\nLocked lessons:")
        for cfg in self._configs:
            d = day_names[cfg.day] if cfg.day < len(day_names) else str(cfg.day)
            print(
                f"  [LOCKED] {cfg.subject_name:25s} | "
                f"classes:[{', '.join(cfg.class_ids)}] | "
                f"{d} P{cfg.period + 1} dur={cfg.duration} | "
                f"teachers:[{', '.join(cfg.teacher_ids)}] "
                f"rooms:[{', '.join(cfg.room_ids)}]"
                + (f" — {cfg.description}" if cfg.description else "")
            )
        print()

    # ── backward-compat aliases ──────────────────────────────────────────
    def add_weekly_event(self, subject_id, subject_name, teacher_id,
                         class_id, room_id, day, period, duration=1, description=""):
        return self.add(subject_id, subject_name, teacher_ids=teacher_id,
                        class_ids=class_id, room_ids=room_id,
                        day=day, period=period, duration=duration, description=description)

    def add_class_event_for_all(self, subject_id, subject_name, teacher_id,
                                classes, room_id, day, period, duration=1, description=""):
        return self.add_for_each_class(subject_id, subject_name,
                                       teacher_ids=teacher_id, class_ids=classes,
                                       room_ids=room_id, day=day, period=period,
                                       duration=duration, description=description)

    def build_lesson_blocks(self, id_gen) -> List[LessonBlock]:
        return self.build(id_gen)

    def get_locked_subjects(self) -> Dict[str, Subject]:
        return self.get_subjects()
