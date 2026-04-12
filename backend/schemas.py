# -*- coding: utf-8 -*-
"""
schemas.py — Pydantic request/response models
================================================
Includes bulk schemas for save-all operations.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Union
from datetime import datetime


# ─── Institution ────────────────────────────────────────────────────────────

class InstitutionBase(BaseModel):
    name: str = "My Institution"
    days_per_week: int = 5
    periods_per_day: int = 7
    break_after_period: int = 3

class InstitutionUpdate(BaseModel):
    name: Optional[str] = None
    days_per_week: Optional[int] = None
    periods_per_day: Optional[int] = None
    break_after_period: Optional[int] = None

class InstitutionOut(InstitutionBase):
    id: str
    break_mask: int = 0
    working_slot_mask: int = 0
    class Config:
        from_attributes = True


# ─── Teacher ────────────────────────────────────────────────────────────────

class TeacherBase(BaseModel):
    name: str
    short_name: Optional[str] = None
    available_mask: Union[int, str] = -1
    max_per_day: int = 6
    max_per_week: int = 30

class TeacherCreate(TeacherBase):
    id: Optional[str] = None  # allow client-provided IDs

class TeacherOut(TeacherBase):
    id: str
    institution_id: str
    class Config:
        from_attributes = True

class TeacherBulkCreate(BaseModel):
    """Accept a list of teachers and save all at once."""
    items: List[TeacherCreate]


# ─── Classroom (Student class/section) ──────────────────────────────────────

class ClassroomBase(BaseModel):
    name: str
    short_name: Optional[str] = None
    capacity: int = 40

class ClassroomCreate(ClassroomBase):
    id: Optional[str] = None

class ClassroomOut(ClassroomBase):
    id: str
    institution_id: str
    class Config:
        from_attributes = True

class ClassroomBulkCreate(BaseModel):
    items: List[ClassroomCreate]


# ─── Subject ────────────────────────────────────────────────────────────────

class SubjectBase(BaseModel):
    name: str
    short_name: Optional[str] = None
    is_difficult: bool = False
    is_lab: bool = False
    priority: int = 1

class SubjectCreate(SubjectBase):
    id: Optional[str] = None

class SubjectOut(SubjectBase):
    id: str
    institution_id: str
    class Config:
        from_attributes = True

class SubjectBulkCreate(BaseModel):
    items: List[SubjectCreate]


# ─── Room ───────────────────────────────────────────────────────────────────

class RoomBase(BaseModel):
    name: str
    short_name: Optional[str] = None
    is_lab: bool = False
    available_mask: Union[int, str] = -1

class RoomCreate(RoomBase):
    id: Optional[str] = None

class RoomOut(RoomBase):
    id: str
    institution_id: str
    class Config:
        from_attributes = True

class RoomBulkCreate(BaseModel):
    items: List[RoomCreate]


# ─── Lesson Block ───────────────────────────────────────────────────────────

class LessonBlockCreate(BaseModel):
    id: Optional[str] = None
    teacher_ids: List[str] = []
    subject_ids: List[str] = []
    classroom_ids: List[str] = []
    room_ids: List[str] = []
    duration: int = 1
    count: int = 1
    is_locked: bool = False
    locked_day: int = 0
    locked_period: int = 0
    is_lab: bool = False
    is_difficult: bool = False
    subject_name: str = ""
    mini_group_id: Optional[str] = None

class LessonBlockOut(BaseModel):
    id: str
    institution_id: str
    mini_group_id: Optional[str] = None
    duration: int
    count: int
    is_locked: bool
    locked_day: int
    locked_period: int
    is_lab: bool
    is_difficult: bool
    subject_name: str
    teacher_ids: List[str] = []
    subject_ids: List[str] = []
    classroom_ids: List[str] = []
    room_ids: List[str] = []
    class Config:
        from_attributes = True

class LessonBlockBulkCreate(BaseModel):
    items: List[LessonBlockCreate]


# ─── Mini-Group & Constraints ───────────────────────────────────────────────

class MiniGroupBase(BaseModel):
    name: str
    slot_index: int = 1
    days_per_week: int = 5
    periods_per_day: int = 7
    break_after_period: int = 3

class MiniGroupCreate(MiniGroupBase):
    id: Optional[str] = None

class MiniGroupOut(MiniGroupBase):
    id: str
    institution_id: str
    break_mask: int = 0
    working_slot_mask: int = 0
    class Config:
        from_attributes = True

class ConstraintSettingsCreate(BaseModel):
    settings_json: str = "{}"
    constraint_mask: int = 0
    is_active: bool = True

class ConstraintSettingsOut(ConstraintSettingsCreate):
    id: str
    institution_id: str
    mini_group_id: Optional[str] = None
    class Config:
        from_attributes = True


# ─── Bulk Data ──────────────────────────────────────────────────────────────

class AllDataSave(BaseModel):
    institution: Optional[InstitutionUpdate] = None
    teachers: Optional[List[TeacherCreate]] = None
    subjects: Optional[List[SubjectCreate]] = None
    rooms: Optional[List[RoomCreate]] = None
    classrooms: Optional[List[ClassroomCreate]] = None
    lesson_blocks: Optional[List[LessonBlockCreate]] = None
    constraint_settings: Optional[ConstraintSettingsCreate] = None

class AllDataOut(BaseModel):
    institution: InstitutionOut
    teachers: List[TeacherOut]
    subjects: List[SubjectOut]
    rooms: List[RoomOut]
    classrooms: List[ClassroomOut]
    lesson_blocks: List[LessonBlockOut]
    constraint_settings: Optional[ConstraintSettingsOut] = None


# ─── Generate ───────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    """Options for GA generation."""
    max_generations: int = 2000
    population_size: int = 300
    time_limit_seconds: int = 120
    seed: Optional[int] = None
    fast_mode: bool = False
    constraint_mask: Optional[int] = None  # overrides DB value if provided

class ViolationDetail(BaseModel):
    type: str
    description: str
    block_id: str = ""

class GenerateResponse(BaseModel):
    """Synchronous GA result — no polling needed."""
    status: str                 # "optimal", "max_generations", "stagnation", "time_limit"
    fitness: float
    quality_pct: float
    hard_violations: int
    soft_violations: int
    generations: int
    time_ms: int
    lessons_placed: int = 0
    total_lessons: int = 0
    preflight_ok: bool = True
    preflight_errors: List[str] = []
    preflight_warnings: List[str] = []
    violation_details: List[ViolationDetail] = []
    timetable: dict = {}       # expanded timetable grid


# ─── Timetable ──────────────────────────────────────────────────────────────

class TimetableSave(BaseModel):
    name: str = "Untitled Timetable"
    timetable_json: str  # JSON string of the full timetable
    fitness_score: float = 0.0
    hard_violations: int = 0
    soft_violations: int = 0

class TimetableOut(BaseModel):
    id: str
    institution_id: str
    name: str
    fitness_score: float
    hard_violations: int
    soft_violations: int
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class TimetableDetailOut(TimetableOut):
    timetable_json: str
