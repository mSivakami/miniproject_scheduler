"""
routes/api.py — All API endpoints.
"""
from __future__ import annotations
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError

import db.session as store
from db.session import get_db, SessionLocal
from models.orm import (
    TeacherModel, TeacherUnavailableModel,
    SubjectModel, RoomModel, ClassModel,
    LessonBlockModel, GenerationJobModel,
    TimetableModel, TimetableEntryModel,
)
from schemas.api import (
    BootstrapResponse, TeacherOut, SubjectOut, RoomOut, ClassOut, LessonOut,
    SaveAllRequest, SaveAllResponse,
    GenerateResponse, JobStatusResponse, TimetableResultResponse, TimetableEntryOut,
)
from services.generator import run_generation

router = APIRouter()
DB = Annotated[Session, Depends(get_db)]


def _new_id() -> str:
    return str(uuid.uuid4())


def _integrity_error(e: IntegrityError) -> HTTPException:
    msg = str(e.orig).lower()
    if "unique" in msg or "duplicate" in msg:
        return HTTPException(409, "Record already exists")
    if "foreign key" in msg or "violates" in msg:
        return HTTPException(400, "Referenced record does not exist")
    return HTTPException(400, "Database constraint violation")


# ── Serialisers ───────────────────────────────────────────────────────────────

def _teacher_out(t: TeacherModel) -> dict:
    return {
        "id":   t.id,
        "name": t.name,
        "unavailable_slots": [{"day": u.day, "period": u.period} for u in t.unavailable],
    }

def _lesson_out(l: LessonBlockModel) -> dict:
    return {
        "id":                  l.id,
        "subject_id":          l.subject_id,
        "teacher_ids":         [t.id for t in l.teachers],
        "class_ids":           [c.id for c in l.classes],
        "room_ids":            [r.id for r in l.rooms],
        "duration":            l.duration,
        "is_locked":           l.is_locked,
        "locked_day":          l.locked_day,
        "locked_start_period": l.locked_start_period,
    }


# ══════════════════════════════════════════════════════════════════════════════
# BOOTSTRAP  — single call loads everything
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/bootstrap", tags=["System"])
def bootstrap():
    """Return all entities in one response for frontend initial load."""
    return {
        "teachers": [_teacher_out(t) for t in store.get_teachers().values()],
        "subjects": list(store.get_subjects().values()),
        "rooms":    list(store.get_rooms().values()),
        "classes":  list(store.get_classes().values()),
        "lessons":  [_lesson_out(l) for l in store.get_lessons().values()],
    }


# ══════════════════════════════════════════════════════════════════════════════
# BATCH SAVE  — one transaction for all changes
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/save-all", response_model=SaveAllResponse, tags=["Data"])
def save_all(body: SaveAllRequest, db: DB):
    counts: dict[str, dict[str, int]] = {}

    try:
        # ── Teachers ──────────────────────────────────────────────────────
        tc = body.teachers
        counts["teachers"] = {"added": 0, "updated": 0, "deleted": 0}

        for item in tc.added:
            t = TeacherModel(id=_new_id(), name=item.name.strip())
            db.add(t)
            for slot in item.unavailable_slots:
                db.add(TeacherUnavailableModel(teacher_id=t.id, day=slot.day, period=slot.period))
            counts["teachers"]["added"] += 1

        for tid, item in tc.updated.items():
            t = db.query(TeacherModel).filter(TeacherModel.id == tid).first()
            if not t:
                raise HTTPException(404, f"Teacher {tid} not found")
            t.name = item.name.strip()
            db.query(TeacherUnavailableModel).filter(
                TeacherUnavailableModel.teacher_id == tid
            ).delete()
            for slot in item.unavailable_slots:
                db.add(TeacherUnavailableModel(teacher_id=tid, day=slot.day, period=slot.period))
            counts["teachers"]["updated"] += 1

        for tid in tc.deleted:
            t = db.query(TeacherModel).filter(TeacherModel.id == tid).first()
            if t:
                db.delete(t)
                counts["teachers"]["deleted"] += 1

        # ── Subjects ──────────────────────────────────────────────────────
        sc = body.subjects
        counts["subjects"] = {"added": 0, "updated": 0, "deleted": 0}

        for item in sc.added:
            db.add(SubjectModel(id=_new_id(), name=item.name.strip(),
                is_difficult=item.is_difficult, is_lab=item.is_lab, priority=item.priority))
            counts["subjects"]["added"] += 1

        for sid, item in sc.updated.items():
            s = db.query(SubjectModel).filter(SubjectModel.id == sid).first()
            if not s:
                raise HTTPException(404, f"Subject {sid} not found")
            s.name=item.name.strip(); s.is_difficult=item.is_difficult
            s.is_lab=item.is_lab; s.priority=item.priority
            counts["subjects"]["updated"] += 1

        for sid in sc.deleted:
            s = db.query(SubjectModel).filter(SubjectModel.id == sid).first()
            if s:
                db.delete(s)
                counts["subjects"]["deleted"] += 1

        # ── Rooms ─────────────────────────────────────────────────────────
        rc = body.rooms
        counts["rooms"] = {"added": 0, "updated": 0, "deleted": 0}

        for item in rc.added:
            db.add(RoomModel(id=_new_id(), name=item.name.strip(), is_lab=item.is_lab))
            counts["rooms"]["added"] += 1

        for rid, item in rc.updated.items():
            r = db.query(RoomModel).filter(RoomModel.id == rid).first()
            if not r:
                raise HTTPException(404, f"Room {rid} not found")
            r.name=item.name.strip(); r.is_lab=item.is_lab
            counts["rooms"]["updated"] += 1

        for rid in rc.deleted:
            r = db.query(RoomModel).filter(RoomModel.id == rid).first()
            if r:
                db.delete(r)
                counts["rooms"]["deleted"] += 1

        # ── Classes ───────────────────────────────────────────────────────
        cc = body.classes
        counts["classes"] = {"added": 0, "updated": 0, "deleted": 0}

        for item in cc.added:
            db.add(ClassModel(id=_new_id(), name=item.name.strip()))
            counts["classes"]["added"] += 1

        for cid, item in cc.updated.items():
            c = db.query(ClassModel).filter(ClassModel.id == cid).first()
            if not c:
                raise HTTPException(404, f"Class {cid} not found")
            c.name = item.name.strip()
            counts["classes"]["updated"] += 1

        for cid in cc.deleted:
            c = db.query(ClassModel).filter(ClassModel.id == cid).first()
            if c:
                db.delete(c)
                counts["classes"]["deleted"] += 1

        # ── Lessons ───────────────────────────────────────────────────────
        lc = body.lessons
        counts["lessons"] = {"added": 0, "updated": 0, "deleted": 0}

        for item in lc.added:
            lesson = LessonBlockModel(
                id=_new_id(), subject_id=item.subject_id,
                duration=item.duration, is_locked=item.is_locked,
                locked_day=item.locked_day, locked_start_period=item.locked_start_period,
            )
            lesson.teachers = db.query(TeacherModel).filter(TeacherModel.id.in_(item.teacher_ids)).all()
            lesson.classes  = db.query(ClassModel).filter(ClassModel.id.in_(item.class_ids)).all()
            lesson.rooms    = db.query(RoomModel).filter(RoomModel.id.in_(item.room_ids)).all()
            db.add(lesson)
            counts["lessons"]["added"] += 1

        for lid, item in lc.updated.items():
            l = db.query(LessonBlockModel).filter(LessonBlockModel.id == lid).first()
            if not l:
                raise HTTPException(404, f"Lesson {lid} not found")
            l.subject_id=item.subject_id; l.duration=item.duration
            l.is_locked=item.is_locked; l.locked_day=item.locked_day
            l.locked_start_period=item.locked_start_period
            l.teachers = db.query(TeacherModel).filter(TeacherModel.id.in_(item.teacher_ids)).all()
            l.classes  = db.query(ClassModel).filter(ClassModel.id.in_(item.class_ids)).all()
            l.rooms    = db.query(RoomModel).filter(RoomModel.id.in_(item.room_ids)).all()
            counts["lessons"]["updated"] += 1

        for lid in lc.deleted:
            l = db.query(LessonBlockModel).filter(LessonBlockModel.id == lid).first()
            if l:
                db.delete(l)
                counts["lessons"]["deleted"] += 1

        # ── Commit and sync store ──────────────────────────────────────────
        db.commit()
        _sync_store_after_save(db)

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as e:
        db.rollback()
        raise _integrity_error(e)
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))

    return SaveAllResponse(ok=True, counts=counts)


