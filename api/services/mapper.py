"""
services/mapper.py
------------------
Converts per-user store (plain dicts) → GA dataclasses.
Cached per user by store version number.
"""
from __future__ import annotations
from structures import Teacher, Subject, Room, Class, LessonBlock, TimeSlot
import db.session as store

_cache:   dict[str, tuple] = {}
_version: dict[str, int]   = {}


def fetch_and_map(uid: str):
    """Return (teachers, subjects, rooms, classes, lesson_blocks). Cached."""
    current = store.get_version(uid)
    if _cache.get(uid) is not None and _version.get(uid) == current:
        return _cache[uid]
    result = _do_map(uid)
    _cache[uid]   = result
    _version[uid] = current
    return result


def invalidate(uid: str):
    _cache.pop(uid, None)
    _version.pop(uid, None)


def get_db_lesson_id(ga_id: str) -> str:
    """Strip GA suffix: L0042_3 → L0042, L0042_locked → L0042"""
    return ga_id.rsplit("_", 1)[0]


def _do_map(uid: str):
    # All store values are plain dicts now
    teachers = {
        tid: Teacher(
            id=d["id"],
            name=d["name"],
            unavailable_slots=[
                (u["day"], u["period"]) for u in d.get("unavailable_slots", [])
            ],
        )
        for tid, d in store.get_teachers(uid).items()
    }

    subjects = {
        sid: Subject(
            id=d["id"],
            name=d["name"],
            is_difficult=d.get("is_difficult", False),
            is_lab=d.get("is_lab", False),
            priority=d.get("priority", 5),
        )
        for sid, d in store.get_subjects(uid).items()
    }

    rooms = {
        rid: Room(id=d["id"], name=d["name"], is_lab=d.get("is_lab", False))
        for rid, d in store.get_rooms(uid).items()
    }

    classes = {
        cid: Class(id=d["id"], name=d["name"])
        for cid, d in store.get_classes(uid).items()
    }

    lesson_blocks: list[LessonBlock] = []

    for lid, d in store.get_lessons(uid).items():
        teacher_ids = d.get("teacher_ids", [])
        class_ids   = d.get("class_ids",   [])
        room_ids    = d.get("room_ids",     [])

        if d.get("is_locked") and d.get("locked_day") is not None:
            dur = d.get("locked_duration") or 1
            lesson_blocks.append(LessonBlock(
                id              = f"{lid}_locked",
                teacher_ids     = teacher_ids,
                subject_id      = d["subject_id"],
                class_ids       = class_ids,
                room_ids        = room_ids,
                duration        = dur,
                is_locked       = True,
                locked_timeslot = TimeSlot(
                    day          = d["locked_day"],
                    start_period = d["locked_start_period"],
                    duration     = dur,
                ),
            ))
        else:
            sessions   = d.get("sessions") or []
            slot_index = 0
            for spec in sessions:
                dur   = spec["duration"]
                count = spec["count"]
                for _ in range(count):
                    lesson_blocks.append(LessonBlock(
                        id          = f"{lid}_{slot_index}",
                        teacher_ids = teacher_ids,
                        subject_id  = d["subject_id"],
                        class_ids   = class_ids,
                        room_ids    = room_ids,
                        duration    = dur,
                        is_locked   = False,
                    ))
                    slot_index += 1

    return teachers, subjects, rooms, classes, lesson_blocks