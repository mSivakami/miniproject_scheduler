# -*- coding: utf-8 -*-
"""
timetables.py — Saved timetable CRUD (max 5)
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db, get_or_create_institution
from models import GeneratedTimetable
from schemas import TimetableSave, TimetableOut, TimetableDetailOut
from routers.auth import CurrentUser, get_current_user

router = APIRouter(tags=["Timetables"])

MAX_SAVED_TIMETABLES = 5


@router.get("", response_model=List[TimetableOut])
def list_timetables(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all saved timetables (without the full JSON payload)."""
    inst = get_or_create_institution(db)
    return (
        db.query(GeneratedTimetable)
        .filter(GeneratedTimetable.institution_id == inst.id)
        .order_by(GeneratedTimetable.created_at.desc())
        .all()
    )


@router.get("/{timetable_id}", response_model=TimetableDetailOut)
def get_timetable(
    timetable_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a single saved timetable with full JSON data."""
    inst = get_or_create_institution(db)
    tt = (
        db.query(GeneratedTimetable)
        .filter(
            GeneratedTimetable.id == timetable_id,
            GeneratedTimetable.institution_id == inst.id,
        )
        .first()
    )
    if not tt:
        raise HTTPException(404, "Timetable not found")
    return tt


@router.post("", response_model=TimetableOut)
def save_timetable(
    data: TimetableSave,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Save a generated timetable. Enforces max 5 saved timetables per institution.
    """
    inst = get_or_create_institution(db)

    count = db.query(GeneratedTimetable).filter(
        GeneratedTimetable.institution_id == inst.id
    ).count()

    if count >= MAX_SAVED_TIMETABLES:
        raise HTTPException(
            400,
            f"Maximum {MAX_SAVED_TIMETABLES} saved timetables reached. "
            "Delete one before saving a new one."
        )

    tt = GeneratedTimetable(
        institution_id=inst.id,
        name=data.name,
        timetable_json=data.timetable_json,
        fitness_score=data.fitness_score,
        hard_violations=data.hard_violations,
        soft_violations=data.soft_violations,
    )
    db.add(tt)
    db.commit()
    db.refresh(tt)
    return tt


@router.put("/{timetable_id}/name")
def rename_timetable(
    timetable_id: str,
    name: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    inst = get_or_create_institution(db)
    tt = (
        db.query(GeneratedTimetable)
        .filter(
            GeneratedTimetable.id == timetable_id,
            GeneratedTimetable.institution_id == inst.id,
        )
        .first()
    )
    if not tt:
        raise HTTPException(404, "Timetable not found")
    tt.name = name
    db.commit()
    return {"message": "Renamed", "name": name}


@router.put("/{timetable_id}", response_model=TimetableOut)
def update_timetable(
    timetable_id: str,
    data: TimetableSave,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Overwrite an existing timetable's JSON and metrics."""
    inst = get_or_create_institution(db)
    tt = (
        db.query(GeneratedTimetable)
        .filter(
            GeneratedTimetable.id == timetable_id,
            GeneratedTimetable.institution_id == inst.id,
        )
        .first()
    )
    if not tt:
        raise HTTPException(404, "Timetable not found")

    tt.name = data.name
    tt.timetable_json = data.timetable_json
    tt.fitness_score = data.fitness_score
    tt.hard_violations = data.hard_violations
    tt.soft_violations = data.soft_violations

    db.commit()
    db.refresh(tt)
    return tt


@router.delete("/{timetable_id}")
def delete_timetable(
    timetable_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    inst = get_or_create_institution(db)
    tt = (
        db.query(GeneratedTimetable)
        .filter(
            GeneratedTimetable.id == timetable_id,
            GeneratedTimetable.institution_id == inst.id,
        )
        .first()
    )
    if not tt:
        raise HTTPException(404, "Timetable not found")
    db.delete(tt)
    db.commit()
    return {"message": "Deleted"}
