# """
# main.py  (lives in /api/)
# -------------------------
# FastAPI app deployed on Vercel (serverless).

# POST /generate          →   run genetic scheduler, return timetable JSON
# GET  /health            →   liveness check
# GET  /init-db           →   create tables (run once after first deploy)
# POST /teachers          →   create teacher
# GET  /teachers          →   list teachers
# GET  /teachers/{tid}    →   get teacher
# PUT  /teachers/{tid}    →   update teacher
# DELETE /teachers/{tid}  →   delete teacher
# ... same for subjects, rooms, classes, lessons, breaks
# """

# import os
# import uuid
# from typing import Optional

# from dotenv import load_dotenv
# load_dotenv()

# from fastapi import FastAPI, HTTPException, Depends
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from sqlalchemy.orm import Session
# from sqlalchemy.exc import IntegrityError

# from database import get_db, init_db
# from generate import generate as run_generate
# from models import (
#     TeacherModel, TeacherUnavailableModel,
#     SubjectModel, RoomModel, ClassModel,
#     LessonBlockModel, BreakModel,
# )

# # ── app ───────────────────────────────────────────────────────────────────────

# app = FastAPI(title="Timetable Scheduler API", version="1.0.0")

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )


# @app.on_event("startup")
# def startup():
#     init_db()


# # ── helpers ───────────────────────────────────────────────────────────────────

# def _new_id() -> str:
#     return str(uuid.uuid4())


# def _handle_integrity(e: IntegrityError) -> HTTPException:
#     msg = str(e.orig).lower()
#     if "unique" in msg or "duplicate" in msg:
#         return HTTPException(409, "A record with that name or ID already exists")
#     if "foreign key" in msg or "violates" in msg:
#         return HTTPException(400, "Referenced record does not exist")
#     if "check" in msg:
#         return HTTPException(400, "Value out of range — check your input")
#     return HTTPException(400, "Database constraint violation")


# # ══════════════════════════════════════════════════════════════════════════════
# # SCHEMAS
# # ══════════════════════════════════════════════════════════════════════════════

# class UnavailableSlot(BaseModel):
#     day: int
#     period: int

# class TeacherIn(BaseModel):
#     name: str
#     unavailable_slots: list[UnavailableSlot] = []

# class SubjectIn(BaseModel):
#     name: str
#     is_difficult: bool = False
#     is_lab: bool = False
#     priority: int = 5

# class RoomIn(BaseModel):
#     name: str
#     is_lab: bool = False

# class ClassIn(BaseModel):
#     name: str

# class LessonIn(BaseModel):
#     subject_id: str
#     teacher_ids: list[str]
#     class_ids: list[str]
#     room_ids: list[str]
#     duration: int = 1
#     is_locked: bool = False
#     locked_day: Optional[int] = None
#     locked_start_period: Optional[int] = None

# class BreakIn(BaseModel):
#     day: int
#     period: int
#     name: str = "Break"


# # ── serialiser helpers ────────────────────────────────────────────────────────

# def _teacher_out(t: TeacherModel) -> dict:
#     return {
#         "id":   t.id,
#         "name": t.name,
#         "unavailable_slots": [
#             {"day": u.day, "period": u.period}
#             for u in t.unavailable
#         ],
#     }

# def _lesson_out(l: LessonBlockModel) -> dict:
#     return {
#         "id":                  l.id,
#         "subject_id":          l.subject_id,
#         "teacher_ids":         [t.id for t in l.teachers],
#         "class_ids":           [c.id for c in l.classes],
#         "room_ids":            [r.id for r in l.rooms],
#         "duration":            l.duration,
#         "is_locked":           l.is_locked,
#         "locked_day":          l.locked_day,
#         "locked_start_period": l.locked_start_period,
#     }


# # ══════════════════════════════════════════════════════════════════════════════
# # HEALTH / INIT
# # ══════════════════════════════════════════════════════════════════════════════

# @app.get("/health", tags=["System"])
# def health():
#     return {"status": "ok"}


# @app.get("/init-db", tags=["System"])
# def create_tables():
#     try:
#         init_db()
#         return {"status": "tables created"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# # ══════════════════════════════════════════════════════════════════════════════
# # GENERATE
# # ══════════════════════════════════════════════════════════════════════════════

# @app.post("/generate", tags=["Scheduler"])
# def generate(db: Session = Depends(get_db)):
#     try:
#         result = run_generate(db)
#         return result
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# # ══════════════════════════════════════════════════════════════════════════════
# # TEACHERS
# # ══════════════════════════════════════════════════════════════════════════════

# @app.post("/teachers", status_code=201, tags=["Teachers"])
# def create_teacher(body: TeacherIn, db: Session = Depends(get_db)):
#     if not body.name.strip():
#         raise HTTPException(400, "Name cannot be empty")

#     teacher = TeacherModel(id=_new_id(), name=body.name.strip())
#     db.add(teacher)

#     for slot in body.unavailable_slots:
#         if not (0 <= slot.day <= 4):
#             raise HTTPException(400, f"day must be 0–4, got {slot.day}")
#         if not (0 <= slot.period <= 6):
#             raise HTTPException(400, f"period must be 0–6, got {slot.period}")
#         db.add(TeacherUnavailableModel(
#             teacher_id=teacher.id,
#             day=slot.day,
#             period=slot.period,
#         ))

