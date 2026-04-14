# -*- coding: utf-8 -*-
"""
mini_groups.py — Mini-Group CRUD
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db, get_or_create_institution
from models import MiniGroup, ConstraintSettings, LessonBlock
from schemas import MiniGroupCreate, MiniGroupOut
from services.bitmask_service import compute_break_mask, compute_working_mask
from routers.auth import CurrentUser, get_current_user

router = APIRouter(tags=["Mini Groups"])


@router.get("", response_model=List[MiniGroupOut])
def list_mini_groups(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all mini-groups (max 6)."""
    inst = get_or_create_institution(db, current_user.id)
    groups = db.query(MiniGroup).filter(MiniGroup.institution_id == inst.id).all()
    for g in groups:
        g.lesson_count = db.query(LessonBlock).filter(LessonBlock.mini_group_id == g.id).count()
    return groups


@router.post("", response_model=MiniGroupOut)
def create_mini_group(
    data: MiniGroupCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new mini-group. Enforces max 6 per institution."""
    inst = get_or_create_institution(db, current_user.id)
    count = db.query(MiniGroup).filter(MiniGroup.institution_id == inst.id).count()
    if count >= 6:
        raise HTTPException(400, "Maximum of 6 mini-groups allowed.")

    import json
    custom_breaks = None
    try:
        overrides = json.loads(data.teacher_time_off_overrides or "{}")
        custom_breaks = overrides.get("breaks")
    except Exception:
        pass

    b_mask = compute_break_mask(data.days_per_week, data.periods_per_day, data.break_after_period, custom_breaks)
    w_mask = compute_working_mask(data.days_per_week, data.periods_per_day, b_mask)

    obj = MiniGroup(
        institution_id=inst.id,
        name=data.name,
        slot_index=data.slot_index,
        days_per_week=data.days_per_week,
        periods_per_day=data.periods_per_day,
        break_after_period=data.break_after_period,
        break_mask=str(b_mask),
        working_slot_mask=str(w_mask),
        teacher_time_off_overrides=data.teacher_time_off_overrides,
        selected_teacher_ids=data.selected_teacher_ids,
        selected_class_ids=data.selected_class_ids,
        selected_room_ids=data.selected_room_ids,
        selected_subject_ids=data.selected_subject_ids,
    )
    db.add(obj)
    db.flush() # ensure obj.id

    # Create associated ConstraintSettings
    db.add(ConstraintSettings(
        institution_id=inst.id,
        mini_group_id=obj.id,
        constraint_mask=data.constraint_mask or 0
    ))

    db.commit()
    db.refresh(obj)
    obj.lesson_count = 0
    return obj


@router.put("/{group_id}", response_model=MiniGroupOut)
def update_mini_group(
    group_id: str,
    data: MiniGroupCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    inst = get_or_create_institution(db, current_user.id)
    obj = db.query(MiniGroup).filter(MiniGroup.id == group_id).first()
    if not obj:
        raise HTTPException(404, "Mini-group not found")

    # Ownership validation
    if obj.institution_id != inst.id:
        raise HTTPException(403, "You do not have access to this mini-group")

    obj.name = data.name
    obj.slot_index = data.slot_index
    obj.days_per_week = data.days_per_week
    obj.periods_per_day = data.periods_per_day
    obj.break_after_period = data.break_after_period
    obj.teacher_time_off_overrides = data.teacher_time_off_overrides
    obj.selected_teacher_ids = data.selected_teacher_ids
    obj.selected_class_ids = data.selected_class_ids
    obj.selected_room_ids = data.selected_room_ids
    obj.selected_subject_ids = data.selected_subject_ids
    
    import json
    custom_breaks = None
    try:
        overrides = json.loads(data.teacher_time_off_overrides or "{}")
        custom_breaks = overrides.get("breaks")
    except Exception:
        pass
        
    obj.break_mask = str(compute_break_mask(
        obj.days_per_week, obj.periods_per_day, obj.break_after_period, custom_breaks
    ))
    obj.working_slot_mask = str(compute_working_mask(
        obj.days_per_week, obj.periods_per_day, int(obj.break_mask)
    ))

    # Update associated ConstraintSettings
    c_settings = db.query(ConstraintSettings).filter(ConstraintSettings.mini_group_id == obj.id).first()
    if not c_settings:
        c_settings = ConstraintSettings(institution_id=obj.institution_id, mini_group_id=obj.id)
        db.add(c_settings)
    c_settings.constraint_mask = data.constraint_mask or 0

    db.commit()
    db.refresh(obj)
    obj.lesson_count = db.query(LessonBlock).filter(LessonBlock.mini_group_id == obj.id).count()
    return obj


@router.delete("/{group_id}")
def delete_mini_group(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    inst = get_or_create_institution(db, current_user.id)
    obj = db.query(MiniGroup).filter(MiniGroup.id == group_id).first()
    if not obj:
        raise HTTPException(404, "Mini-group not found")

    # Ownership validation
    if obj.institution_id != inst.id:
        raise HTTPException(403, "You do not have access to this mini-group")

    db.delete(obj)
    db.commit()
    return {"message": "Deleted"}
