# -*- coding: utf-8 -*-
"""
data.py — Bulk Upsert/Sync Endpoint for Frontend Zustand Stores
=================================================================
Provides a single GET endpoint to load the entire database state,
and a single POST endpoint to sync all changes in one transaction.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from database import get_db, get_or_create_institution
from models import (
    Institution, Teacher, Subject, Room, Classroom, LessonBlock, ConstraintSettings
)
from routers.auth import CurrentUser, get_current_user
from schemas import (
    AllDataOut, AllDataSave,
    TeacherOut, SubjectOut, RoomOut, ClassroomOut, LessonBlockOut, ConstraintSettingsOut
)

router = APIRouter(tags=["Data Sync"])

def _to_out(lb: LessonBlock) -> dict:
    return {
        "id": lb.id,
        "institution_id": lb.institution_id,
        "mini_group_id": lb.mini_group_id,
        "duration": lb.duration,
        "count": lb.count,
        "is_locked": lb.is_locked,
        "locked_day": lb.locked_day,
        "locked_period": lb.locked_period,
        "is_lab": lb.is_lab,
        "is_difficult": lb.is_difficult,
        "subject_name": lb.subject_name,
        "teacher_ids": [t.id for t in lb.teachers],
        "subject_ids": [s.id for s in lb.subjects],
        "classroom_ids": [c.id for c in lb.classrooms],
        "room_ids": [r.id for r in lb.rooms],
    }

def _resolve_relations(db: Session, data, lb: LessonBlock):
    if hasattr(data, 'teacher_ids') and data.teacher_ids:
        lb.teachers = db.query(Teacher).filter(Teacher.id.in_(data.teacher_ids)).all()
    else:
        lb.teachers = []
    if hasattr(data, 'subject_ids') and data.subject_ids:
        lb.subjects = db.query(Subject).filter(Subject.id.in_(data.subject_ids)).all()
    else:
        lb.subjects = []
    if hasattr(data, 'classroom_ids') and data.classroom_ids:
        lb.classrooms = db.query(Classroom).filter(Classroom.id.in_(data.classroom_ids)).all()
    else:
        lb.classrooms = []
    if hasattr(data, 'room_ids') and data.room_ids:
        lb.rooms = db.query(Room).filter(Room.id.in_(data.room_ids)).all()
    else:
        lb.rooms = []


@router.get("", response_model=AllDataOut)
def get_all_data(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    mini_group_id: Optional[str] = Query(
        default=None,
        description="If provided, returns lesson blocks for this mini-group instead of main blocks.",
    ),
):
    """
    Fetch all data for the institution to populate frontend stores.

    By default returns only main lesson blocks (mini_group_id == null).
    Pass ?mini_group_id=<uuid> to load lesson blocks for a specific mini-group instead.
    All other entities (teachers, subjects, rooms, classrooms) are always returned in full
    as they are shared across main and mini-group schedules.
    """
    inst = get_or_create_institution(db, current_user.id)

    # Core entities — always the full institution pool
    teachers = db.query(Teacher).filter(Teacher.institution_id == inst.id).all()
    subjects = db.query(Subject).filter(Subject.institution_id == inst.id).all()
    rooms = db.query(Room).filter(Room.institution_id == inst.id).all()
    classrooms = db.query(Classroom).filter(Classroom.institution_id == inst.id).all()

    # Lesson blocks — filtered by mini_group_id param
    lb_query = (
        db.query(LessonBlock)
        .options(
            joinedload(LessonBlock.teachers),
            joinedload(LessonBlock.subjects),
            joinedload(LessonBlock.classrooms),
            joinedload(LessonBlock.rooms),
        )
        .filter(LessonBlock.institution_id == inst.id)
    )
    if mini_group_id == "main":
        lb_query = lb_query.filter(LessonBlock.mini_group_id == None)
    elif mini_group_id:
        lb_query = lb_query.filter(LessonBlock.mini_group_id == mini_group_id)
    # else: fetch ALL lesson blocks unconditionally
    
    lesson_blocks = lb_query.all()

    # Constraint Settings — scoped to the same mini_group_id
    settings = db.query(ConstraintSettings).filter(
        ConstraintSettings.institution_id == inst.id,
        ConstraintSettings.mini_group_id == (None if mini_group_id in (None, "main") else mini_group_id),
    ).first()

    return {
        "institution": inst,
        "teachers": teachers,
        "subjects": subjects,
        "rooms": rooms,
        "classrooms": classrooms,
        "lesson_blocks": [_to_out(lb) for lb in lesson_blocks],
        "constraint_settings": settings,
    }


@router.post("", response_model=AllDataOut)
def sync_all_data(
    data: AllDataSave,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    mini_group_id: Optional[str] = Query(
        default=None,
        description="Scope lesson block sync to a specific mini-group. "
                    "If omitted, only main blocks (mini_group_id == null) are synced.",
    ),
):
    """
    Upsert all entities. The frontend sends the FULL current state for the given scope.
    Missing entities are deleted, existing are updated, new are inserted.

    - Pass ?mini_group_id=<uuid> to sync a mini-group's lesson blocks.
    - Omit it (default) to sync main lesson blocks.
    - Core entities (teachers, subjects, rooms, classrooms) are always synced institution-wide.
    """
    inst = get_or_create_institution(db, current_user.id)

    # Determine the effective scope for lesson block operations
    effective_mini_group_id = mini_group_id

    # 1. Update Institution
    if data.institution:
        from services.bitmask_service import compute_break_mask, compute_working_mask
        inst.name = data.institution.name or inst.name
        if data.institution.days_per_week is not None:
            inst.days_per_week = data.institution.days_per_week
        if data.institution.periods_per_day is not None:
            inst.periods_per_day = data.institution.periods_per_day
        if data.institution.break_after_period is not None:
            inst.break_after_period = data.institution.break_after_period

        inst.break_mask = str(compute_break_mask(
            inst.days_per_week, inst.periods_per_day, inst.break_after_period
        ))
        inst.working_slot_mask = str(compute_working_mask(
            inst.days_per_week, inst.periods_per_day, int(inst.break_mask)
        ))

    # Helper for simple entity sync
    def sync_simple_entities(ModelClass, new_items):
        if new_items is None:
            return
        existing = db.query(ModelClass).filter(ModelClass.institution_id == inst.id).all()
        existing_dict = {obj.id: obj for obj in existing}

        for item in new_items:
            item_data = item.model_dump(exclude={'id'})
            if item.id and item.id in existing_dict:
                obj = existing_dict.pop(item.id)
                for k, v in item_data.items():
                    # Handle bitmask stringification
                    if k == 'available_mask' and v is not None:
                        v = str(v)
                    setattr(obj, k, v)
            else:
                # Handle bitmask stringification for new objects
                if 'available_mask' in item_data and item_data['available_mask'] is not None:
                    item_data['available_mask'] = str(item_data['available_mask'])
                obj = ModelClass(institution_id=inst.id, **item_data)
                if item.id:
                    obj.id = item.id
                db.add(obj)

        for obj in existing_dict.values():
            db.delete(obj)

    # 2. Sync Teachers, Subjects, Rooms, Classrooms (always institution-wide)
    sync_simple_entities(Teacher, data.teachers)
    sync_simple_entities(Subject, data.subjects)
    sync_simple_entities(Room, data.rooms)
    sync_simple_entities(Classroom, data.classrooms)

    # 3. Flush DB so primary keys exist for relationships
    db.flush()

    # 4. Sync Lesson Blocks scoped to main or mini-group
    if data.lesson_blocks is not None:
        lb_query = db.query(LessonBlock).options(
            joinedload(LessonBlock.teachers),
            joinedload(LessonBlock.subjects),
            joinedload(LessonBlock.classrooms),
            joinedload(LessonBlock.rooms),
        ).filter(LessonBlock.institution_id == inst.id)

        if effective_mini_group_id == "main":
            existing_lbs = lb_query.filter(LessonBlock.mini_group_id == None).all()
        elif effective_mini_group_id is not None:
            existing_lbs = lb_query.filter(LessonBlock.mini_group_id == effective_mini_group_id).all()
        else:
            existing_lbs = lb_query.all()

        existing_dict = {lb.id: lb for lb in existing_lbs}

        for item in data.lesson_blocks:
            item_data = item.model_dump(
                exclude={'id', 'teacher_ids', 'subject_ids', 'classroom_ids', 'room_ids'}
            )
            # Enforce scope if specified, otherwise respect payload
            if effective_mini_group_id == "main":
                item_data['mini_group_id'] = None
            elif effective_mini_group_id is not None:
                item_data['mini_group_id'] = effective_mini_group_id

            if item.id and item.id in existing_dict:
                lb = existing_dict.pop(item.id)
                for k, v in item_data.items():
                    setattr(lb, k, v)
                _resolve_relations(db, item, lb)
            else:
                lb = LessonBlock(institution_id=inst.id, **item_data)
                if item.id:
                    lb.id = item.id
                _resolve_relations(db, item, lb)
                db.add(lb)

        for lb in existing_dict.values():
            db.delete(lb)

    # 5. Sync Constraint Settings (scoped same as lesson blocks)
    if data.constraint_settings:
        cs_group_id = None if effective_mini_group_id in (None, "main") else effective_mini_group_id
        cs = db.query(ConstraintSettings).filter(
            ConstraintSettings.institution_id == inst.id,
            ConstraintSettings.mini_group_id == cs_group_id,
        ).first()
        if cs:
            cs.settings_json = data.constraint_settings.settings_json
            cs.constraint_mask = data.constraint_settings.constraint_mask
            cs.is_active = data.constraint_settings.is_active
        else:
            db.add(ConstraintSettings(
                institution_id=inst.id,
                mini_group_id=effective_mini_group_id,
                settings_json=data.constraint_settings.settings_json,
                constraint_mask=data.constraint_settings.constraint_mask,
                is_active=data.constraint_settings.is_active,
            ))

    db.commit()

    # Return refreshed data for the same scope
    return get_all_data(db=db, current_user=current_user, mini_group_id=effective_mini_group_id)