#     try:
#         db.commit()
#     except IntegrityError as e:
#         db.rollback()
#         raise _handle_integrity(e)

#     db.refresh(teacher)
#     return _teacher_out(teacher)


# @app.get("/teachers", tags=["Teachers"])
# def list_teachers(db: Session = Depends(get_db)):
#     return [_teacher_out(t) for t in db.query(TeacherModel).all()]


# @app.get("/teachers/{tid}", tags=["Teachers"])
# def get_teacher(tid: str, db: Session = Depends(get_db)):
#     t = db.query(TeacherModel).filter(TeacherModel.id == tid).first()
#     if not t:
#         raise HTTPException(404, "Teacher not found")
#     return _teacher_out(t)


# @app.put("/teachers/{tid}", tags=["Teachers"])
# def update_teacher(tid: str, body: TeacherIn, db: Session = Depends(get_db)):
#     if not body.name.strip():
#         raise HTTPException(400, "Name cannot be empty")

#     t = db.query(TeacherModel).filter(TeacherModel.id == tid).first()
#     if not t:
#         raise HTTPException(404, "Teacher not found")

#     t.name = body.name.strip()

#     db.query(TeacherUnavailableModel).filter(
#         TeacherUnavailableModel.teacher_id == tid
#     ).delete()

#     for slot in body.unavailable_slots:
#         if not (0 <= slot.day <= 4):
#             raise HTTPException(400, f"day must be 0–4, got {slot.day}")
#         if not (0 <= slot.period <= 6):
#             raise HTTPException(400, f"period must be 0–6, got {slot.period}")
#         db.add(TeacherUnavailableModel(
#             teacher_id=tid,
#             day=slot.day,
#             period=slot.period,
#         ))

#     try:
#         db.commit()
#     except IntegrityError as e:
#         db.rollback()
#         raise _handle_integrity(e)

#     db.refresh(t)
#     return _teacher_out(t)


# @app.delete("/teachers/{tid}", status_code=204, tags=["Teachers"])
# def delete_teacher(tid: str, db: Session = Depends(get_db)):
#     t = db.query(TeacherModel).filter(TeacherModel.id == tid).first()
#     if not t:
#         raise HTTPException(404, "Teacher not found")
#     try:
#         db.delete(t)
#         db.commit()
#     except IntegrityError:
#         db.rollback()
#         raise HTTPException(409, "Teacher is assigned to lessons — delete lessons first")


# # ══════════════════════════════════════════════════════════════════════════════
# # SUBJECTS
# # ══════════════════════════════════════════════════════════════════════════════

# @app.post("/subjects", status_code=201, tags=["Subjects"])
# def create_subject(body: SubjectIn, db: Session = Depends(get_db)):
#     if not body.name.strip():
#         raise HTTPException(400, "Name cannot be empty")
#     if not 1 <= body.priority <= 10:
#         raise HTTPException(400, "Priority must be between 1 and 10")

#     row = SubjectModel(
#         id=_new_id(),
#         name=body.name.strip(),
#         is_difficult=body.is_difficult,
#         is_lab=body.is_lab,
#         priority=body.priority,
#     )
#     db.add(row)
#     try:
#         db.commit()
#     except IntegrityError as e:
#         db.rollback()
#         raise _handle_integrity(e)
#     db.refresh(row)
#     return row


# @app.get("/subjects", tags=["Subjects"])
# def list_subjects(db: Session = Depends(get_db)):
#     return db.query(SubjectModel).all()


# @app.get("/subjects/{sid}", tags=["Subjects"])
# def get_subject(sid: str, db: Session = Depends(get_db)):
#     s = db.query(SubjectModel).filter(SubjectModel.id == sid).first()
#     if not s:
#         raise HTTPException(404, "Subject not found")
#     return s


# @app.put("/subjects/{sid}", tags=["Subjects"])
# def update_subject(sid: str, body: SubjectIn, db: Session = Depends(get_db)):
#     if not body.name.strip():
#         raise HTTPException(400, "Name cannot be empty")
#     if not 1 <= body.priority <= 10:
#         raise HTTPException(400, "Priority must be between 1 and 10")

#     s = db.query(SubjectModel).filter(SubjectModel.id == sid).first()
#     if not s:
#         raise HTTPException(404, "Subject not found")

#     s.name         = body.name.strip()
#     s.is_difficult = body.is_difficult
#     s.is_lab       = body.is_lab
#     s.priority     = body.priority

#     try:
#         db.commit()
#     except IntegrityError as e:
#         db.rollback()
#         raise _handle_integrity(e)
#     db.refresh(s)
#     return s


# @app.delete("/subjects/{sid}", status_code=204, tags=["Subjects"])
# def delete_subject(sid: str, db: Session = Depends(get_db)):
#     s = db.query(SubjectModel).filter(SubjectModel.id == sid).first()
#     if not s:
#         raise HTTPException(404, "Subject not found")
#     try:
#         db.delete(s)
#         db.commit()
#     except IntegrityError:
#         db.rollback()
#         raise HTTPException(409, "Subject is used in lessons — delete lessons first")


# # ══════════════════════════════════════════════════════════════════════════════
# # ROOMS
# # ══════════════════════════════════════════════════════════════════════════════

