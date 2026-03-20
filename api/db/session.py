"""
db/session.py — Database engine, session factory, in-memory store, and store helpers.
"""
from __future__ import annotations
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, selectinload
from models.orm import (
    Base, TeacherModel, SubjectModel, RoomModel,
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

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)


# ── In-memory store ───────────────────────────────────────────────────────────

_store: dict = {
    "teachers": {},
    "subjects": {},
    "rooms":    {},
    "classes":  {},
    "lessons":  {},
}
_version = 0
_loaded  = False


def get_version() -> int:
    return _version

def _bump():
    global _version
    _version += 1

def is_loaded() -> bool:
    return _loaded


def load_all(db: Session):
    global _loaded

    teachers = (
        db.query(TeacherModel)
        .options(selectinload(TeacherModel.unavailable))
        .all()
    )
    _store["teachers"] = {t.id: t for t in teachers}

    _store["subjects"] = {s.id: s for s in db.query(SubjectModel).all()}
    _store["rooms"]    = {r.id: r for r in db.query(RoomModel).all()}
    _store["classes"]  = {c.id: c for c in db.query(ClassModel).all()}

    lessons = (
        db.query(LessonBlockModel)
        .options(
            selectinload(LessonBlockModel.teachers),
            selectinload(LessonBlockModel.classes),
            selectinload(LessonBlockModel.rooms),
        )
        .all()
    )
    _store["lessons"] = {l.id: l for l in lessons}

    _loaded = True
    _bump()
    print(
        f"[store] loaded — "
        f"{len(_store['teachers'])} teachers, "
        f"{len(_store['subjects'])} subjects, "
        f"{len(_store['rooms'])} rooms, "
        f"{len(_store['classes'])} classes, "
        f"{len(_store['lessons'])} lessons"
    )


# ── Read helpers ──────────────────────────────────────────────────────────────

def get_teachers() -> dict: return _store["teachers"]
def get_subjects() -> dict: return _store["subjects"]
def get_rooms()    -> dict: return _store["rooms"]
def get_classes()  -> dict: return _store["classes"]
def get_lessons()  -> dict: return _store["lessons"]


# ── Write helpers (call after db.commit()) ────────────────────────────────────

def upsert_teacher(t: TeacherModel):  _store["teachers"][t.id] = t; _bump()
def remove_teacher(tid: str):         _store["teachers"].pop(tid, None); _bump()

def upsert_subject(s: SubjectModel):  _store["subjects"][s.id] = s; _bump()
def remove_subject(sid: str):         _store["subjects"].pop(sid, None); _bump()

def upsert_room(r: RoomModel):        _store["rooms"][r.id] = r; _bump()
def remove_room(rid: str):            _store["rooms"].pop(rid, None); _bump()

def upsert_class(c: ClassModel):      _store["classes"][c.id] = c; _bump()
def remove_class(cid: str):           _store["classes"].pop(cid, None); _bump()

def upsert_lesson(l: LessonBlockModel): _store["lessons"][l.id] = l; _bump()
def remove_lesson(lid: str):            _store["lessons"].pop(lid, None); _bump()