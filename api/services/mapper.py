"""
services/mapper.py
------------------
Converts in-memory store (ORM models) → scheduler dataclasses.
Result is cached by store version — rebuilt only when data changes.
"""
from __future__ import annotations
from structures import Teacher, Subject, Room, Class, LessonBlock, TimeSlot, Break
import db.session as store

# ── Cache ─────────────────────────────────────────────────────────────────────

_cache: tuple | None = None
_cached_version: int = -1


def fetch_and_map():
    global _cache, _cached_version

    current = store.get_version()
    if _cache is not None and _cached_version == current:
        return _cache

    _cache = _do_map()
    _cached_version = current
    return _cache


# ── Mapping logic ─────────────────────────────────────────────────────────────

def _do_map():
    teachers: dict[str, Teacher] = {
        tid: Teacher(
            id=tid,
            name=row.name,
            unavailable_slots=[(u.day, u.period) for u in row.unavailable],
        )
        for tid, row in store.get_teachers().items()
    }

    subjects: dict[str, Subject] = {
        sid: Subject(
            id=sid,
            name=row.name,
            is_difficult=row.is_difficult,
            is_lab=row.is_lab,
            priority=row.priority,
        )
        for sid, row in store.get_subjects().items()
    }

    rooms: dict[str, Room] = {
        rid: Room(id=rid, name=row.name, is_lab=row.is_lab)
        for rid, row in store.get_rooms().items()
    }

    classes: dict[str, Class] = {
        cid: Class(id=cid, name=row.name)
        for cid, row in store.get_classes().items()
    }

    lesson_blocks: list[LessonBlock] = []
    for lid, row in store.get_lessons().items():
        locked_ts = None
        if row.is_locked and row.locked_day is not None:
            locked_ts = TimeSlot(
                day=row.locked_day,
                start_period=row.locked_start_period,
                duration=row.duration,
            )
        lesson_blocks.append(LessonBlock(
            id=lid,
            teacher_ids=[t.id for t in row.teachers],
            subject_id=row.subject_id,
            class_ids=[c.id for c in row.classes],
            room_ids=[r.id for r in row.rooms],
            duration=row.duration,
            is_locked=row.is_locked,
            locked_timeslot=locked_ts,
        ))

    return teachers, subjects, rooms, classes, lesson_blocks