"""
routes/api.py
-------------
All data endpoints. Every endpoint requires a valid Neon Auth session token.
user_id is extracted from the verified token and used to scope all queries.
"""
from __future__ import annotations
import uuid
from typing import Annotated

import os
import io
import tempfile

from fastapi.responses import StreamingResponse
from models.orm import (
    TeacherModel, TeacherUnavailableModel,
    SubjectModel, RoomModel, ClassModel,
    LessonBlockModel, GenerationJobModel,
)

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError

import db.session as store
from db.session import get_db, load_user
from auth.verify import get_current_user

from schemas.api import (
    ExportPdfRequest, SaveAllRequest, SaveAllResponse,
    GenerateResponse, JobStatusResponse,
    TimetableResultResponse, TimetableEntryOut,
)
from services.generator import run_generation, get_result

router = APIRouter()
DB   = Annotated[Session, Depends(get_db)]
User = Annotated[dict,    Depends(get_current_user)]

from structures import Break

def _new_id() -> str:
    return str(uuid.uuid4())


def _integrity_error(e: IntegrityError) -> HTTPException:
    msg = str(e.orig).lower()
    if "unique" in msg or "duplicate" in msg:
        return HTTPException(409, "Record already exists")
    if "foreign key" in msg or "violates" in msg:
        return HTTPException(400, "Referenced record does not exist")
    return HTTPException(400, "Database constraint violation")


def _ensure_loaded(db: Session, uid: str):
    """Load user data into store if not already present."""
    if not store.get_teachers(uid) and not store.get_subjects(uid):
        load_user(db, uid)


# ── Serialisers (store now holds plain dicts) ────────────────────────────────

def _teacher_out(t: dict) -> dict:
    return t   # already the right shape from session._teacher_dict

def _lesson_out(l: dict) -> dict:
    return l   # already the right shape from session._lesson_dict


# ══════════════════════════════════════════════════════════════════════════════
# BOOTSTRAP — returns all data for the authenticated user
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/bootstrap", tags=["Data"])
def bootstrap(user: User, db: DB):
    uid = user["id"]
    _ensure_loaded(db, uid)
    return {
        "teachers": list(store.get_teachers(uid).values()),
        "subjects": list(store.get_subjects(uid).values()),
        "rooms":    list(store.get_rooms(uid).values()),
        "classes":  list(store.get_classes(uid).values()),
        "lessons":  list(store.get_lessons(uid).values()),
    }


