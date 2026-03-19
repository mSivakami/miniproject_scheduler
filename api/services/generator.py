"""
services/generator.py
---------------------
Runs the Genetic Algorithm in a background thread and persists the result.
Called via FastAPI BackgroundTasks — never blocks the HTTP response.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from db.session import SessionLocal
from models.orm import GenerationJobModel, TimetableModel, TimetableEntryModel
from services.mapper import fetch_and_map
from genetic import GeneticTimetableScheduler
from structures import Break

DAYS            = 5
PERIODS_PER_DAY = 7

# Mon–Thu break at period 3, Fri at period 4
def _make_breaks() -> dict:
    breaks = {}
    for day in range(DAYS - 1):
        breaks[(day, 3)] = Break("Lunch")
    breaks[(DAYS - 1, 4)] = Break("Lunch")
    return breaks


def run_generation(job_id: str):
    """
    Blocking function — call from a thread pool (BackgroundTasks or Celery).
    1. Marks job as running.
    2. Fetches data from in-memory store (zero DB round trips).
    3. Runs the GA.
    4. Persists result.
    5. Marks job as done (or failed).
    """
    db: Session = SessionLocal()
    try:
        # ── Mark running ──────────────────────────────────────────────────
        job = db.query(GenerationJobModel).filter(GenerationJobModel.id == job_id).first()
        if not job:
            return
        job.status     = "running"
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        # ── Map data ──────────────────────────────────────────────────────
        teachers, subjects, rooms, classes, lesson_blocks = fetch_and_map()

        if not lesson_blocks:
            raise ValueError("No lesson blocks configured — nothing to schedule.")

        # ── Run GA ────────────────────────────────────────────────────────
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
        final_fitness = history[-1] if history else 0

        # ── Persist timetable ─────────────────────────────────────────────
        tt_id = str(uuid.uuid4())
        db_tt = TimetableModel(id=tt_id, job_id=job_id, fitness=final_fitness)
        db.add(db_tt)
        db.flush()

        for lesson in lesson_blocks:
            ts = best_tt.get_assignment(lesson.id)
            if ts is None:
                continue
            db.add(TimetableEntryModel(
                id           = str(uuid.uuid4()),
                timetable_id = tt_id,
                lesson_id    = lesson.id,
                day          = ts.day,
                start_period = ts.start_period,
                duration     = ts.duration,
            ))

        # ── Mark done ─────────────────────────────────────────────────────
        job.status      = "done"
        job.finished_at = datetime.now(timezone.utc)
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