def _sync_store_after_save(db: Session):
    """Reload the in-memory store after a save. One DB round trip."""
    store.load_all(db)


# ══════════════════════════════════════════════════════════════════════════════
# GENERATION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/generate", response_model=GenerateResponse, tags=["Generation"])
def generate(background_tasks: BackgroundTasks, db: DB):
    job = GenerationJobModel(id=_new_id(), status="pending")
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(run_generation, job.id)
    return GenerateResponse(job_id=job.id)


@router.get("/status/{job_id}", response_model=JobStatusResponse, tags=["Generation"])
def job_status(job_id: str, db: DB):
    job = db.query(GenerationJobModel).filter(GenerationJobModel.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        started_at=job.started_at.isoformat() if job.started_at else None,
        finished_at=job.finished_at.isoformat() if job.finished_at else None,
        error=job.error,
        generation_time_seconds = job.generation_time_seconds,
    )


@router.get("/result/{job_id}", response_model=TimetableResultResponse, tags=["Generation"])
def job_result(job_id: str, db: DB):
    tt = (
        db.query(TimetableModel)
        .filter(TimetableModel.job_id == job_id)
        .order_by(TimetableModel.created_at.desc())
        .first()
    )
    if not tt:
        raise HTTPException(404, "Result not ready")

    entries = (
        db.query(TimetableEntryModel)
        .filter(TimetableEntryModel.timetable_id == tt.id)
        .options(selectinload(TimetableEntryModel.lesson))
        .all()
    )

    entry_out = []
    subjects_map = store.get_subjects()
    for e in entries:
        lesson = e.lesson
        subj = subjects_map.get(lesson.subject_id)
        entry_out.append(TimetableEntryOut(
            lesson_id    = lesson.id,
            day          = e.day,
            start_period = e.start_period,
            duration     = e.duration,
            subject_id   = lesson.subject_id,
            subject_name = subj.name if subj else lesson.subject_id,
            teacher_ids  = [t.id for t in lesson.teachers],
            class_ids    = [c.id for c in lesson.classes],
            room_ids     = [r.id for r in lesson.rooms],
        ))

    return TimetableResultResponse(
        timetable_id=tt.id,
        fitness=tt.fitness,
        entries=entry_out,
    )


# ── System ────────────────────────────────────────────────────────────────────

@router.get("/health", tags=["System"])
def health():
    return {
        "status": "ok",
        "store": {k: len(v) for k, v in {
            "teachers": store.get_teachers(),
            "subjects": store.get_subjects(),
            "rooms":    store.get_rooms(),
            "classes":  store.get_classes(),
            "lessons":  store.get_lessons(),
        }.items()},
    }


@router.post("/reload-store", tags=["System"])
def reload_store(db: DB):
    store.load_all(db)
    return {"status": "reloaded"}