"""
mini_groups.py — Mini-Group CRUD
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db, get_or_create_institution
from models import MiniGroup
from schemas import MiniGroupCreate, MiniGroupOut
from services.bitmask_service import compute_break_mask, compute_working_mask

router = APIRouter(tags=["Mini Groups"])


@router.get("", response_model=List[MiniGroupOut])
def list_mini_groups(db: Session = Depends(get_db)):
    """List all mini-groups (max 2)."""
    inst = get_or_create_institution(db)
    return db.query(MiniGroup).filter(MiniGroup.institution_id == inst.id).all()


@router.post("", response_model=MiniGroupOut)
def create_mini_group(data: MiniGroupCreate, db: Session = Depends(get_db)):
    """Create a new mini-group. Enforces max 2 per institution."""
    inst = get_or_create_institution(db)
    count = db.query(MiniGroup).filter(MiniGroup.institution_id == inst.id).count()
    if count >= 2:
        raise HTTPException(400, "Maximum of 2 mini-groups allowed.")

    b_mask = compute_break_mask(data.days_per_week, data.periods_per_day, data.break_after_period)
    w_mask = compute_working_mask(data.days_per_week, data.periods_per_day, b_mask)

    obj = MiniGroup(
        institution_id=inst.id,
        name=data.name,
        slot_index=data.slot_index,
        days_per_week=data.days_per_week,
        periods_per_day=data.periods_per_day,
        break_after_period=data.break_after_period,
        break_mask=b_mask,
        working_slot_mask=w_mask,
    )
    if data.id:
        obj.id = data.id
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{group_id}", response_model=MiniGroupOut)
def update_mini_group(group_id: str, data: MiniGroupCreate, db: Session = Depends(get_db)):
    obj = db.query(MiniGroup).filter(MiniGroup.id == group_id).first()
    if not obj:
        raise HTTPException(404, "Mini-group not found")

    obj.name = data.name
    obj.slot_index = data.slot_index
    obj.days_per_week = data.days_per_week
    obj.periods_per_day = data.periods_per_day
    obj.break_after_period = data.break_after_period
    
    obj.break_mask = compute_break_mask(
        obj.days_per_week, obj.periods_per_day, obj.break_after_period
    )
    obj.working_slot_mask = compute_working_mask(
        obj.days_per_week, obj.periods_per_day, obj.break_mask
    )

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{group_id}")
def delete_mini_group(group_id: str, db: Session = Depends(get_db)):
    obj = db.query(MiniGroup).filter(MiniGroup.id == group_id).first()
    if not obj:
        raise HTTPException(404, "Mini-group not found")
    db.delete(obj)
    db.commit()
    return {"message": "Deleted"}
