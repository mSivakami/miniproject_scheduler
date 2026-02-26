from typing import Dict, List, Tuple, Optional, Union
from dataclasses import dataclass, field
from collections import defaultdict

# =========================================================
# BASIC TYPES
# =========================================================

@dataclass
class Teacher:
    id: str
    name: str
    unavailable_slots: List[Tuple[int, int]] = field(default_factory=list)

    def __post_init__(self):
        self._unavailable_set = set(self.unavailable_slots)

    def is_available(self, day: int, period: int) -> bool:
        return (day, period) not in self._unavailable_set

@dataclass
class Subject:
    id: str
    name: str
    is_difficult: bool = False
    is_lab: bool = False
    priority: int = 5

@dataclass
class Room:
    id: str
    name: str
    is_lab: bool = False

@dataclass
class Class:
    id: str
    name: str

@dataclass
class Break:
    name: str

# =========================================================
# TIMESLOT WITH BITMASK
# =========================================================

@dataclass
class TimeSlot:
    day: int
    start_period: int
    duration: int

    def get_periods(self) -> List[int]:
        return list(range(self.start_period, self.start_period + self.duration))

    def bitmask(self, periods_per_day: int) -> int:
        base = self.day * periods_per_day + self.start_period
        return ((1 << self.duration) - 1) << base

    def copy(self) -> "TimeSlot":
        return TimeSlot(self.day, self.start_period, self.duration)

@dataclass
class LessonBlock:
    id: str
    teacher_ids: List[str]
    subject_id:  str
    class_ids:   List[str]
    room_ids:    List[str]
    duration:    int
    is_locked:   bool = False
    locked_timeslot: Optional[TimeSlot] = None

    # backward-compat shims
    @property
    def teacher_id(self) -> str:
        return self.teacher_ids[0] if self.teacher_ids else None

    @property
    def class_id(self) -> str:
        return self.class_ids[0] if self.class_ids else None

    @property
    def room_id(self) -> str:
        return self.room_ids[0] if self.room_ids else None

# =========================================================
# BITMASK TIMETABLE ENGINE
# =========================================================

