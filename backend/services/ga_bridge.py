# -*- coding: utf-8 -*-
"""
ga_bridge.py — Bridge between FastAPI/DB and the GA Engine
============================================================
Converts SQLAlchemy ORM models into the GA engine's domain structures,
runs the GA, and returns the result.

This file imports from the project root (where ga_engine.py etc. live).
"""

import json

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

# Type hints for ORM models (avoid circular import)
from typing import TYPE_CHECKING, Any
if TYPE_CHECKING:
    from models import Institution, Teacher, Classroom, Subject, Room, LessonBlock, ConstraintSettings as ORMConstraintSettings


UI_CONSTRAINT_DEFAULTS = {
    "no_consecutive_periods": {"ui_weight": 70, "backend_weight": 0.5},
    "difficult_not_last": {"ui_weight": 60, "backend_weight": 0.8},
    "avoid_morning_lab": {"ui_weight": 50, "backend_weight": 0.5},
    "no_subject_twice_same_day": {"ui_weight": 80, "backend_weight": 0.7},
}


def _parse_constraint_payload(constraint_settings: "ORMConstraintSettings | None") -> dict[str, Any]:
    if not constraint_settings or not constraint_settings.settings_json:
        return {}

    try:
        payload = json.loads(constraint_settings.settings_json)
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}

    if isinstance(payload, list):
        return {"constraints": payload}
    if isinstance(payload, dict):
        return payload
    return {}


def _normalize_break_slots(raw_breaks: Any, days: int, periods: int) -> list[tuple[int, int]]:
    slots: set[tuple[int, int]] = set()
    if not isinstance(raw_breaks, list):
        return []

    for item in raw_breaks:
        if not isinstance(item, dict):
            continue
        day = item.get("day")
        period = item.get("period")
        if isinstance(day, int) and isinstance(period, int) and 0 <= day < days and 0 <= period < periods:
            slots.add((day, period))

    return sorted(slots)


def _scaled_weight(constraint_id: str, raw_weight: Any) -> float:
    defaults = UI_CONSTRAINT_DEFAULTS.get(constraint_id)
    if defaults is None:
        return 1.0

    try:
        weight = float(raw_weight)
    except (TypeError, ValueError):
        weight = float(defaults["ui_weight"])

    if defaults["ui_weight"] <= 0:
        return float(defaults["backend_weight"])

    scaled = (weight / defaults["ui_weight"]) * defaults["backend_weight"]
    return max(0.0, min(3.0, scaled))


def _build_constraint_settings(constraint_settings: "ORMConstraintSettings | None") -> ConstraintSettings:
    if constraint_settings and not constraint_settings.is_active:
        return ConstraintSettings.all_hard_only()

    cs = ConstraintSettings()
    payload = _parse_constraint_payload(constraint_settings)
    raw_constraints = payload.get("constraints")
    if not isinstance(raw_constraints, list):
        return cs

    by_id = {}
    for item in raw_constraints:
        if isinstance(item, dict) and isinstance(item.get("id"), str):
            by_id[item["id"]] = item

    no_consecutive = by_id.get("no_consecutive_periods")
    if no_consecutive:
        cs.S5 = bool(no_consecutive.get("enabled", True))
        cs.S5_weight = _scaled_weight("no_consecutive_periods", no_consecutive.get("weight"))
        cs.max_consecutive_periods = 2

    difficult_not_last = by_id.get("difficult_not_last")
    if difficult_not_last:
        cs.S2 = bool(difficult_not_last.get("enabled", True))
        cs.S2_weight = _scaled_weight("difficult_not_last", difficult_not_last.get("weight"))

    avoid_morning_lab = by_id.get("avoid_morning_lab")
    if avoid_morning_lab:
        cs.avoid_morning_lab = bool(avoid_morning_lab.get("enabled", False))
        cs.avoid_morning_lab_weight = _scaled_weight("avoid_morning_lab", avoid_morning_lab.get("weight"))

    no_subject_twice = by_id.get("no_subject_twice_same_day")
    if no_subject_twice:
        cs.S3 = bool(no_subject_twice.get("enabled", True))
        cs.S3_weight = _scaled_weight("no_subject_twice_same_day", no_subject_twice.get("weight"))

    return cs


def _db_to_ga_structures(institution, teachers, subjects, rooms, classrooms, lesson_blocks, constraint_settings=None):
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
            available_mask=int(t.available_mask) if int(t.available_mask) != -1 else (1 << 64) - 1,
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
            available_mask=int(r.available_mask) if int(r.available_mask) != -1 else (1 << 64) - 1,
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

    payload = _parse_constraint_payload(constraint_settings)

    # Use custom break slots from saved settings when present. An empty array means "no breaks".
    if "breaks" in payload:
        break_slots = _normalize_break_slots(payload.get("breaks"), days, periods)
    else:
        break_slots = [(d, break_after) for d in range(days) if 0 <= break_after < periods]

    inst_settings = InstitutionSettings(
        days=days,
        periods=periods,
        break_slots=break_slots,
    )

    return ga_teachers, ga_subjects, ga_rooms, ga_classes, ga_blocks, inst_settings