# ══════════════════════════════════════════════════════════════════════════════
# BATCH SAVE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/save-all", response_model=SaveAllResponse, tags=["Data"])
def save_all(body: SaveAllRequest, user: User, db: DB):
    uid    = user["id"]
    counts: dict[str, dict[str, int]] = {}

    try:
        # ── Teachers ──────────────────────────────────────────────────────
        tc = body.teachers
        counts["teachers"] = {"added": 0, "updated": 0, "deleted": 0}

        for item in tc.added:
            t = TeacherModel(id=_new_id(), user_id=uid, name=item.name.strip())
            db.add(t)
            db.flush()
            for slot in item.unavailable_slots:
                db.add(TeacherUnavailableModel(teacher_id=t.id, day=slot.day, period=slot.period))
            counts["teachers"]["added"] += 1

        for tid, item in tc.updated.items():
            t = db.query(TeacherModel).filter(
                TeacherModel.id == tid, TeacherModel.user_id == uid
            ).first()
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
            t = db.query(TeacherModel).filter(
                TeacherModel.id == tid, TeacherModel.user_id == uid
            ).first()
            if t:
                db.delete(t)
                counts["teachers"]["deleted"] += 1

        # ── Subjects ──────────────────────────────────────────────────────
        sc = body.subjects
        counts["subjects"] = {"added": 0, "updated": 0, "deleted": 0}

        for item in sc.added:
            db.add(SubjectModel(
                id=_new_id(), user_id=uid, name=item.name.strip(),
                is_difficult=item.is_difficult, is_lab=item.is_lab, priority=item.priority,
            ))
            counts["subjects"]["added"] += 1

        for sid, item in sc.updated.items():
            s = db.query(SubjectModel).filter(
                SubjectModel.id == sid, SubjectModel.user_id == uid
            ).first()
            if not s:
                raise HTTPException(404, f"Subject {sid} not found")
            s.name=item.name.strip(); s.is_difficult=item.is_difficult
            s.is_lab=item.is_lab; s.priority=item.priority
            counts["subjects"]["updated"] += 1

        for sid in sc.deleted:
            s = db.query(SubjectModel).filter(
                SubjectModel.id == sid, SubjectModel.user_id == uid
            ).first()
            if s:
                db.delete(s)
                counts["subjects"]["deleted"] += 1

        # ── Rooms ─────────────────────────────────────────────────────────
        rc = body.rooms
        counts["rooms"] = {"added": 0, "updated": 0, "deleted": 0}

        for item in rc.added:
            db.add(RoomModel(id=_new_id(), user_id=uid, name=item.name.strip(), is_lab=item.is_lab))
            counts["rooms"]["added"] += 1

        for rid, item in rc.updated.items():
            r = db.query(RoomModel).filter(
                RoomModel.id == rid, RoomModel.user_id == uid
            ).first()
            if not r:
                raise HTTPException(404, f"Room {rid} not found")
            r.name=item.name.strip(); r.is_lab=item.is_lab
            counts["rooms"]["updated"] += 1

        for rid in rc.deleted:
            r = db.query(RoomModel).filter(
                RoomModel.id == rid, RoomModel.user_id == uid
            ).first()
            if r:
                db.delete(r)
                counts["rooms"]["deleted"] += 1

        # ── Classes ───────────────────────────────────────────────────────
        cc = body.classes
        counts["classes"] = {"added": 0, "updated": 0, "deleted": 0}

        for item in cc.added:
            db.add(ClassModel(id=_new_id(), user_id=uid, name=item.name.strip()))
            counts["classes"]["added"] += 1

        for cid, item in cc.updated.items():
            c = db.query(ClassModel).filter(
                ClassModel.id == cid, ClassModel.user_id == uid
            ).first()
            if not c:
                raise HTTPException(404, f"Class {cid} not found")
            c.name = item.name.strip()
            counts["classes"]["updated"] += 1

        for cid in cc.deleted:
            c = db.query(ClassModel).filter(
                ClassModel.id == cid, ClassModel.user_id == uid
            ).first()
            if c:
                db.delete(c)
                counts["classes"]["deleted"] += 1

        # ── Lessons ───────────────────────────────────────────────────────
        lc = body.lessons
        counts["lessons"] = {"added": 0, "updated": 0, "deleted": 0}

        for item in lc.added:
            lesson = LessonBlockModel(
                id          = _new_id(),
                subject_id  = item.subject_id,
                sessions    = [{"duration": s.duration, "count": s.count} for s in item.sessions],
                is_locked   = item.is_locked,
                locked_day          = item.locked_day,
                locked_start_period = item.locked_start_period,
                locked_duration     = item.locked_duration,
            )
            # Only allow teachers/classes/rooms belonging to this user
            lesson.teachers = db.query(TeacherModel).filter(
                TeacherModel.id.in_(item.teacher_ids),
                TeacherModel.user_id == uid,
            ).all()
            lesson.classes = db.query(ClassModel).filter(
                ClassModel.id.in_(item.class_ids),
                ClassModel.user_id == uid,
            ).all()
            lesson.rooms = db.query(RoomModel).filter(
                RoomModel.id.in_(item.room_ids),
                RoomModel.user_id == uid,
            ).all()
            db.add(lesson)
            counts["lessons"]["added"] += 1

        for lid, item in lc.updated.items():
            # Verify lesson belongs to user via subject ownership
            l = (
                db.query(LessonBlockModel)
                .join(SubjectModel, LessonBlockModel.subject_id == SubjectModel.id)
                .filter(LessonBlockModel.id == lid, SubjectModel.user_id == uid)
                .first()
            )
            if not l:
                raise HTTPException(404, f"Lesson {lid} not found")
            l.subject_id          = item.subject_id
            l.sessions            = [{"duration": s.duration, "count": s.count} for s in item.sessions]
            l.is_locked           = item.is_locked
            l.locked_day          = item.locked_day
            l.locked_start_period = item.locked_start_period
            l.locked_duration     = item.locked_duration
            l.teachers = db.query(TeacherModel).filter(
                TeacherModel.id.in_(item.teacher_ids), TeacherModel.user_id == uid,
            ).all()
            l.classes = db.query(ClassModel).filter(
                ClassModel.id.in_(item.class_ids), ClassModel.user_id == uid,
            ).all()
            l.rooms = db.query(RoomModel).filter(
                RoomModel.id.in_(item.room_ids), RoomModel.user_id == uid,
            ).all()
            counts["lessons"]["updated"] += 1

        for lid in lc.deleted:
            l = (
                db.query(LessonBlockModel)
                .join(SubjectModel, LessonBlockModel.subject_id == SubjectModel.id)
                .filter(LessonBlockModel.id == lid, SubjectModel.user_id == uid)
                .first()
            )
            if l:
                db.delete(l)
                counts["lessons"]["deleted"] += 1

        db.commit()
        load_user(db, uid)   # re-sync in-memory store for this user

    except HTTPException as e:
        db.rollback()
        print(f"[save-all] HTTPException {e.status_code}: {e.detail}")
        raise
    except IntegrityError as e:
        db.rollback()
        print(f"[save-all] IntegrityError: {e.orig}")
        raise _integrity_error(e)
    except Exception as e:
        import traceback
        db.rollback()
        print(f"[save-all] ERROR: {traceback.format_exc()}")
        raise HTTPException(500, str(e))

    return SaveAllResponse(ok=True, counts=counts)