class Timetable:

    def __init__(self, days, periods_per_day, breaks=None, locked_lessons=None):
        self.days = days
        self.periods_per_day = periods_per_day
        self.total_slots = days * periods_per_day

        self.breaks = breaks or {}
        self.locked_lessons = locked_lessons or []

        self.assignments: Dict[str, TimeSlot] = {}

        self.teacher_mask = defaultdict(int)
        self.room_mask    = defaultdict(int)
        self.class_mask   = defaultdict(int)

        self.fitness: Optional[int] = None

        self._init_locked()

    def _apply_mask(self, lesson: LessonBlock, mask: int, add: bool):
        if add:
            for tid in lesson.teacher_ids:  self.teacher_mask[tid] |= mask
            for cid in lesson.class_ids:    self.class_mask[cid]   |= mask
            for rid in lesson.room_ids:     self.room_mask[rid]    |= mask
        else:
            for tid in lesson.teacher_ids:  self.teacher_mask[tid] &= ~mask
            for cid in lesson.class_ids:    self.class_mask[cid]   &= ~mask
            for rid in lesson.room_ids:     self.room_mask[rid]    &= ~mask

    def _init_locked(self):
        for lesson in self.locked_lessons:
            if lesson.is_locked and lesson.locked_timeslot:
                self.assign(lesson, lesson.locked_timeslot)

    def get_assignment(self, lesson_id: str) -> Optional[TimeSlot]:
        return self.assignments.get(lesson_id)

    def is_break(self, day: int, period: int) -> bool:
        return (day, period) in self.breaks

    # ── feasibility ───────────────────────────────────────────────────────

    def can_assign(self, lesson: LessonBlock, ts: TimeSlot) -> bool:
        if lesson.is_locked:
            return ts == lesson.locked_timeslot
        if ts.day < 0 or ts.day >= self.days:
            return False
        if ts.start_period < 0 or ts.start_period + ts.duration > self.periods_per_day:
            return False
        for p in ts.get_periods():
            if self.is_break(ts.day, p):
                return False
        return True

    def is_teacher_free(self, teacher_id: str, ts: TimeSlot) -> bool:
        return not (self.teacher_mask[teacher_id] & ts.bitmask(self.periods_per_day))

    def is_room_free(self, room_id: str, ts: TimeSlot) -> bool:
        return not (self.room_mask[room_id] & ts.bitmask(self.periods_per_day))

    def is_class_free(self, class_id: str, ts: TimeSlot) -> bool:
        return not (self.class_mask[class_id] & ts.bitmask(self.periods_per_day))

    def are_teachers_free(self, teacher_ids: List[str], ts: TimeSlot) -> bool:
        mask = ts.bitmask(self.periods_per_day)
        return all(not (self.teacher_mask[tid] & mask) for tid in teacher_ids)

    def are_classes_free(self, class_ids: List[str], ts: TimeSlot) -> bool:
        mask = ts.bitmask(self.periods_per_day)
        return all(not (self.class_mask[cid] & mask) for cid in class_ids)

    def are_rooms_free(self, room_ids: List[str], ts: TimeSlot) -> bool:
        mask = ts.bitmask(self.periods_per_day)
        return all(not (self.room_mask[rid] & mask) for rid in room_ids)

    # ── write ─────────────────────────────────────────────────────────────

    def assign(self, lesson: LessonBlock, ts: TimeSlot):
        old_ts = self.assignments.get(lesson.id)
        if old_ts:
            self._apply_mask(lesson, old_ts.bitmask(self.periods_per_day), False)
        self.assignments[lesson.id] = ts
        self._apply_mask(lesson, ts.bitmask(self.periods_per_day), True)
        self.fitness = None

# =========================================================
# LOCKED LESSON BUILDER
# =========================================================

def _as_list(x) -> List[str]:
    """Accept str or List[str], always return List[str]."""
    return [x] if isinstance(x, str) else list(x)

@dataclass
class LockedLessonConfig:
    """One locked-lesson specification. All entity fields are lists."""
    subject_id:   str
    subject_name: str
    teacher_ids:  List[str]
    class_ids:    List[str]
    room_ids:     List[str]
    day:          int
    period:       int
    duration:     int = 1
    description:  str = ""

