"""
services/generator.py
---------------------
Runs GA in a background thread for a specific user.
Results are stored in memory only — not persisted to DB.
Frontend fetches the result once and holds it for the session.
Uses each user's institution settings for days, periods, and break slots.
"""
from __future__ import annotations
import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from db.session import SessionLocal, load_user, get_settings, parse_breaks
from models.orm import GenerationJobModel
from services.mapper import fetch_and_map, get_db_lesson_id
from genetic import GeneticTimetableScheduler
from structures import Break

# Fallback defaults if settings are not configured
DEFAULT_DAYS            = 5
DEFAULT_PERIODS_PER_DAY = 7

# In-memory result store: { job_id: { timetable_id, fitness, entries, generation_time_seconds } }
_results: dict[str, dict] = {}


def get_result(job_id: str) -> dict | None:
    return _results.get(job_id)


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

        # Read institution settings for this user
        settings        = get_settings(user_id)
        days            = settings["num_days"]    if settings else DEFAULT_DAYS
        periods_per_day = settings["num_periods"] if settings else DEFAULT_PERIODS_PER_DAY
        breaks          = parse_breaks(settings["break_periods"] if settings else [])

        print(
            f"[generator] user={user_id[:8]}… "
            f"days={days} periods={periods_per_day} "
            f"breaks={len(breaks)} lesson_blocks={len(lesson_blocks)}"
        )

        ga_start = time.time()
        scheduler = GeneticTimetableScheduler(
            teachers=teachers,
            subjects=subjects,
            rooms=rooms,
            classes=classes,
            lesson_blocks=lesson_blocks,
            days=days,
            periods_per_day=periods_per_day,
            breaks=breaks,
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