# -*- coding: utf-8 -*-
"""
generate.py — Synchronous GA generation endpoint
==================================================
No polling. The request blocks until the GA finishes and returns the result
directly. Ideal for localhost usage where latency is minimal.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db, get_or_create_institution
from models import Institution, Teacher, Subject, Room, Classroom, LessonBlock, ConstraintSettings
from schemas import GenerateRequest, GenerateResponse
from services.ga_bridge import run_ga_from_db

router = APIRouter(tags=["Generate"])


@router.post("/main", response_model=GenerateResponse)
def generate_main(req: GenerateRequest = GenerateRequest(), db: Session = Depends(get_db)):
    """
    Run the GA synchronously and return the result.
    No job queue, no polling — the HTTP request blocks until completion.
    Typical time: 3-15 seconds depending on problem size.
    """
    inst = get_or_create_institution(db)

    # Load all data in bulk (eager loading, single query per table)
    teachers = db.query(Teacher).filter(Teacher.institution_id == inst.id).all()
    subjects = db.query(Subject).filter(Subject.institution_id == inst.id).all()
    rooms = db.query(Room).filter(Room.institution_id == inst.id).all()
    classrooms = db.query(Classroom).filter(Classroom.institution_id == inst.id).all()
    lesson_blocks = (
        db.query(LessonBlock)
        .options(
            joinedload(LessonBlock.teachers),
            joinedload(LessonBlock.subjects),
            joinedload(LessonBlock.classrooms),
            joinedload(LessonBlock.rooms),
        )
        .filter(LessonBlock.institution_id == inst.id)
        .filter(LessonBlock.mini_group_id == None)
        .all()
    )
    constraint_settings = db.query(ConstraintSettings).filter(
        ConstraintSettings.institution_id == inst.id,
        ConstraintSettings.mini_group_id == None,
    ).first()

    if not lesson_blocks:
        raise HTTPException(400, "No lesson blocks configured. Add lesson blocks before generating.")

    if not teachers:
        raise HTTPException(400, "No teachers configured.")

    if not classrooms:
        raise HTTPException(400, "No classrooms (student classes) configured.")

    try:
        result = run_ga_from_db(
            institution=inst,
            teachers=teachers,
            subjects=subjects,
            rooms=rooms,
            classrooms=classrooms,
            lesson_blocks=lesson_blocks,
            constraint_settings=constraint_settings,
            max_generations=req.max_generations,
            population_size=req.population_size,
            time_limit_seconds=req.time_limit_seconds,
            seed=req.seed,
            fast_mode=req.fast_mode,
        )
    except Exception as e:
        raise HTTPException(500, f"GA engine error: {str(e)}")

    return result


@router.post("/mini/{group_id}", response_model=GenerateResponse)
def generate_mini(group_id: str, req: GenerateRequest = GenerateRequest(), db: Session = Depends(get_db)):
    """Run the GA synchronously for a mini-group."""
    from models import MiniGroup
    group = db.query(MiniGroup).filter(MiniGroup.id == group_id).first()
    if not group:
        raise HTTPException(404, "Mini-group not found")

    teachers = db.query(Teacher).filter(Teacher.institution_id == group.institution_id).all()
    subjects = db.query(Subject).filter(Subject.institution_id == group.institution_id).all()
    rooms = db.query(Room).filter(Room.institution_id == group.institution_id).all()
    classrooms = db.query(Classroom).filter(Classroom.institution_id == group.institution_id).all()
    
    lesson_blocks = (
        db.query(LessonBlock)
        .options(
            joinedload(LessonBlock.teachers),
            joinedload(LessonBlock.subjects),
            joinedload(LessonBlock.classrooms),
            joinedload(LessonBlock.rooms),
        )
        .filter(LessonBlock.mini_group_id == group.id)
        .all()
    )
    constraint_settings = db.query(ConstraintSettings).filter(
        ConstraintSettings.institution_id == group.institution_id,
        ConstraintSettings.mini_group_id == group.id,
    ).first()

    if not lesson_blocks:
        raise HTTPException(400, "No lesson blocks configured for this mini-group.")

    try:
        # MiniGroup has the same routing fields (days_per_week, periods_per_day, break_after_period) as Institution
        result = run_ga_from_db(
            institution=group,
            teachers=teachers,
            subjects=subjects,
            rooms=rooms,
            classrooms=classrooms,
            lesson_blocks=lesson_blocks,
            constraint_settings=constraint_settings,
            max_generations=req.max_generations,
            population_size=req.population_size,
            time_limit_seconds=req.time_limit_seconds,
            seed=req.seed,
            fast_mode=req.fast_mode,
        )
    except Exception as e:
        raise HTTPException(500, f"GA engine error: {str(e)}")

    return result


@router.post("/preflight/main")
def preflight_check_main(db: Session = Depends(get_db)):
    """
    Run pre-flight validation only (no GA execution).
    Returns feasibility status and any warnings/errors.
    """
    inst = get_or_create_institution(db)

    teachers = db.query(Teacher).filter(Teacher.institution_id == inst.id).all()
    classrooms = db.query(Classroom).filter(Classroom.institution_id == inst.id).all()
    rooms = db.query(Room).filter(Room.institution_id == inst.id).all()
    lesson_blocks = (
        db.query(LessonBlock)
        .options(
            joinedload(LessonBlock.teachers),
            joinedload(LessonBlock.subjects),
            joinedload(LessonBlock.classrooms),
            joinedload(LessonBlock.rooms),
        )
        .filter(LessonBlock.institution_id == inst.id)
        .filter(LessonBlock.mini_group_id == None)
        .all()
    )

    if not lesson_blocks:
        return {"feasible": False, "errors": ["No lesson blocks configured"], "warnings": []}

    constraint_settings = db.query(ConstraintSettings).filter(
        ConstraintSettings.institution_id == inst.id,
        ConstraintSettings.mini_group_id == None,
    ).first()

    from services.ga_bridge import _db_to_ga_structures
    from engine.ga_problem import build_problem_data
    from engine.ga_preflight import preflight_check as ga_preflight

    (ga_teachers, ga_subjects, ga_rooms, ga_classes,
     ga_blocks, inst_settings) = _db_to_ga_structures(
        inst, teachers,
        db.query(Subject).filter(Subject.institution_id == inst.id).all(),
        rooms, classrooms, lesson_blocks, constraint_settings=constraint_settings
    )

    data = build_problem_data(
        settings=inst_settings,
        teachers=ga_teachers,
        subjects=ga_subjects,
        rooms=ga_rooms,
        classes=ga_classes,
        lesson_blocks=ga_blocks,
    )

    pf = ga_preflight(data)
    return {
        "feasible": pf.feasible,
        "errors": pf.errors,
        "warnings": pf.warnings,
    }