# @app.post("/rooms", status_code=201, tags=["Rooms"])
# def create_room(body: RoomIn, db: Session = Depends(get_db)):
#     if not body.name.strip():
#         raise HTTPException(400, "Name cannot be empty")

#     row = RoomModel(id=_new_id(), name=body.name.strip(), is_lab=body.is_lab)
#     db.add(row)
#     try:
#         db.commit()
#     except IntegrityError as e:
#         db.rollback()
#         raise _handle_integrity(e)
#     db.refresh(row)
#     return row


# @app.get("/rooms", tags=["Rooms"])
# def list_rooms(db: Session = Depends(get_db)):
#     return db.query(RoomModel).all()


# @app.get("/rooms/{rid}", tags=["Rooms"])
# def get_room(rid: str, db: Session = Depends(get_db)):
#     r = db.query(RoomModel).filter(RoomModel.id == rid).first()
#     if not r:
#         raise HTTPException(404, "Room not found")
#     return r


# @app.put("/rooms/{rid}", tags=["Rooms"])
# def update_room(rid: str, body: RoomIn, db: Session = Depends(get_db)):
#     if not body.name.strip():
#         raise HTTPException(400, "Name cannot be empty")

#     r = db.query(RoomModel).filter(RoomModel.id == rid).first()
#     if not r:
#         raise HTTPException(404, "Room not found")

#     r.name   = body.name.strip()
#     r.is_lab = body.is_lab

#     try:
#         db.commit()
#     except IntegrityError as e:
#         db.rollback()
#         raise _handle_integrity(e)
#     db.refresh(r)
#     return r


# @app.delete("/rooms/{rid}", status_code=204, tags=["Rooms"])
# def delete_room(rid: str, db: Session = Depends(get_db)):
#     r = db.query(RoomModel).filter(RoomModel.id == rid).first()
#     if not r:
#         raise HTTPException(404, "Room not found")
#     try:
#         db.delete(r)
#         db.commit()
#     except IntegrityError:
#         db.rollback()
#         raise HTTPException(409, "Room is assigned to lessons — delete lessons first")


# # ══════════════════════════════════════════════════════════════════════════════
# # CLASSES
# # ══════════════════════════════════════════════════════════════════════════════

# @app.post("/classes", status_code=201, tags=["Classes"])
# def create_class(body: ClassIn, db: Session = Depends(get_db)):
#     if not body.name.strip():
#         raise HTTPException(400, "Name cannot be empty")

#     row = ClassModel(id=_new_id(), name=body.name.strip())
#     db.add(row)
#     try:
#         db.commit()
#     except IntegrityError as e:
#         db.rollback()
#         raise _handle_integrity(e)
#     db.refresh(row)
#     return row


# @app.get("/classes", tags=["Classes"])
# def list_classes(db: Session = Depends(get_db)):
#     return db.query(ClassModel).all()


# @app.get("/classes/{cid}", tags=["Classes"])
# def get_class(cid: str, db: Session = Depends(get_db)):
#     c = db.query(ClassModel).filter(ClassModel.id == cid).first()
#     if not c:
#         raise HTTPException(404, "Class not found")
#     return c


# @app.put("/classes/{cid}", tags=["Classes"])
# def update_class(cid: str, body: ClassIn, db: Session = Depends(get_db)):
#     if not body.name.strip():
#         raise HTTPException(400, "Name cannot be empty")

#     c = db.query(ClassModel).filter(ClassModel.id == cid).first()
#     if not c:
#         raise HTTPException(404, "Class not found")

#     c.name = body.name.strip()

#     try:
#         db.commit()
#     except IntegrityError as e:
#         db.rollback()
#         raise _handle_integrity(e)
#     db.refresh(c)
#     return c


# @app.delete("/classes/{cid}", status_code=204, tags=["Classes"])
# def delete_class(cid: str, db: Session = Depends(get_db)):
#     c = db.query(ClassModel).filter(ClassModel.id == cid).first()
#     if not c:
#         raise HTTPException(404, "Class not found")
#     try:
#         db.delete(c)
#         db.commit()
#     except IntegrityError:
#         db.rollback()
#         raise HTTPException(409, "Class is assigned to lessons — delete lessons first")


# # ══════════════════════════════════════════════════════════════════════════════
# # LESSONS
# # ══════════════════════════════════════════════════════════════════════════════

# @app.post("/lessons", status_code=201, tags=["Lessons"])
# def create_lesson(body: LessonIn, db: Session = Depends(get_db)):
#     if body.duration not in (1, 2, 3):
#         raise HTTPException(400, "Duration must be 1, 2, or 3")
#     if not body.teacher_ids:
#         raise HTTPException(400, "At least one teacher_id is required")
#     if not body.class_ids:
#         raise HTTPException(400, "At least one class_id is required")
#     if not body.room_ids:
#         raise HTTPException(400, "At least one room_id is required")
#     if body.is_locked and (body.locked_day is None or body.locked_start_period is None):
#         raise HTTPException(400, "Locked lesson must have locked_day and locked_start_period")
#     if body.locked_day is not None and not 0 <= body.locked_day <= 4:
#         raise HTTPException(400, "locked_day must be 0 (Mon) to 4 (Fri)")
#     if body.locked_start_period is not None and not 0 <= body.locked_start_period <= 6:
#         raise HTTPException(400, "locked_start_period must be 0 to 6")

