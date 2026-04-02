"""
ga_bridge.py — Bridge between FastAPI/DB and the GA Engine
============================================================
Converts SQLAlchemy ORM models into the GA engine's domain structures,
runs the GA, and returns the result.

This file imports from the project root (where ga_engine.py etc. live).
"""

from engine.structures import (
    Teacher as GATeacher,
    Subject as GASubject,
    Room as GARoom,
    Class as GAClass,
    LessonBlock as GALessonBlock,
)
from engine.ga_problem import InstitutionSettings, build_problem_data
from engine.ga_fitness import ConstraintSettings
from engine.ga_engine import GAEngine, GAConfig, GAResult
from engine.ga_timetable import build_timetable, Timetable

from services.bitmask_service import compute_break_mask, compute_working_mask

# Type hints for ORM models (avoid circular import)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from models import Institution, Teacher, Classroom, Subject, Room, LessonBlock


def _db_to_ga_structures(institution, teachers, subjects, rooms, classrooms, lesson_blocks):
    """
    Convert DB ORM objects into the GA engine's domain structures.

    Returns:
        (ga_teachers, ga_subjects, ga_rooms, ga_classes, ga_lesson_blocks, institution_settings)
    """
    # Teachers
    ga_teachers = {}
    for t in teachers:
        ga_teachers[t.id] = GATeacher(
            id=t.id,
            name=t.name,
            available_mask=t.available_mask if t.available_mask != -1 else (1 << 64) - 1,
            max_per_day=t.max_per_day,
            max_per_week=t.max_per_week,
        )

    # Subjects
    ga_subjects = {}
    for s in subjects:
        ga_subjects[s.id] = GASubject(
            id=s.id,
            name=s.name,
            is_difficult=s.is_difficult,
            is_lab=s.is_lab,
            priority=s.priority,
        )

    # Rooms
    ga_rooms = {}
    for r in rooms:
        ga_rooms[r.id] = GARoom(
            id=r.id,
            name=r.name,
            is_lab=r.is_lab,
            available_mask=r.available_mask if r.available_mask != -1 else (1 << 64) - 1,
        )

    # Classes (classrooms in DB terminology)
    ga_classes = {}
    for c in classrooms:
        ga_classes[c.id] = GAClass(
            id=c.id,
            name=c.name,
        )

    # Lesson blocks
    ga_blocks = []
    for lb in lesson_blocks:
        # Get related IDs
        teacher_ids = [t.id for t in lb.teachers]
        subject_ids = [s.id for s in lb.subjects]
        classroom_ids = [c.id for c in lb.classrooms]
        room_ids = [r.id for r in lb.rooms]

        # Determine subject_id (primary — first in list)
        subject_id = subject_ids[0] if subject_ids else ""
        subject_name = lb.subject_name or (ga_subjects[subject_id].name if subject_id and subject_id in ga_subjects else "")

        ga_blocks.append(GALessonBlock(
            id=lb.id,
            teacher_ids=teacher_ids,
            subject_id=subject_id,
            class_ids=classroom_ids,
            room_ids=room_ids,
            duration=lb.duration,
            count=lb.count,
            is_lab=lb.is_lab,
            is_difficult=lb.is_difficult,
            is_locked=lb.is_locked,
            locked_day=lb.locked_day,
            locked_period=lb.locked_period,
            subject_name=subject_name,
        ))

    # Institution settings
    days = institution.days_per_week
    periods = institution.periods_per_day
    break_after = institution.break_after_period

    # Build break slots list (0-indexed): break_after period on each day
    break_slots = [(d, break_after) for d in range(days)]

    inst_settings = InstitutionSettings(
        days=days,
        periods=periods,
        break_slots=break_slots,
    )

    return ga_teachers, ga_subjects, ga_rooms, ga_classes, ga_blocks, inst_settings


