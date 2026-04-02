"""
structures.py — ChromaSchedule Core Data Structures
====================================================
Defines all domain entities: Teacher, Subject, Room, Class, LessonBlock.
These structures are the canonical Python-side representation shared between
the test cases, the GA engine, and (eventually) the FastAPI backend.
 
Design principles:
  - Immutable after construction (treat as frozen)
  - All IDs are strings (match the database UUID strategy)
  - Availability masks use uint64 bitmask: bit N = slot N
    where slot = day * periods_per_day + period (0-indexed)
  - LockedLessonBuilder provides a fluent API for pinned blocks
"""
 
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional, Union
 
 
# ──────────────────────────────────────────────────────────────────────────────
# Domain Entities
# ──────────────────────────────────────────────────────────────────────────────
 
@dataclass
class Teacher:
    """
    A teacher entity.
 
    available_mask : uint64 bitmask of slots the teacher CAN teach.
                     Default = all 1s (always available).
                     Bit N = 1 means slot N is available.
    max_per_day    : soft-constraint limit on periods per day.
    max_per_week   : hard-constraint limit on total periods per week.
    """
    id:             str
    name:           str
    available_mask: int   = (1 << 64) - 1   # all slots available by default
    max_per_day:    int   = 6
    max_per_week:   int   = 30
 
    def __repr__(self):
        return f"Teacher({self.id}, {self.name!r})"
 
 
@dataclass
class Subject:
    """
    A subject / course unit.
 
    is_difficult : Soft constraint — avoid scheduling in last period.
    is_lab       : Hard constraint — must be assigned to a lab room.
    priority     : Lower value = higher scheduling priority (used in DSATUR seeding).
    """
    id:           str
    name:         str
    is_difficult: bool = False
    is_lab:       bool = False
    priority:     int  = 1
 
    def __repr__(self):
        return f"Subject({self.id}, {self.name!r})"
 
 
@dataclass
class Room:
    """
    A physical room or laboratory.
 
    is_lab         : True if this is a lab room (satisfies is_lab subject requirement).
    available_mask : uint64 — same convention as Teacher.available_mask.
    """
    id:             str
    name:           str
    is_lab:         bool = False
    available_mask: int  = (1 << 64) - 1
 
    def __repr__(self):
        return f"Room({self.id}, {'LAB' if self.is_lab else 'room'}, {self.name!r})"
 
 
@dataclass
class Class:
    """
    A student class / section (e.g. 'Semester 2', '10A').
    Classes drive the classroom-clash constraint (H9):
    a class cannot be in two places at once.
    """
    id:   str
    name: str
 
    def __repr__(self):
        return f"Class({self.id}, {self.name!r})"
 
 
@dataclass
class LessonBlock:
    """
    The atomic scheduling unit — one gene in the GA chromosome.
 
    id              : unique string identifier
    teacher_ids     : list of teacher IDs who teach this block (ALL are busy simultaneously)
    subject_id      : primary subject being taught
    class_ids       : list of class IDs attending this block
    room_ids        : list of room IDs needed (multi-room for split labs)
    duration        : 1 = single, 2 = double, 3 = triple period
    count           : how many times this block occurs per week → generates `count` genes
    is_lab          : True if block requires a lab room (derived from subject or explicit)
    is_difficult    : True if subject is marked difficult (avoid last period — S2)
    is_locked       : True if this block is pinned to a specific day/period
    locked_day      : 0-indexed day (only valid if is_locked)
    locked_period   : 0-indexed start period (only valid if is_locked)
    subject_name    : human-readable subject name (for display)
    """
    id:           str
    teacher_ids:  List[str]
    subject_id:   str
    class_ids:    List[str]
    room_ids:     List[str]
    duration:     int  = 1
    count:        int  = 1
    is_lab:       bool = False
    is_difficult: bool = False
    is_locked:    bool = False
    locked_day:   int  = 0
    locked_period: int = 0
    subject_name: str  = ""
 
    def __post_init__(self):
        # Validate duration
        if self.duration not in (1, 2, 3):
            raise ValueError(f"LessonBlock {self.id}: duration must be 1, 2, or 3, got {self.duration}")
        if self.count < 1:
            raise ValueError(f"LessonBlock {self.id}: count must be ≥ 1, got {self.count}")
 
    def __repr__(self):
        lock = f" LOCKED@d{self.locked_day}p{self.locked_period}" if self.is_locked else ""
        return (f"LessonBlock({self.id}, subj={self.subject_id}, "
                f"dur={self.duration}, cnt={self.count}{lock})")
 
 
