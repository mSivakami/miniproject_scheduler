"""
services/mapper.py
------------------
Converts in-memory store (ORM models) → GA dataclasses.

KEY DESIGN:
  DB stores ONE row per subject/teacher/class/room combo with a sessions JSONB field.
  e.g. sessions = [{"duration": 1, "count": 3}, {"duration": 2, "count": 1}]

  This mapper explodes each session spec into individual LessonBlock objects
  that the GA can schedule independently, each with a unique derived ID.

  Example explosion:
    DB row  L0042  S2_CP  sessions=[{dur:1,count:3},{dur:2,count:1}]
    → GA gets:
        L0042_0  dur=1  (single)
        L0042_1  dur=1  (single)
        L0042_2  dur=1  (single)
        L0042_3  dur=2  (double)

  The GA never sees sessions — it just gets a flat list of LessonBlocks to schedule.
  The result mapper uses the prefix (L0042) to reconstruct which DB row each entry
  belongs to when saving timetable_entries.
"""
from __future__ import annotations
from structures import Teacher, Subject, Room, Class, LessonBlock, TimeSlot, Break
import db.session as store

# ── Cache ─────────────────────────────────────────────────────────────────────

_cache: tuple | None = None
_cached_version: int = -1


def fetch_and_map():
    """Return (teachers, subjects, rooms, classes, lesson_blocks). Cached by store version."""
    global _cache, _cached_version
    current = store.get_version()
    if _cache is not None and _cached_version == current:
        return _cache
    _cache = _do_map()
    _cached_version = current
    return _cache


def get_db_lesson_id(ga_lesson_id: str) -> str:
    """
    Strip the session suffix from a GA lesson ID to get the DB lesson ID.
    L0042_3  →  L0042
    L0042_locked  →  L0042
    """
    return ga_lesson_id.rsplit("_", 1)[0]


# ── Mapping ───────────────────────────────────────────────────────────────────

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
        teacher_ids = [t.id for t in row.teachers]
        class_ids   = [c.id for c in row.classes]
        room_ids    = [r.id for r in row.rooms]

        if row.is_locked and row.locked_day is not None:
            # ── Locked lesson: one block, fixed timeslot ───────────────────
            dur = row.locked_duration or 1
            lesson_blocks.append(LessonBlock(
                id              = f"{lid}_locked",
                teacher_ids     = teacher_ids,
                subject_id      = row.subject_id,
                class_ids       = class_ids,
                room_ids        = room_ids,
                duration        = dur,
                is_locked       = True,
                locked_timeslot = TimeSlot(
                    day          = row.locked_day,
                    start_period = row.locked_start_period,
                    duration     = dur,
                ),
            ))

        else:
            # ── Free lesson: explode sessions into individual blocks ────────
            sessions = row.sessions or []
            slot_index = 0
            for spec in sessions:
                dur   = spec["duration"]
                count = spec["count"]
                for _ in range(count):
                    lesson_blocks.append(LessonBlock(
                        id          = f"{lid}_{slot_index}",
                        teacher_ids = teacher_ids,
                        subject_id  = row.subject_id,
                        class_ids   = class_ids,
                        room_ids    = room_ids,
                        duration    = dur,
                        is_locked   = False,
                    ))
                    slot_index += 1

    return teachers, subjects, rooms, classes, lesson_blocks