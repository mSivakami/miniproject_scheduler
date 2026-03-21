"""
services/generator.py
---------------------
Runs GA in a background thread for a specific user.
Results are stored in memory only — not persisted to DB.
Frontend fetches the result once and holds it for the session.
"""
from __future__ import annotations
import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from db.session import SessionLocal, load_user
from models.orm import GenerationJobModel
from services.mapper import fetch_and_map, get_db_lesson_id
from genetic import GeneticTimetableScheduler
from structures import Break

DAYS            = 5
PERIODS_PER_DAY = 7

# In-memory result store: { job_id: { timetable_id, fitness, entries, generation_time_seconds } }
_results: dict[str, dict] = {}


def get_result(job_id: str) -> dict | None:
    return _results.get(job_id)


def _make_breaks() -> dict:
    breaks = {}
    for day in range(DAYS - 1):
        breaks[(day, 3)] = Break("Lunch")
    breaks[(DAYS - 1, 4)] = Break("Lunch")
    return breaks


def run_generation(job_id: str, user_id: str):
    db: Session = SessionLocal()
    try:
        job = db.query(GenerationJobModel).filter(GenerationJobModel.id == job_id).first()
        if not job:
            return
        job.status     = "running"
        job.started_at = datetime.now(timezone.utc)
        db.commit()

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
        final_fitness = best_tt.fitness if best_tt.fitness is not None else (history[-1] if history else 0)

        # Build result in memory — no DB writes for timetable data
        subjects_map = {sid: s.name for sid, s in subjects.items()}
        entries = []
        for lesson in lesson_blocks:
            ts = best_tt.get_assignment(lesson.id)
            if ts is None:
                continue
            db_lesson_id = get_db_lesson_id(lesson.id)
            entries.append({
                "lesson_id":    db_lesson_id,
                "day":          ts.day,
                "start_period": ts.start_period,
                "duration":     ts.duration,
                "subject_id":   lesson.subject_id,
                "subject_name": subjects_map.get(lesson.subject_id, lesson.subject_id),
                "teacher_ids":  lesson.teacher_ids,
                "class_ids":    lesson.class_ids,
                "room_ids":     lesson.room_ids,
            })

        _results[job_id] = {
            "timetable_id":             job_id,
            "fitness":                  final_fitness,
            "entries":                  entries,
            "generation_time_seconds":  ga_seconds,
        }

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