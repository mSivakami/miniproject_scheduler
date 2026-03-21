"""
services/generator.py
---------------------
Runs GA in a background thread for a specific user.
"""
from __future__ import annotations
import uuid
import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from db.session import SessionLocal, load_user
from models.orm import GenerationJobModel, TimetableModel, TimetableEntryModel
from services.mapper import fetch_and_map, get_db_lesson_id
from genetic import GeneticTimetableScheduler
from structures import Break

DAYS            = 5
PERIODS_PER_DAY = 7


def _make_breaks() -> dict:
    breaks = {}
    for day in range(DAYS - 1):
        breaks[(day, 3)] = Break("Lunch")
    breaks[(DAYS - 1, 4)] = Break("Lunch")
    return breaks


def run_generation(job_id: str, user_id: str):
    """
    Called from BackgroundTasks. user_id passed explicitly
    so the background thread knows whose data to schedule.
    """
    db: Session = SessionLocal()
    try:
        job = db.query(GenerationJobModel).filter(GenerationJobModel.id == job_id).first()
        if not job:
            return
        job.status     = "running"
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        # Ensure user data is loaded
        load_user(db, user_id)

        teachers, subjects, rooms, classes, lesson_blocks = fetch_and_map(user_id)

        if not lesson_blocks:
            raise ValueError("No lesson blocks configured — nothing to schedule.")

        ga_start = time.time()
        scheduler = GeneticTimetableScheduler(
            teachers=teachers,
            subjects=subjects,
            rooms=rooms,
            classes=classes,
            lesson_blocks=lesson_blocks,
            days=DAYS,
            periods_per_day=PERIODS_PER_DAY,
            breaks=_make_breaks(),
        )
        best_tt, history = scheduler.evolve()
        ga_seconds    = round(time.time() - ga_start, 2)
        final_fitness = history[-1] if history else 0

        tt_id = str(uuid.uuid4())
        db_tt = TimetableModel(id=tt_id, job_id=job_id, fitness=final_fitness)
        db.add(db_tt)
        db.flush()

        for lesson in lesson_blocks:
            ts = best_tt.get_assignment(lesson.id)
            if ts is None:
                continue
            db_lesson_id = get_db_lesson_id(lesson.id)
            db.add(TimetableEntryModel(
                id           = str(uuid.uuid4()),
                timetable_id = tt_id,
                lesson_id    = db_lesson_id,
                day          = ts.day,
                start_period = ts.start_period,
                duration     = ts.duration,
            ))

        job.status                  = "done"
        job.finished_at             = datetime.now(timezone.utc)
        job.generation_time_seconds = ga_seconds
        db.commit()

    except Exception as exc:
        db.rollback()
        try:
            job = db.query(GenerationJobModel).filter(GenerationJobModel.id == job_id).first()
            if job:
                job.status      = "failed"
                job.error       = str(exc)
                job.finished_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()