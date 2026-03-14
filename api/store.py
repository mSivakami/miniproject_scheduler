"""
store.py — In-memory data store.

Loaded once at server startup from Neon.
Kept in sync on every write (create / update / delete).
generate.py reads directly from here — zero DB round trips during GA.

Structure
---------
_store = {
    "teachers" : { id: TeacherModel, ... },
    "subjects" : { id: SubjectModel, ... },
    "rooms"    : { id: RoomModel,    ... },
    "classes"  : { id: ClassModel,   ... },
    "lessons"  : { id: LessonBlockModel, ... },
    "breaks"   : { (day, period): BreakModel, ... },
}
"""

from sqlalchemy.orm import Session, joinedload
from models import (
    TeacherModel, SubjectModel, RoomModel,
    ClassModel, LessonBlockModel, BreakModel,
)

# ── the store ─────────────────────────────────────────────────────────────────

_store: dict = {
    "teachers": {},
    "subjects": {},
    "rooms":    {},
    "classes":  {},
    "lessons":  {},
    "breaks":   {},
}

_loaded = False   # True after first load from Neon


# ══════════════════════════════════════════════════════════════════════════════
# LOAD  (called once at startup)
# ══════════════════════════════════════════════════════════════════════════════

def load_all(db: Session):
    """
    Fetch everything from Neon and populate _store.
    Called at server startup. Safe to call again to force a full reload.
    """
    global _loaded

    # Teachers + unavailable slots in one query
    teachers = (
        db.query(TeacherModel)
        .options(joinedload(TeacherModel.unavailable))
        .all()
    )
    _store["teachers"] = {t.id: t for t in teachers}

    # Subjects
    _store["subjects"] = {
        s.id: s for s in db.query(SubjectModel).all()
    }

    # Rooms
    _store["rooms"] = {
        r.id: r for r in db.query(RoomModel).all()
    }

    # Classes
    _store["classes"] = {
        c.id: c for c in db.query(ClassModel).all()
    }

    # Lessons + all three relationships in one query
    lessons = (
        db.query(LessonBlockModel)
        .options(
            joinedload(LessonBlockModel.teachers),
            joinedload(LessonBlockModel.classes),
            joinedload(LessonBlockModel.rooms),
        )
        .all()
    )
    _store["lessons"] = {l.id: l for l in lessons}

    # Breaks
    _store["breaks"] = {
        (b.day, b.period): b for b in db.query(BreakModel).all()
    }

    _loaded = True
    print(
        f"[store] loaded — "
        f"{len(_store['teachers'])} teachers, "
        f"{len(_store['subjects'])} subjects, "
        f"{len(_store['rooms'])} rooms, "
        f"{len(_store['classes'])} classes, "
        f"{len(_store['lessons'])} lessons, "
        f"{len(_store['breaks'])} breaks"
    )


def is_loaded() -> bool:
    return _loaded


# ══════════════════════════════════════════════════════════════════════════════
# READ  (used by mapper.py / generate.py)
# ══════════════════════════════════════════════════════════════════════════════

def get_all() -> dict:
    """Return the full store. Caller should not mutate it."""
    return _store


def get_teachers() -> dict:
    return _store["teachers"]

def get_subjects() -> dict:
    return _store["subjects"]

def get_rooms() -> dict:
    return _store["rooms"]

def get_classes() -> dict:
    return _store["classes"]

def get_lessons() -> dict:
    return _store["lessons"]

def get_breaks() -> dict:
    return _store["breaks"]


# ══════════════════════════════════════════════════════════════════════════════
# WRITE HELPERS  (called after every successful db.commit())
# ══════════════════════════════════════════════════════════════════════════════

# ── Teachers ──────────────────────────────────────────────────────────────────

def upsert_teacher(teacher: TeacherModel):
    """Add or update a teacher in the store."""
    _store["teachers"][teacher.id] = teacher

def remove_teacher(teacher_id: str):
    _store["teachers"].pop(teacher_id, None)


# ── Subjects ──────────────────────────────────────────────────────────────────

def upsert_subject(subject: SubjectModel):
    _store["subjects"][subject.id] = subject

def remove_subject(subject_id: str):
    _store["subjects"].pop(subject_id, None)


# ── Rooms ─────────────────────────────────────────────────────────────────────

def upsert_room(room: RoomModel):
    _store["rooms"][room.id] = room

def remove_room(room_id: str):
    _store["rooms"].pop(room_id, None)


# ── Classes ───────────────────────────────────────────────────────────────────

def upsert_class(cls: ClassModel):
    _store["classes"][cls.id] = cls

def remove_class(class_id: str):
    _store["classes"].pop(class_id, None)


# ── Lessons ───────────────────────────────────────────────────────────────────

def upsert_lesson(lesson: LessonBlockModel):
    _store["lessons"][lesson.id] = lesson

def remove_lesson(lesson_id: str):
    _store["lessons"].pop(lesson_id, None)


# ── Breaks ────────────────────────────────────────────────────────────────────

def upsert_break(brk: BreakModel):
    _store["breaks"][(brk.day, brk.period)] = brk

def remove_break(day: int, period: int):
    _store["breaks"].pop((day, period), None)