def run_ga_from_db(institution, teachers, subjects, rooms, classrooms, lesson_blocks,
                   constraint_settings=None, constraint_mask: int | None = None,
                   max_generations=600, population_size=150,
                   time_limit_seconds=110, seed=None, fast_mode=False) -> dict:
    """
    Run the full GA pipeline using DB data.

    Returns a dict with:
        status, fitness, quality_pct, hard_violations, soft_violations,
        generations, time_ms, violation_details, timetable
    """
    (ga_teachers, ga_subjects, ga_rooms, ga_classes,
     ga_blocks, inst_settings) = _db_to_ga_structures(
        institution, teachers, subjects, rooms, classrooms, lesson_blocks, constraint_settings=constraint_settings
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
        verbose=True,
        progress_every=10,  # Show update every 10 generations
    )

    if fast_mode:
        config.fast_mode_generations = 50
        config.max_generations = min(max_generations, 500)

    # Resolve constraint settings:
    #   Priority: request mask > DB mask > legacy JSON
    effective_mask = constraint_mask
    if effective_mask is None and constraint_settings and hasattr(constraint_settings, 'constraint_mask'):
        effective_mask = constraint_settings.constraint_mask or None

    if effective_mask is not None and effective_mask > 0:
        from engine.constraint_mask import decode_constraint_mask
        constraints = decode_constraint_mask(effective_mask)
    else:
        constraints = _build_constraint_settings(constraint_settings)

    # Run!
    engine = GAEngine(data=data, config=config, constraints=constraints)
    result: GAResult = engine.run()

    # Build timetable for display
    timetable: Timetable = build_timetable(result, data)

    # Quality percentage
    quality_pct = max(0.0, min(100.0, result.fitness / 100_000.0 * 100.0))

    # Build expanded timetable dict
    tt_dict = _expand_timetable(timetable, data, inst_settings)

    # Count lessons placed (non-None cells in class views, excluding continuations)
    lessons_placed = 0
    if tt_dict.get("class_views"):
        seen_blocks = set()
        for cv in tt_dict["class_views"].values():
            for row in cv.get("grid", []):
                for cell in row:
                    if cell and cell.get("block_id") and not cell.get("is_continuation"):
                        seen_blocks.add(cell["block_id"])
        lessons_placed = len(seen_blocks)

    total_lessons = sum(b.count for b in ga_blocks)

    return {
        "status": result.status,
        "fitness": result.fitness,
        "quality_pct": round(quality_pct, 2),
        "hard_violations": result.hard_violations,
        "soft_violations": result.soft_violations,
        "generations": result.generations,
        "time_ms": result.time_ms,
        "lessons_placed": lessons_placed,
        "total_lessons": total_lessons,
        "preflight_ok": result.preflight_ok,
        "preflight_errors": result.preflight_errors,
        "preflight_warnings": result.preflight_warnings,
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
    for class_id, grid_obj in timetable.by_class.items():
        grid = []
        for d in range(days):
            day_row = []
            for p in range(periods):
                cell = grid_obj.get_cell(d, p)
                if cell:
                    day_row.append({
                        "block_id": cell.block_id,
                        "subject_id": cell.subject_id,
                        "subject_name": cell.subject_name,
                        "teacher_ids": cell.teacher_ids,
                        "class_ids": cell.class_ids,
                        "classroom_ids": cell.class_ids,
                        "room_ids": cell.room_ids,
                        "teacher_names": cell.teacher_names,
                        "room_name": ", ".join(cell.room_ids) if cell.room_ids else "—",
                        "is_lab": cell.is_lab,
                        "is_locked": cell.is_locked,
                        "is_continuation": p > cell.period,
                        "duration": cell.span,
                    })
                else:
                    day_row.append(None)
            grid.append(day_row)
        class_views[class_id] = {"name": grid_obj.entity_name, "grid": grid}

    # Build per-teacher grids
    teacher_views = {}
    for teacher_id, grid_obj in timetable.by_teacher.items():
        grid = []
        for d in range(days):
            day_row = []
            for p in range(periods):
                cell = grid_obj.get_cell(d, p)
                if cell:
                    day_row.append({
                        "block_id": cell.block_id,
                        "subject_id": cell.subject_id,
                        "subject_name": cell.subject_name,
                        "teacher_ids": cell.teacher_ids,
                        "class_ids": cell.class_ids,
                        "classroom_ids": cell.class_ids,
                        "room_ids": cell.room_ids,
                        "class_names": [data.orig_classes[cid].name if cid in data.orig_classes else cid for cid in cell.class_ids],
                        "room_name": ", ".join(cell.room_ids) if cell.room_ids else "—",
                        "is_lab": cell.is_lab,
                        "is_continuation": p > cell.period,
                        "duration": cell.span,
                    })
                else:
                    day_row.append(None)
            grid.append(day_row)
        teacher_views[teacher_id] = {"name": grid_obj.entity_name, "grid": grid}

    return {
        "metadata": {
            "days": days,
            "periods": periods,
            "day_names": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][:days],
        },
        "class_views": class_views,
        "teacher_views": teacher_views,
    }