def run_ga_from_db(institution, teachers, subjects, rooms, classrooms, lesson_blocks,
                   max_generations=2000, population_size=300,
                   time_limit_seconds=120, seed=None, fast_mode=False) -> dict:
    """
    Run the full GA pipeline using DB data.

    Returns a dict with:
        status, fitness, quality_pct, hard_violations, soft_violations,
        generations, time_ms, violation_details, timetable
    """
    (ga_teachers, ga_subjects, ga_rooms, ga_classes,
     ga_blocks, inst_settings) = _db_to_ga_structures(
        institution, teachers, subjects, rooms, classrooms, lesson_blocks
    )

    # Build ProblemData
    data = build_problem_data(
        settings=inst_settings,
        teachers=ga_teachers,
        subjects=ga_subjects,
        rooms=ga_rooms,
        classes=ga_classes,
        lesson_blocks=ga_blocks,
    )

    # GA configuration
    config = GAConfig(
        population_size=population_size,
        max_generations=max_generations,
        time_limit_seconds=time_limit_seconds,
        verbose=False,
    )

    if fast_mode:
        config.fast_mode_generations = 50
        config.max_generations = min(max_generations, 500)

    # Constraints — use defaults
    constraints = ConstraintSettings()

    # Run!
    engine = GAEngine(data=data, config=config, constraints=constraints, seed=seed)
    result: GAResult = engine.run()

    # Build timetable for display
    timetable: Timetable = build_timetable(result, data)

    # Quality percentage
    quality_pct = max(0.0, min(100.0, result.fitness / 100_000.0 * 100.0))

    # Build expanded timetable dict
    tt_dict = _expand_timetable(timetable, data, inst_settings)

    return {
        "status": result.status,
        "fitness": result.fitness,
        "quality_pct": round(quality_pct, 2),
        "hard_violations": result.hard_violations,
        "soft_violations": result.soft_violations,
        "generations": result.generations,
        "time_ms": result.time_ms,
        "violation_details": [
            {"type": v["type"], "description": v["description"], "block_id": v.get("block_id", "")}
            for v in (result.violation_details or [])
        ],
        "timetable": tt_dict,
    }


def _expand_timetable(timetable: Timetable, data, inst_settings) -> dict:
    """Convert Timetable object into a JSON-serializable dict with grid views."""
    days = inst_settings.days
    periods = inst_settings.periods

    # Build per-class grids
    class_views = {}
    for class_id, class_name in [(c.id, c.name) for c in timetable.classes]:
        grid = []
        for d in range(days):
            day_row = []
            for p in range(periods):
                cell = timetable.get_cell(class_id, d, p)
                if cell:
                    day_row.append({
                        "block_id": cell.block_id,
                        "subject_name": cell.subject_name,
                        "teacher_names": cell.teacher_names,
                        "room_name": cell.room_name,
                        "is_lab": cell.is_lab,
                        "is_locked": cell.is_locked,
                        "is_continuation": cell.is_continuation,
                        "duration": cell.duration,
                    })
                else:
                    day_row.append(None)
            grid.append(day_row)
        class_views[class_id] = {"name": class_name, "grid": grid}

    # Build per-teacher grids
    teacher_views = {}
    for teacher_id, teacher_name in [(t.id, t.name) for t in timetable.teachers]:
        grid = []
        for d in range(days):
            day_row = []
            for p in range(periods):
                cell = timetable.get_teacher_cell(teacher_id, d, p)
                if cell:
                    day_row.append({
                        "block_id": cell.block_id,
                        "subject_name": cell.subject_name,
                        "class_names": cell.class_names,
                        "room_name": cell.room_name,
                        "is_lab": cell.is_lab,
                    })
                else:
                    day_row.append(None)
            grid.append(day_row)
        teacher_views[teacher_id] = {"name": teacher_name, "grid": grid}

    return {
        "metadata": {
            "days": days,
            "periods": periods,
            "day_names": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][:days],
        },
        "class_views": class_views,
        "teacher_views": teacher_views,
    }