# ──────────────────────────────────────────────────────────────────────────────
# Locked Lesson Builder — fluent API for pinned blocks
# ──────────────────────────────────────────────────────────────────────────────
 
class LockedLessonBuilder:
    """
    Convenience builder for lessons that are hard-pinned to specific slots.
 
    Usage:
        locked = LockedLessonBuilder()
        locked.add(
            subject_id="S4_MINOR", subject_name="Minor",
            teacher_ids=["T14","T16","T12"],
            class_ids="C_S4",
            room_ids="R_S4",
            day=2, period=5, duration=2,
        )
        subjects.update(locked.get_subjects())
        lesson_blocks.extend(locked.build(gid_fn))
 
    Note: day and period in .add() are 1-indexed (human-friendly input),
    stored as 0-indexed internally (matching GA bitmask convention).
    """
 
    def __init__(self):
        self._entries: list = []
        self._subjects: dict = {}
 
    def add(
        self,
        subject_id:   str,
        subject_name: str,
        teacher_ids:  Union[str, List[str]],
        class_ids:    Union[str, List[str]],
        room_ids:     Union[str, List[str]],
        day:          int,    # 1-indexed
        period:       int,    # 1-indexed
        duration:     int = 1,
        is_lab:       bool = False,
    ) -> "LockedLessonBuilder":
        teacher_ids = [teacher_ids] if isinstance(teacher_ids, str) else list(teacher_ids)
        class_ids   = [class_ids]   if isinstance(class_ids,   str) else list(class_ids)
        room_ids    = [room_ids]     if isinstance(room_ids,    str) else list(room_ids)
 
        self._entries.append({
            "subject_id":   subject_id,
            "subject_name": subject_name,
            "teacher_ids":  teacher_ids,
            "class_ids":    class_ids,
            "room_ids":     room_ids,
            "day":          day - 1,     # convert to 0-indexed
            "period":       period - 1,  # convert to 0-indexed
            "duration":     duration,
            "is_lab":       is_lab,
        })
 
        # Auto-register subject (won't overwrite if already exists)
        if subject_id not in self._subjects:
            self._subjects[subject_id] = Subject(
                id=subject_id,
                name=subject_name,
                is_lab=is_lab,
            )
 
        return self
 
    def get_subjects(self) -> dict:
        """Return a dict of {subject_id: Subject} for new locked subjects."""
        return dict(self._subjects)
 
    def build(self, gid_fn) -> List[LessonBlock]:
        """
        Build LessonBlock objects from all added entries.
        gid_fn: callable() → unique string ID for each block.
        """
        blocks = []
        for e in self._entries:
            block = LessonBlock(
                id=gid_fn(),
                teacher_ids=e["teacher_ids"],
                subject_id=e["subject_id"],
                class_ids=e["class_ids"],
                room_ids=e["room_ids"],
                duration=e["duration"],
                count=1,         # locked lessons always count=1
                is_lab=e["is_lab"],
                is_difficult=False,
                is_locked=True,
                locked_day=e["day"],
                locked_period=e["period"],
                subject_name=e["subject_name"],
            )
            blocks.append(block)
        return blocks
 
    def print_summary(self):
        """Print a human-readable summary of all locked lessons."""
        if not self._entries:
            print("  [LockedLessonBuilder] No locked lessons.")
            return
        print(f"\n  {'─'*60}")
        print(f"  Locked Lessons ({len(self._entries)} blocks):")
        print(f"  {'─'*60}")
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        for e in self._entries:
            day_str = days[e['day']] if e['day'] < len(days) else f"Day{e['day']}"
            print(f"  {e['subject_name']:<25} {day_str} P{e['period']+1}"
                  f"  dur={e['duration']}"
                  f"  teachers={e['teacher_ids']}"
                  f"  class={e['class_ids']}")
        print(f"  {'─'*60}\n")
 