class LockedLessonBuilder:
    """
    Fluent builder for fixed/locked lesson blocks.

    All entity arguments (teacher_ids, class_ids, room_ids) accept
    either a single string or a list of strings.

    Quick usage
    -----------
    builder = LockedLessonBuilder()

    # Single teacher, single class
    builder.add(
        subject_id="ASSEMBLY", subject_name="Assembly",
        teacher_ids="T01", class_ids="C_S2", room_ids="HALL",
        day=0, period=0,
    )

    # Multi-teacher lab shared across two classes / two rooms
    builder.add(
        subject_id="S6_NETLAB", subject_name="Networking Lab",
        teacher_ids=["T14", "T15"],
        class_ids=["C_S6", "C_S8"],
        room_ids=["LAB1", "LAB2"],
        day=2, period=4, duration=3,
    )

    # Same event repeated for each class individually
    builder.add_for_each_class(
        subject_id="LIBRARY", subject_name="Library Period",
        teacher_ids="T10",
        class_ids=["C_S2", "C_S4", "C_S6"],
        room_ids="LIB",
        day=4, period=6,
    )   
    subjects.update(builder.get_subjects())
    lesson_blocks.extend(builder.build(gid))
    """
    def __init__(self):
        self._configs: List[LockedLessonConfig] = []

    # ── primary API ───────────────────────────────────────────────────────

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
        description:  str = "",
    ) -> "LockedLessonBuilder":
        """Add one locked lesson. All entity args accept str or List[str]."""
        self._configs.append(LockedLessonConfig(
            subject_id   = subject_id,
            subject_name = subject_name,
            teacher_ids  = _as_list(teacher_ids),
            class_ids    = _as_list(class_ids),
            room_ids     = _as_list(room_ids),
            day          = day,
            period       = period,
            duration     = duration,
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
        description:  str = "",
    ) -> "LockedLessonBuilder":
        """
        Create one separate locked block per class_id.
        Useful when the same session happens for each class independently
        (e.g. library, sports, assembly at different times).
        """
        for cid in class_ids:
            self.add(
                subject_id   = subject_id,
                subject_name = subject_name,
                teacher_ids  = teacher_ids,
                class_ids    = cid,
                room_ids     = room_ids,
                day          = day,
                period       = period,
                duration     = duration,
                description  = f"{description} [{cid}]".strip(),
            )
        return self

    # ── output ────────────────────────────────────────────────────────────

    def build(self, id_gen) -> List["LessonBlock"]:
        """Return locked LessonBlock objects ready to add to lesson_blocks."""
        blocks = []
        for cfg in self._configs:
            blocks.append(LessonBlock(
                id              = id_gen(),
                teacher_ids     = cfg.teacher_ids,
                subject_id      = cfg.subject_id,
                class_ids       = cfg.class_ids,
                room_ids        = cfg.room_ids,
                duration        = cfg.duration,
                is_locked       = True,
                locked_timeslot = TimeSlot(cfg.day, cfg.period, cfg.duration),
            ))
        return blocks

    def get_subjects(self) -> Dict[str, "Subject"]:
        """Return a {subject_id: Subject} dict for all locked subjects (deduped)."""
        out: Dict[str, Subject] = {}
        for cfg in self._configs:
            if cfg.subject_id not in out:
                out[cfg.subject_id] = Subject(
                    id           = cfg.subject_id,
                    name         = cfg.subject_name,
                    is_difficult = False,
                    priority     = 5,
                )
        return out

    def print_summary(self):
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri"]
        print("\nLocked lessons:")
        for cfg in self._configs:
            d = day_names[cfg.day] if 0 <= cfg.day < 5 else str(cfg.day)
            print(
                f"  [LOCKED] {cfg.subject_name:25s} | "
                f"classes:[{', '.join(cfg.class_ids)}] | "
                f"{d} P{cfg.period+1} dur={cfg.duration} | "
                f"teachers:[{', '.join(cfg.teacher_ids)}] "
                f"rooms:[{', '.join(cfg.room_ids)}]"
                + (f" — {cfg.description}" if cfg.description else "")
            )
        print()

    # ── backward-compat aliases ───────────────────────────────────────────

    def add_weekly_event(
        self, subject_id, subject_name, teacher_id, class_id, room_id,
        day, period, duration=1, description="",
    ) -> "LockedLessonBuilder":
        """Legacy alias → add()"""
        return self.add(
            subject_id, subject_name,
            teacher_ids=teacher_id, class_ids=class_id, room_ids=room_id,
            day=day, period=period, duration=duration, description=description,
        )

    def add_class_event_for_all(
        self, subject_id, subject_name, teacher_id, classes, room_id,
        day, period, duration=1, description="",
    ) -> "LockedLessonBuilder":
        """Legacy alias → add_for_each_class()"""
        return self.add_for_each_class(
            subject_id, subject_name,
            teacher_ids=teacher_id, class_ids=classes, room_ids=room_id,
            day=day, period=period, duration=duration, description=description,
        )

    def build_lesson_blocks(self, id_gen) -> List["LessonBlock"]:
        """Legacy alias → build()"""
        return self.build(id_gen)

    def get_locked_subjects(self) -> Dict[str, "Subject"]:
        """Legacy alias → get_subjects()"""
        return self.get_subjects()