#     subject = db.query(SubjectModel).filter(SubjectModel.id == body.subject_id).first()
#     if not subject:
#         raise HTTPException(400, f"Subject '{body.subject_id}' not found")

#     teachers = db.query(TeacherModel).filter(TeacherModel.id.in_(body.teacher_ids)).all()
#     if len(teachers) != len(body.teacher_ids):
#         raise HTTPException(400, "One or more teacher_ids not found")

#     classes = db.query(ClassModel).filter(ClassModel.id.in_(body.class_ids)).all()
#     if len(classes) != len(body.class_ids):
#         raise HTTPException(400, "One or more class_ids not found")

#     rooms = db.query(RoomModel).filter(RoomModel.id.in_(body.room_ids)).all()
#     if len(rooms) != len(body.room_ids):
#         raise HTTPException(400, "One or more room_ids not found")

#     lesson          = LessonBlockModel(
#         id                  = _new_id(),
#         subject_id          = body.subject_id,
#         duration            = body.duration,
#         is_locked           = body.is_locked,
#         locked_day          = body.locked_day,
#         locked_start_period = body.locked_start_period,
#     )
#     lesson.teachers = teachers
#     lesson.classes  = classes
#     lesson.rooms    = rooms

#     db.add(lesson)
#     try:
#         db.commit()
#     except IntegrityError as e:
#         db.rollback()
#         raise _handle_integrity(e)
#     db.refresh(lesson)
#     return _lesson_out(lesson)


# @app.get("/lessons", tags=["Lessons"])
# def list_lessons(db: Session = Depends(get_db)):
#     return [_lesson_out(l) for l in db.query(LessonBlockModel).all()]


# @app.get("/lessons/{lid}", tags=["Lessons"])
# def get_lesson(lid: str, db: Session = Depends(get_db)):
#     l = db.query(LessonBlockModel).filter(LessonBlockModel.id == lid).first()
#     if not l:
#         raise HTTPException(404, "Lesson not found")
#     return _lesson_out(l)


# @app.put("/lessons/{lid}", tags=["Lessons"])
# def update_lesson(lid: str, body: LessonIn, db: Session = Depends(get_db)):
#     if body.duration not in (1, 2, 3):
#         raise HTTPException(400, "Duration must be 1, 2, or 3")
#     if not body.teacher_ids:
#         raise HTTPException(400, "At least one teacher_id is required")
#     if not body.class_ids:
#         raise HTTPException(400, "At least one class_id is required")
#     if not body.room_ids:
#         raise HTTPException(400, "At least one room_id is required")
#     if body.is_locked and (body.locked_day is None or body.locked_start_period is None):
#         raise HTTPException(400, "Locked lesson must have locked_day and locked_start_period")

#     l = db.query(LessonBlockModel).filter(LessonBlockModel.id == lid).first()
#     if not l:
#         raise HTTPException(404, "Lesson not found")

#     subject = db.query(SubjectModel).filter(SubjectModel.id == body.subject_id).first()
#     if not subject:
#         raise HTTPException(400, f"Subject '{body.subject_id}' not found")

#     teachers = db.query(TeacherModel).filter(TeacherModel.id.in_(body.teacher_ids)).all()
#     if len(teachers) != len(body.teacher_ids):
#         raise HTTPException(400, "One or more teacher_ids not found")

#     classes = db.query(ClassModel).filter(ClassModel.id.in_(body.class_ids)).all()
#     if len(classes) != len(body.class_ids):
#         raise HTTPException(400, "One or more class_ids not found")

#     rooms = db.query(RoomModel).filter(RoomModel.id.in_(body.room_ids)).all()
#     if len(rooms) != len(body.room_ids):
#         raise HTTPException(400, "One or more room_ids not found")

#     l.subject_id          = body.subject_id
#     l.duration            = body.duration
#     l.is_locked           = body.is_locked
#     l.locked_day          = body.locked_day
#     l.locked_start_period = body.locked_start_period
#     l.teachers            = teachers
#     l.classes             = classes
#     l.rooms               = rooms

#     try:
#         db.commit()
#     except IntegrityError as e:
#         db.rollback()
#         raise _handle_integrity(e)
#     db.refresh(l)
#     return _lesson_out(l)


# @app.delete("/lessons/{lid}", status_code=204, tags=["Lessons"])
# def delete_lesson(lid: str, db: Session = Depends(get_db)):
#     l = db.query(LessonBlockModel).filter(LessonBlockModel.id == lid).first()
#     if not l:
#         raise HTTPException(404, "Lesson not found")
#     db.delete(l)
#     db.commit()


# # ══════════════════════════════════════════════════════════════════════════════
# # BREAKS
# # ══════════════════════════════════════════════════════════════════════════════

# @app.post("/breaks", status_code=201, tags=["Breaks"])
# def create_break(body: BreakIn, db: Session = Depends(get_db)):
#     if not 0 <= body.day <= 4:
#         raise HTTPException(400, "day must be 0 (Mon) to 4 (Fri)")
#     if not 0 <= body.period <= 6:
#         raise HTTPException(400, "period must be 0 to 6")