# ══════════════════════════════════════════════════════════════════════════════
# GENERATION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/generate", response_model=GenerateResponse, tags=["Generation"])
def generate(background_tasks: BackgroundTasks, user: User, db: DB):
    uid = user["id"]
    job = GenerationJobModel(id=_new_id(), user_id=uid, status="pending")
    db.add(job)
    db.commit()
    background_tasks.add_task(run_generation, job.id, uid)
    return GenerateResponse(job_id=job.id)


@router.get("/status/{job_id}", response_model=JobStatusResponse, tags=["Generation"])
def job_status(job_id: str, user: User, db: DB):
    uid = user["id"]
    job = db.query(GenerationJobModel).filter(
        GenerationJobModel.id == job_id,
        GenerationJobModel.user_id == uid,
    ).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return JobStatusResponse(
        job_id                  = job.id,
        status                  = job.status,
        started_at              = job.started_at.isoformat() if job.started_at else None,
        finished_at             = job.finished_at.isoformat() if job.finished_at else None,
        error                   = job.error,
        generation_time_seconds = job.generation_time_seconds,
    )


@router.get("/result/{job_id}", response_model=TimetableResultResponse, tags=["Generation"])
def job_result(job_id: str, user: User, db: DB):
    uid = user["id"]
    # Verify job belongs to this user
    job = db.query(GenerationJobModel).filter(
        GenerationJobModel.id == job_id,
        GenerationJobModel.user_id == uid,
    ).first()
    if not job:
        raise HTTPException(404, "Job not found")

    # Result lives in memory — never written to DB
    result = get_result(job_id)
    if not result:
        raise HTTPException(404, "Result not ready")

    return TimetableResultResponse(
        timetable_id = result["timetable_id"],
        fitness      = result["fitness"],
        entries      = [TimetableEntryOut(**e) for e in result["entries"]],
    )

# ── PDF Export ────────────────────────────────────────────────────────────────

@router.post("/export-pdf/{job_id}", tags=["Generation"])
def export_pdf(job_id: str, user: User, db: DB, body: ExportPdfRequest):
    print("[export-pdf] job_id:", job_id)
    print("[export-pdf] body entries count:", len(body.entries))
    print("[export-pdf] first entry:", body.entries[0] if body.entries else None)
    from services.mapper import fetch_and_map
    from pdf_generation import generate_pdf_timetable

    from structures import Timetable, TimeSlot

    PERIODS_PER_DAY = 7
    DAYS = 5
    def _make_breaks() -> dict:
        breaks = {}
        for day in range(DAYS - 1):
            breaks[(day, 3)] = Break("Lunch")
        breaks[(DAYS - 1, 4)] = Break("Lunch")
        return breaks


    uid = user["id"]

    # Verify job belongs to user
    job = db.query(GenerationJobModel).filter(
        GenerationJobModel.id == job_id,
        GenerationJobModel.user_id == uid,
    ).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status != "done":
        raise HTTPException(400, "Timetable not ready — job has not completed successfully")
    
    entries = body.entries
    _ensure_loaded(db, uid)
    # Fetch GA structures
    teachers, subjects, rooms, classes, lesson_blocks = fetch_and_map(uid)
    

    # Build GA Timetable
    breaks = _make_breaks()
    locked = [lb for lb in lesson_blocks if lb.is_locked]
    tt = Timetable(DAYS, PERIODS_PER_DAY, breaks, locked)

    # Build reverse map: db_lesson_id -> GA LessonBlock list
    # KEY FIX: use lb.db_id (the original DB id stored on GA object) not get_db_lesson_id()
    # Build reverse map: lesson_id -> GA LessonBlock list
    db_to_ga: dict[str, list] = {}
    for lb in lesson_blocks:
        db_id = lb.id.rsplit("_", 1)[0]  # strips _0, _1, _locked etc
        db_to_ga.setdefault(db_id, []).append(lb)

    for entry in entries:
        ts = TimeSlot(entry.day, entry.start_period, entry.duration)
        ga_lessons = db_to_ga.get(entry.lesson_id, [])
        for lb in ga_lessons:
            if tt.get_assignment(lb.id) is None and lb.duration == entry.duration:
                tt.assign(lb, ts)
                break

    # Stream PDF
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        generate_pdf_timetable(
            timetable=tt,
            classes=classes,
            teachers=teachers,
            subjects=subjects,
            lesson_blocks=lesson_blocks,
            filename=tmp_path,
        )
        with open(tmp_path, "rb") as f:
            pdf_bytes = f.read()
    finally:
        os.unlink(tmp_path)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="timetable_{job_id[:8]}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )

# ── System ────────────────────────────────────────────────────────────────────

@router.get("/health", tags=["System"])
def health():
    return {"status": "ok"}


@router.post("/reload-store", tags=["System"])
def reload_store(user: User, db: DB):
    load_user(db, user["id"])
    return {"status": "reloaded", "user_id": user["id"]}