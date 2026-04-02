"""
db/session.py
-------------
Database engine, session factory, and per-user in-memory store.
Store holds plain dicts (not ORM objects) to avoid DetachedInstanceError.
Schema is managed via schema.sql — Python never creates tables.
"""
from __future__ import annotations
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, selectinload
from models.orm import (
    UserSettingsModel,
    TeacherModel, SubjectModel, RoomModel,
    ClassModel, LessonBlockModel,
)

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(
    DATABASE_URL,
    connect_args={"sslmode": "require"},
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Per-user in-memory store (plain dicts only) ───────────────────────────────

_store:    dict[str, dict] = {}
_versions: dict[str, int]  = {}


def _empty() -> dict:
    return {
        "settings": None,   # None = not configured yet
        "teachers": {},
        "subjects": {},
        "rooms":    {},
        "classes":  {},
        "lessons":  {},
    }


def _ensure(uid: str):
    if uid not in _store:
        _store[uid] = _empty()


def get_version(uid: str) -> int:
    return _versions.get(uid, 0)


def _bump(uid: str):
    _versions[uid] = _versions.get(uid, 0) + 1


# ── Serialise ORM → plain dict ────────────────────────────────────────────────

def _settings_dict(s: UserSettingsModel) -> dict:
    return {
        "institution_name": s.institution_name,
        "academic_year":    s.academic_year,
        "num_days":         s.num_days,
        "num_periods":      s.num_periods,
        "break_periods":    s.break_periods or [],
    }


def _teacher_dict(t: TeacherModel) -> dict:
    return {
        "id":      t.id,
        "user_id": t.user_id,
        "name":    t.name,
        "unavailable_slots": [
            {"day": u.day, "period": u.period} for u in t.unavailable
        ],
    }

def _subject_dict(s: SubjectModel) -> dict:
    return {
        "id":           s.id,
        "user_id":      s.user_id,
        "name":         s.name,
        "is_difficult": s.is_difficult,
        "is_lab":       s.is_lab,
        "priority":     s.priority,
    }

def _room_dict(r: RoomModel) -> dict:
    return {
        "id":      r.id,
        "user_id": r.user_id,
        "name":    r.name,
        "is_lab":  r.is_lab,
    }

def _class_dict(c: ClassModel) -> dict:
    return {
        "id":      c.id,
        "user_id": c.user_id,
        "name":    c.name,
    }

def _lesson_dict(l: LessonBlockModel) -> dict:
    return {
        "id":                  l.id,
        "subject_id":          l.subject_id,
        "teacher_ids":         [t.id for t in l.teachers],
        "class_ids":           [c.id for c in l.classes],
        "room_ids":            [r.id for r in l.rooms],
        "sessions":            l.sessions or [],
        "is_locked":           l.is_locked,
        "locked_day":          l.locked_day,
        "locked_start_period": l.locked_start_period,
        "locked_duration":     l.locked_duration,
        "total_periods": sum(
            s["duration"] * s["count"] for s in (l.sessions or [])
        ),
    }


# ── Load from DB ──────────────────────────────────────────────────────────────

def load_user(db: Session, uid: str):
    """Load all data for one user from Neon DB into the store as plain dicts."""
    _ensure(uid)

    # Settings (may be None if user has not configured yet)
    settings_row = db.query(UserSettingsModel).filter(
        UserSettingsModel.user_id == uid
    ).first()
    _store[uid]["settings"] = _settings_dict(settings_row) if settings_row else None

    teachers = (
        db.query(TeacherModel)
        .filter(TeacherModel.user_id == uid)
        .options(selectinload(TeacherModel.unavailable))
        .all()
    )
    _store[uid]["teachers"] = {t.id: _teacher_dict(t) for t in teachers}

    subjects = db.query(SubjectModel).filter(SubjectModel.user_id == uid).all()
    _store[uid]["subjects"] = {s.id: _subject_dict(s) for s in subjects}

    _store[uid]["rooms"] = {
        r.id: _room_dict(r) for r in
        db.query(RoomModel).filter(RoomModel.user_id == uid).all()
    }

    _store[uid]["classes"] = {
        c.id: _class_dict(c) for c in
        db.query(ClassModel).filter(ClassModel.user_id == uid).all()
    }

    subject_ids = list(_store[uid]["subjects"].keys())
    if subject_ids:
        lessons = (
            db.query(LessonBlockModel)
            .filter(LessonBlockModel.subject_id.in_(subject_ids))
            .options(
                selectinload(LessonBlockModel.teachers),
                selectinload(LessonBlockModel.classes),
                selectinload(LessonBlockModel.rooms),
            )
            .all()
        )
    else:
        lessons = []
    _store[uid]["lessons"] = {l.id: _lesson_dict(l) for l in lessons}

    _bump(uid)
    print(
        f"[store] user={uid[:8]}… "
        f"settings={'yes' if _store[uid]['settings'] else 'NO'} "
        f"teachers={len(_store[uid]['teachers'])} "
        f"subjects={len(_store[uid]['subjects'])} "
        f"rooms={len(_store[uid]['rooms'])} "
        f"classes={len(_store[uid]['classes'])} "
        f"lessons={len(_store[uid]['lessons'])}"
    )


def evict_user(uid: str):
    _store.pop(uid, None)
    _versions.pop(uid, None)


# ── Per-user read helpers (return plain dicts) ────────────────────────────────

def get_settings(uid: str) -> dict | None: return _store.get(uid, {}).get("settings", None)
def get_teachers(uid: str) -> dict: return _store.get(uid, {}).get("teachers", {})
def get_subjects(uid: str) -> dict: return _store.get(uid, {}).get("subjects", {})
def get_rooms(uid: str)    -> dict: return _store.get(uid, {}).get("rooms",    {})
def get_classes(uid: str)  -> dict: return _store.get(uid, {}).get("classes",  {})
def get_lessons(uid: str)  -> dict: return _store.get(uid, {}).get("lessons",  {})


# ── Break periods helper ──────────────────────────────────────────────────────

def parse_breaks(break_periods: list) -> dict:
    """
    Convert stored break_periods JSON to the GA breaks dict.
    break_periods: [{"day": 0, "period": 3}, ...]
    Returns: {(day, period): Break("Break"), ...}
    """
    from structures import Break
    return {(int(bp["day"]), int(bp["period"])): Break("Break") for bp in (break_periods or [])}