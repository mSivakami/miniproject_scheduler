"""
generate.py
-----------
Single public function: generate(db)

Fetches data from Neon, runs the genetic scheduler, and returns the
timetable assignments as a plain JSON-serialisable dict.

Output shape
------------
{
  "fitness": 1234,
  "assignments": {
    "<lesson_id>": {
      "day": 0,
      "start_period": 2,
      "duration": 1,
      "periods": [2]
    },
    ...
  },
  "meta": {
    "lessons_total": 120,
    "lessons_assigned": 118,
    "lessons_unassigned": 2,
    "generations_run": 400
  }
}
"""

from sqlalchemy.orm import Session

from mapper import fetch_and_map
from genetic import GeneticTimetableScheduler


DAYS            = 5
PERIODS_PER_DAY = 7


def generate(db: Session) -> dict:
    # ── 1. Fetch & map from Neon ──────────────────────────────────────────
    teachers, subjects, rooms, classes, lesson_blocks, breaks = fetch_and_map(db)

    if not lesson_blocks:
        return {
            "fitness": 0,
            "assignments": {},
            "meta": {
                "lessons_total": 0,
                "lessons_assigned": 0,
                "lessons_unassigned": 0,
                "generations_run": 0,
            },
        }

    # ── 2. Run genetic algorithm ──────────────────────────────────────────
    scheduler = GeneticTimetableScheduler(
        teachers=teachers,
        subjects=subjects,
        rooms=rooms,
        classes=classes,
        lesson_blocks=lesson_blocks,
        days=DAYS,
        periods_per_day=PERIODS_PER_DAY,
        breaks=breaks,
    )

    best_tt, history = scheduler.evolve()

    # ── 3. Serialise assignments → JSON-safe dict ─────────────────────────
    assignments_out: dict[str, dict] = {}
    assigned_count = 0

    for lesson in lesson_blocks:
        ts = best_tt.get_assignment(lesson.id)
        if ts is None:
            continue
        assigned_count += 1
        assignments_out[lesson.id] = {
            "day":          ts.day,
            "start_period": ts.start_period,
            "duration":     ts.duration,
            "periods":      ts.get_periods(),
        }

    total = len(lesson_blocks)

    return {
        "fitness": history[-1] if history else None,
        "assignments": assignments_out,
        "meta": {
            "lessons_total":      total,
            "lessons_assigned":   assigned_count,
            "lessons_unassigned": total - assigned_count,
            "generations_run":    len(history),
        },
    }