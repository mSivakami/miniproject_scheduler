from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict

# =========================================================
# BASIC TYPES (UNCHANGED)
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
    teacher_ids: List[str]   # was teacher_id: str
    subject_id:  str
    class_ids:   List[str]   # was class_id: str
    room_ids:    List[str]   # was room_id: str
    duration:    int
    is_locked:   bool = False
    locked_timeslot: Optional[TimeSlot] = None

    # backward-compat shims — old code reading .teacher_id / .class_id / .room_id still works
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

        # BITBOARDS
        self.teacher_mask = defaultdict(int)
        self.room_mask = defaultdict(int)
        self.class_mask = defaultdict(int)

        self.fitness: Optional[int] = None

        self._init_locked()

    # -----------------------------------------------------

    def _apply_mask(self, lesson: LessonBlock, mask: int, add: bool):
        if add:
            for tid in lesson.teacher_ids:
                self.teacher_mask[tid] |= mask
            for cid in lesson.class_ids:
                self.class_mask[cid] |= mask
            for rid in lesson.room_ids:
                self.room_mask[rid]  |= mask
        else:
            for tid in lesson.teacher_ids:
                self.teacher_mask[tid] &= ~mask
            for cid in lesson.class_ids:
                self.class_mask[cid] &= ~mask
            for rid in lesson.room_ids:
                self.room_mask[rid]  &= ~mask

    # -----------------------------------------------------

    def _init_locked(self):
        for lesson in self.locked_lessons:
            if lesson.is_locked and lesson.locked_timeslot:
                self.assign(lesson, lesson.locked_timeslot)

    # -----------------------------------------------------

    def get_assignment(self, lesson_id: str) -> Optional[TimeSlot]:
        return self.assignments.get(lesson_id)

    def is_break(self, day: int, period: int) -> bool:
        return (day, period) in self.breaks

    # -----------------------------------------------------
    # FEASIBILITY
    # -----------------------------------------------------

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

    # -----------------------------------------------------
    # WRITE
    # -----------------------------------------------------

    def assign(self, lesson: LessonBlock, ts: TimeSlot):
        new_mask = ts.bitmask(self.periods_per_day)

        old_ts = self.assignments.get(lesson.id)
        if old_ts:
            self._apply_mask(lesson, old_ts.bitmask(self.periods_per_day), False)

        self.assignments[lesson.id] = ts
        self._apply_mask(lesson, new_mask, True)
        self.fitness = None

# ── Locked lesson builder ─────────────────────────────────────────────────

@dataclass
class LockedLessonConfig:
    subject_id: str
    subject_name: str
    teacher_id: str
    class_id: str
    room_id: str
    day: int
    period: int
    duration: int = 1
    description: str = ""

class LockedLessonBuilder:

    def __init__(self):
        self._configs: List[LockedLessonConfig] = []

    def add_weekly_event(
        self, subject_id, subject_name, teacher_id, class_id, room_id,
        day, period, duration=1, description="",
    ):
        self._configs.append(LockedLessonConfig(
            subject_id, subject_name, teacher_id, class_id, room_id,
            day, period, duration, description,
        ))
        return self

    def add_class_event_for_all(
        self, subject_id, subject_name, teacher_id, classes, room_id,
        day, period, duration=1, description="",
    ):
        for class_id in classes:
            self.add_weekly_event(
                subject_id, subject_name, teacher_id, class_id,
                room_id or class_id, day, period, duration, description,
            )
        return self

    def build_lesson_blocks(self, id_gen) -> List[LessonBlock]:
        blocks = []
        for cfg in self._configs:
            blocks.append(LessonBlock(
            id=id_gen(),
            teacher_ids=[cfg.teacher_id], 
            subject_id=cfg.subject_id,
            class_ids=[cfg.class_id],    
            room_ids=[cfg.room_id], 
            duration=cfg.duration,
            is_locked=True,
            locked_timeslot=TimeSlot(cfg.day, cfg.period, cfg.duration),
        ))
        return blocks

    def get_locked_subjects(self) -> Dict[str, Subject]:
        out: Dict[str, Subject] = {}
        for cfg in self._configs:
            if cfg.subject_id not in out:
                out[cfg.subject_id] = Subject(
                    id=cfg.subject_id, name=cfg.subject_name,
                    is_difficult=False, priority=5,
                )
        return out

    def print_summary(self):
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri"]
        print("\nLocked lessons:")
        for cfg in self._configs:
            d = day_names[cfg.day] if 0 <= cfg.day < 5 else str(cfg.day)
            print(f"  [LOCKED] {cfg.subject_name:20s} | {cfg.class_id:6s} | "
                  f"{d} P{cfg.period+1} dur={cfg.duration} | {cfg.description}")
        print()