#     row = BreakModel(day=body.day, period=body.period, name=body.name)
#     db.add(row)
#     try:
#         db.commit()
#     except IntegrityError:
#         db.rollback()
#         raise HTTPException(409, "A break already exists for that day and period")
#     db.refresh(row)
#     return row


# @app.get("/breaks", tags=["Breaks"])
# def list_breaks(db: Session = Depends(get_db)):
#     return db.query(BreakModel).all()


# @app.delete("/breaks/{day}/{period}", status_code=204, tags=["Breaks"])
# def delete_break(day: int, period: int, db: Session = Depends(get_db)):
#     b = db.query(BreakModel).filter(
#         BreakModel.day == day,
#         BreakModel.period == period,
#     ).first()
#     if not b:
#         raise HTTPException(404, "Break not found")
#     db.delete(b)
#     db.commit()

# @app.post("/seed", tags=["System"])
# def seed_data(db: Session = Depends(get_db)):
#     """One-time seed endpoint. Remove after use."""
#     from sqlalchemy import text
#     import os

#     sql_path = os.path.join(os.path.dirname(__file__), "seed.sql")
    
#     try:
#         with open(sql_path) as f:
#             for line in f:
#                 line = line.strip()
#                 # skip blanks and comments
#                 if not line or line.startswith("--"):
#                     continue
#                 db.execute(text(line))
#         db.commit()
#         return {"status": "seeded successfully"}
#     except Exception as e:
#         db.rollback()
#         raise HTTPException(status_code=500, detail=str(e))

"""
main.py
-------
FastAPI app.

On startup  → load_all(db) fills the in-memory store from Neon once.
On writes   → DB commit first, then store updated in place.
On generate → mapper reads from store (zero DB round trips).
On reload   → GET /reload-store force-reloads from Neon if needed.
"""

import os
import uuid
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from database import get_db, init_db, SessionLocal
from generate import generate as run_generate
import store
from models import (
    TeacherModel, TeacherUnavailableModel,
    SubjectModel, RoomModel, ClassModel,
    LessonBlockModel, BreakModel,
)

# ── app ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Timetable Scheduler API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    """Create tables then load everything into memory."""
    init_db()
    db = SessionLocal()
    try:
        store.load_all(db)
    finally:
        db.close()


# ── helpers ───────────────────────────────────────────────────────────────────

def _new_id() -> str:
    return str(uuid.uuid4())


def _handle_integrity(e: IntegrityError) -> HTTPException:
    msg = str(e.orig).lower()
    if "unique" in msg or "duplicate" in msg:
        return HTTPException(409, "A record with that name or ID already exists")
    if "foreign key" in msg or "violates" in msg:
        return HTTPException(400, "Referenced record does not exist")
    if "check" in msg:
        return HTTPException(400, "Value out of range — check your input")
    return HTTPException(400, "Database constraint violation")


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class UnavailableSlot(BaseModel):
    day: int
    period: int

class TeacherIn(BaseModel):
    name: str
    unavailable_slots: list[UnavailableSlot] = []

class SubjectIn(BaseModel):
    name: str
    is_difficult: bool = False
    is_lab: bool = False
    priority: int = 5

class RoomIn(BaseModel):
    name: str
    is_lab: bool = False

class ClassIn(BaseModel):
    name: str

class LessonIn(BaseModel):
    subject_id: str
    teacher_ids: list[str]
    class_ids: list[str]
    room_ids: list[str]
    duration: int = 1
    is_locked: bool = False
    locked_day: Optional[int] = None
    locked_start_period: Optional[int] = None

class BreakIn(BaseModel):
    day: int
    period: int
    name: str = "Break"


# ── serialisers ───────────────────────────────────────────────────────────────

def _teacher_out(t: TeacherModel) -> dict:
    return {
        "id":   t.id,
        "name": t.name,
        "unavailable_slots": [
            {"day": u.day, "period": u.period} for u in t.unavailable
        ],
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
# SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/health", tags=["System"])
def health():
    return {
        "status": "ok",
        "store": {
            "teachers": len(store.get_teachers()),
            "subjects": len(store.get_subjects()),
            "rooms":    len(store.get_rooms()),
            "classes":  len(store.get_classes()),
            "lessons":  len(store.get_lessons()),
            "breaks":   len(store.get_breaks()),
        }
    }


@app.get("/init-db", tags=["System"])
def create_tables():
    try:
        init_db()
        return {"status": "tables created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reload-store", tags=["System"])
def reload_store(db: Session = Depends(get_db)):
    """
    Force a full reload of the in-memory store from Neon.
    Use this if the store somehow gets out of sync
    (e.g. after a manual DB edit or server restart recovery).
    """
    store.load_all(db)
    return {
        "status": "reloaded",
        "counts": {
            "teachers": len(store.get_teachers()),
            "subjects": len(store.get_subjects()),
            "rooms":    len(store.get_rooms()),
            "classes":  len(store.get_classes()),
            "lessons":  len(store.get_lessons()),
            "breaks":   len(store.get_breaks()),
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# GENERATE
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/generate", tags=["Scheduler"])
def generate(db: Session = Depends(get_db)):
    """
    Runs the GA entirely from in-memory store — no DB round trips.
    Fast even on first call since store is loaded at startup.
    """
    try:
        result = run_generate(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# TEACHERS
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/teachers", status_code=201, tags=["Teachers"])
def create_teacher(body: TeacherIn, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Name cannot be empty")

    teacher = TeacherModel(id=_new_id(), name=body.name.strip())
    db.add(teacher)

    for slot in body.unavailable_slots:
        if not (0 <= slot.day <= 4):
            raise HTTPException(400, f"day must be 0–4, got {slot.day}")
        if not (0 <= slot.period <= 6):
            raise HTTPException(400, f"period must be 0–6, got {slot.period}")
        db.add(TeacherUnavailableModel(
            teacher_id=teacher.id, day=slot.day, period=slot.period,
        ))

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _handle_integrity(e)

    # Reload from DB so relationships are populated before storing
    teacher = (
        db.query(TeacherModel)
        .options(joinedload(TeacherModel.unavailable))
        .filter(TeacherModel.id == teacher.id)
        .first()
    )
    store.upsert_teacher(teacher)
    return _teacher_out(teacher)


@app.get("/teachers", tags=["Teachers"])
def list_teachers(db: Session = Depends(get_db)):
    return [_teacher_out(t) for t in db.query(TeacherModel).all()]


@app.get("/teachers/{tid}", tags=["Teachers"])
def get_teacher(tid: str, db: Session = Depends(get_db)):
    t = db.query(TeacherModel).filter(TeacherModel.id == tid).first()
    if not t:
        raise HTTPException(404, "Teacher not found")
    return _teacher_out(t)


@app.put("/teachers/{tid}", tags=["Teachers"])
def update_teacher(tid: str, body: TeacherIn, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Name cannot be empty")

    t = db.query(TeacherModel).filter(TeacherModel.id == tid).first()
    if not t:
        raise HTTPException(404, "Teacher not found")

    t.name = body.name.strip()
    db.query(TeacherUnavailableModel).filter(
        TeacherUnavailableModel.teacher_id == tid
    ).delete()

    for slot in body.unavailable_slots:
        if not (0 <= slot.day <= 4):
            raise HTTPException(400, f"day must be 0–4, got {slot.day}")
        if not (0 <= slot.period <= 6):
            raise HTTPException(400, f"period must be 0–6, got {slot.period}")
        db.add(TeacherUnavailableModel(
            teacher_id=tid, day=slot.day, period=slot.period,
        ))

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _handle_integrity(e)

    t = (
        db.query(TeacherModel)
        .options(joinedload(TeacherModel.unavailable))
        .filter(TeacherModel.id == tid)
        .first()
    )
    store.upsert_teacher(t)
    return _teacher_out(t)


@app.delete("/teachers/{tid}", status_code=204, tags=["Teachers"])
def delete_teacher(tid: str, db: Session = Depends(get_db)):
    t = db.query(TeacherModel).filter(TeacherModel.id == tid).first()
    if not t:
        raise HTTPException(404, "Teacher not found")
    try:
        db.delete(t)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Teacher is assigned to lessons — delete lessons first")
    store.remove_teacher(tid)


# ══════════════════════════════════════════════════════════════════════════════
# SUBJECTS
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/subjects", status_code=201, tags=["Subjects"])
def create_subject(body: SubjectIn, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Name cannot be empty")
    if not 1 <= body.priority <= 10:
        raise HTTPException(400, "Priority must be between 1 and 10")

    row = SubjectModel(
        id=_new_id(), name=body.name.strip(),
        is_difficult=body.is_difficult, is_lab=body.is_lab, priority=body.priority,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _handle_integrity(e)
    db.refresh(row)
    store.upsert_subject(row)
    return row


@app.get("/subjects", tags=["Subjects"])
def list_subjects(db: Session = Depends(get_db)):
    return db.query(SubjectModel).all()


@app.get("/subjects/{sid}", tags=["Subjects"])
def get_subject(sid: str, db: Session = Depends(get_db)):
    s = db.query(SubjectModel).filter(SubjectModel.id == sid).first()
    if not s:
        raise HTTPException(404, "Subject not found")
    return s


@app.put("/subjects/{sid}", tags=["Subjects"])
def update_subject(sid: str, body: SubjectIn, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Name cannot be empty")
    if not 1 <= body.priority <= 10:
        raise HTTPException(400, "Priority must be between 1 and 10")

    s = db.query(SubjectModel).filter(SubjectModel.id == sid).first()
    if not s:
        raise HTTPException(404, "Subject not found")

    s.name=body.name.strip(); s.is_difficult=body.is_difficult
    s.is_lab=body.is_lab; s.priority=body.priority

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _handle_integrity(e)
    db.refresh(s)
    store.upsert_subject(s)
    return s


@app.delete("/subjects/{sid}", status_code=204, tags=["Subjects"])
def delete_subject(sid: str, db: Session = Depends(get_db)):
    s = db.query(SubjectModel).filter(SubjectModel.id == sid).first()
    if not s:
        raise HTTPException(404, "Subject not found")
    try:
        db.delete(s)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Subject is used in lessons — delete lessons first")
    store.remove_subject(sid)


# ══════════════════════════════════════════════════════════════════════════════
# ROOMS
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/rooms", status_code=201, tags=["Rooms"])
def create_room(body: RoomIn, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Name cannot be empty")

    row = RoomModel(id=_new_id(), name=body.name.strip(), is_lab=body.is_lab)
    db.add(row)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _handle_integrity(e)
    db.refresh(row)
    store.upsert_room(row)
    return row


@app.get("/rooms", tags=["Rooms"])
def list_rooms(db: Session = Depends(get_db)):
    return db.query(RoomModel).all()


@app.get("/rooms/{rid}", tags=["Rooms"])
def get_room(rid: str, db: Session = Depends(get_db)):
    r = db.query(RoomModel).filter(RoomModel.id == rid).first()
    if not r:
        raise HTTPException(404, "Room not found")
    return r


@app.put("/rooms/{rid}", tags=["Rooms"])
def update_room(rid: str, body: RoomIn, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Name cannot be empty")

    r = db.query(RoomModel).filter(RoomModel.id == rid).first()
    if not r:
        raise HTTPException(404, "Room not found")

    r.name=body.name.strip(); r.is_lab=body.is_lab
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _handle_integrity(e)
    db.refresh(r)
    store.upsert_room(r)
    return r


@app.delete("/rooms/{rid}", status_code=204, tags=["Rooms"])
def delete_room(rid: str, db: Session = Depends(get_db)):
    r = db.query(RoomModel).filter(RoomModel.id == rid).first()
    if not r:
        raise HTTPException(404, "Room not found")
    try:
        db.delete(r)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Room is assigned to lessons — delete lessons first")
    store.remove_room(rid)


# ══════════════════════════════════════════════════════════════════════════════
# CLASSES
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/classes", status_code=201, tags=["Classes"])
def create_class(body: ClassIn, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Name cannot be empty")

    row = ClassModel(id=_new_id(), name=body.name.strip())
    db.add(row)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _handle_integrity(e)
    db.refresh(row)
    store.upsert_class(row)
    return row


@app.get("/classes", tags=["Classes"])
def list_classes(db: Session = Depends(get_db)):
    return db.query(ClassModel).all()


@app.get("/classes/{cid}", tags=["Classes"])
def get_class(cid: str, db: Session = Depends(get_db)):
    c = db.query(ClassModel).filter(ClassModel.id == cid).first()
    if not c:
        raise HTTPException(404, "Class not found")
    return c


@app.put("/classes/{cid}", tags=["Classes"])
def update_class(cid: str, body: ClassIn, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Name cannot be empty")

    c = db.query(ClassModel).filter(ClassModel.id == cid).first()
    if not c:
        raise HTTPException(404, "Class not found")

    c.name = body.name.strip()
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _handle_integrity(e)
    db.refresh(c)
    store.upsert_class(c)
    return c


@app.delete("/classes/{cid}", status_code=204, tags=["Classes"])
def delete_class(cid: str, db: Session = Depends(get_db)):
    c = db.query(ClassModel).filter(ClassModel.id == cid).first()
    if not c:
        raise HTTPException(404, "Class not found")
    try:
        db.delete(c)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Class is assigned to lessons — delete lessons first")
    store.remove_class(cid)


# ══════════════════════════════════════════════════════════════════════════════
# LESSONS
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/lessons", status_code=201, tags=["Lessons"])
def create_lesson(body: LessonIn, db: Session = Depends(get_db)):
    if body.duration not in (1, 2, 3):
        raise HTTPException(400, "Duration must be 1, 2, or 3")
    if not body.teacher_ids:
        raise HTTPException(400, "At least one teacher_id is required")
    if not body.class_ids:
        raise HTTPException(400, "At least one class_id is required")
    if not body.room_ids:
        raise HTTPException(400, "At least one room_id is required")
    if body.is_locked and (body.locked_day is None or body.locked_start_period is None):
        raise HTTPException(400, "Locked lesson must have locked_day and locked_start_period")
    if body.locked_day is not None and not 0 <= body.locked_day <= 4:
        raise HTTPException(400, "locked_day must be 0 (Mon) to 4 (Fri)")
    if body.locked_start_period is not None and not 0 <= body.locked_start_period <= 6:
        raise HTTPException(400, "locked_start_period must be 0 to 6")

    subject  = db.query(SubjectModel).filter(SubjectModel.id == body.subject_id).first()
    if not subject:
        raise HTTPException(400, f"Subject '{body.subject_id}' not found")

    teachers = db.query(TeacherModel).filter(TeacherModel.id.in_(body.teacher_ids)).all()
    if len(teachers) != len(body.teacher_ids):
        raise HTTPException(400, "One or more teacher_ids not found")

    classes  = db.query(ClassModel).filter(ClassModel.id.in_(body.class_ids)).all()
    if len(classes) != len(body.class_ids):
        raise HTTPException(400, "One or more class_ids not found")

    rooms    = db.query(RoomModel).filter(RoomModel.id.in_(body.room_ids)).all()
    if len(rooms) != len(body.room_ids):
        raise HTTPException(400, "One or more room_ids not found")

    lesson = LessonBlockModel(
        id=_new_id(), subject_id=body.subject_id,
        duration=body.duration, is_locked=body.is_locked,
        locked_day=body.locked_day, locked_start_period=body.locked_start_period,
    )
    lesson.teachers = teachers
    lesson.classes  = classes
    lesson.rooms    = rooms

    db.add(lesson)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _handle_integrity(e)

    # Reload with relationships fully populated before storing
    lesson = (
        db.query(LessonBlockModel)
        .options(
            joinedload(LessonBlockModel.teachers),
            joinedload(LessonBlockModel.classes),
            joinedload(LessonBlockModel.rooms),
        )
        .filter(LessonBlockModel.id == lesson.id)
        .first()
    )
    store.upsert_lesson(lesson)
    return _lesson_out(lesson)


@app.get("/lessons", tags=["Lessons"])
def list_lessons(db: Session = Depends(get_db)):
    return [_lesson_out(l) for l in db.query(LessonBlockModel).all()]


@app.get("/lessons/{lid}", tags=["Lessons"])
def get_lesson(lid: str, db: Session = Depends(get_db)):
    l = db.query(LessonBlockModel).filter(LessonBlockModel.id == lid).first()
    if not l:
        raise HTTPException(404, "Lesson not found")
    return _lesson_out(l)


@app.put("/lessons/{lid}", tags=["Lessons"])
def update_lesson(lid: str, body: LessonIn, db: Session = Depends(get_db)):
    if body.duration not in (1, 2, 3):
        raise HTTPException(400, "Duration must be 1, 2, or 3")
    if not body.teacher_ids:
        raise HTTPException(400, "At least one teacher_id is required")
    if not body.class_ids:
        raise HTTPException(400, "At least one class_id is required")
    if not body.room_ids:
        raise HTTPException(400, "At least one room_id is required")
    if body.is_locked and (body.locked_day is None or body.locked_start_period is None):
        raise HTTPException(400, "Locked lesson must have locked_day and locked_start_period")

    l = db.query(LessonBlockModel).filter(LessonBlockModel.id == lid).first()
    if not l:
        raise HTTPException(404, "Lesson not found")

    subject  = db.query(SubjectModel).filter(SubjectModel.id == body.subject_id).first()
    if not subject:
        raise HTTPException(400, f"Subject '{body.subject_id}' not found")

    teachers = db.query(TeacherModel).filter(TeacherModel.id.in_(body.teacher_ids)).all()
    if len(teachers) != len(body.teacher_ids):
        raise HTTPException(400, "One or more teacher_ids not found")

    classes  = db.query(ClassModel).filter(ClassModel.id.in_(body.class_ids)).all()
    if len(classes) != len(body.class_ids):
        raise HTTPException(400, "One or more class_ids not found")

    rooms    = db.query(RoomModel).filter(RoomModel.id.in_(body.room_ids)).all()
    if len(rooms) != len(body.room_ids):
        raise HTTPException(400, "One or more room_ids not found")

    l.subject_id=body.subject_id; l.duration=body.duration
    l.is_locked=body.is_locked; l.locked_day=body.locked_day
    l.locked_start_period=body.locked_start_period
    l.teachers=teachers; l.classes=classes; l.rooms=rooms

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise _handle_integrity(e)

    l = (
        db.query(LessonBlockModel)
        .options(
            joinedload(LessonBlockModel.teachers),
            joinedload(LessonBlockModel.classes),
            joinedload(LessonBlockModel.rooms),
        )
        .filter(LessonBlockModel.id == lid)
        .first()
    )
    store.upsert_lesson(l)
    return _lesson_out(l)


@app.delete("/lessons/{lid}", status_code=204, tags=["Lessons"])
def delete_lesson(lid: str, db: Session = Depends(get_db)):
    l = db.query(LessonBlockModel).filter(LessonBlockModel.id == lid).first()
    if not l:
        raise HTTPException(404, "Lesson not found")
    db.delete(l)
    db.commit()
    store.remove_lesson(lid)


# ══════════════════════════════════════════════════════════════════════════════
# BREAKS
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/breaks", status_code=201, tags=["Breaks"])
def create_break(body: BreakIn, db: Session = Depends(get_db)):
    if not 0 <= body.day <= 4:
        raise HTTPException(400, "day must be 0 (Mon) to 4 (Fri)")
    if not 0 <= body.period <= 6:
        raise HTTPException(400, "period must be 0 to 6")

    row = BreakModel(day=body.day, period=body.period, name=body.name)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A break already exists for that day and period")
    db.refresh(row)
    store.upsert_break(row)
    return row


@app.get("/breaks", tags=["Breaks"])
def list_breaks(db: Session = Depends(get_db)):
    return db.query(BreakModel).all()


@app.delete("/breaks/{day}/{period}", status_code=204, tags=["Breaks"])
def delete_break(day: int, period: int, db: Session = Depends(get_db)):
    b = db.query(BreakModel).filter(
        BreakModel.day == day, BreakModel.period == period,
    ).first()
    if not b:
        raise HTTPException(404, "Break not found")
    db.delete(b)
    db.commit()
    store.remove_break(day, period)


# ══════════════════════════════════════════════════════════════════════════════
# SEED
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/seed", tags=["System"])
def seed_data(db: Session = Depends(get_db)):
    """One-time seed endpoint. Remove after use."""
    from sqlalchemy import text

    sql_path = os.path.join(os.path.dirname(__file__), "seed.sql")
    try:
        with open(sql_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("--"):
                    continue
                db.execute(text(line))
        db.commit()
        # Full reload after seed since multiple tables changed at once
        store.load_all(db)
        return {"status": "seeded successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))