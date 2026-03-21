"""schemas/api.py — Pydantic request/response models."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field, model_validator


# ── Primitives ────────────────────────────────────────────────────────────────

class UnavailableSlot(BaseModel):
    day:    int = Field(..., ge=0, le=4)
    period: int = Field(..., ge=0, le=6)


class SessionSpec(BaseModel):
    """Weekly session type — duration=periods per session, count=times per week."""
    duration: int = Field(..., ge=1, le=3)
    count:    int = Field(..., ge=1, le=10)


# ── Teacher ───────────────────────────────────────────────────────────────────

class TeacherBase(BaseModel):
    name:              str
    unavailable_slots: list[UnavailableSlot] = []

class TeacherOut(TeacherBase):
    id: str
    class Config:
        from_attributes = True


# ── Subject ───────────────────────────────────────────────────────────────────

class SubjectBase(BaseModel):
    name:         str
    is_difficult: bool = False
    is_lab:       bool = False
    priority:     int  = Field(5, ge=1, le=10)

class SubjectOut(SubjectBase):
    id: str
    class Config:
        from_attributes = True


# ── Room ──────────────────────────────────────────────────────────────────────

class RoomBase(BaseModel):
    name:   str
    is_lab: bool = False

class RoomOut(RoomBase):
    id: str
    class Config:
        from_attributes = True


# ── Class ─────────────────────────────────────────────────────────────────────

class ClassBase(BaseModel):
    name: str

class ClassOut(ClassBase):
    id: str
    class Config:
        from_attributes = True


# ── Lesson block ──────────────────────────────────────────────────────────────

class LessonBase(BaseModel):
    subject_id:          str
    teacher_ids:         list[str]
    class_ids:           list[str]
    room_ids:            list[str]
    sessions:            list[SessionSpec] = []
    is_locked:           bool              = False
    locked_day:          Optional[int]     = Field(None, ge=0, le=4)
    locked_start_period: Optional[int]     = Field(None, ge=0, le=6)
    locked_duration:     Optional[int]     = Field(None, ge=1, le=3)

    @model_validator(mode="after")
    def validate_sessions_or_locked(self):
        if self.is_locked:
            if self.locked_day is None or self.locked_start_period is None:
                raise ValueError("Locked lesson must have locked_day and locked_start_period")
        else:
            if not self.sessions:
                raise ValueError("Free lesson must have at least one session spec")
        return self


class LessonOut(LessonBase):
    id:            str
    total_periods: int = 0

    @model_validator(mode="after")
    def compute_total(self):
        self.total_periods = sum(s.duration * s.count for s in self.sessions)
        return self

    class Config:
        from_attributes = True


# ── Batch save ────────────────────────────────────────────────────────────────

class TeacherChanges(BaseModel):
    added:   list[TeacherBase]      = []
    updated: dict[str, TeacherBase] = {}
    deleted: list[str]              = []

class SubjectChanges(BaseModel):
    added:   list[SubjectBase]      = []
    updated: dict[str, SubjectBase] = {}
    deleted: list[str]              = []

class RoomChanges(BaseModel):
    added:   list[RoomBase]         = []
    updated: dict[str, RoomBase]    = {}
    deleted: list[str]              = []

class ClassChanges(BaseModel):
    added:   list[ClassBase]        = []
    updated: dict[str, ClassBase]   = {}
    deleted: list[str]              = []

class LessonChanges(BaseModel):
    added:   list[LessonBase]       = []
    updated: dict[str, LessonBase]  = {}
    deleted: list[str]              = []

class SaveAllRequest(BaseModel):
    teachers: TeacherChanges = TeacherChanges()
    subjects: SubjectChanges = SubjectChanges()
    rooms:    RoomChanges    = RoomChanges()
    classes:  ClassChanges   = ClassChanges()
    lessons:  LessonChanges  = LessonChanges()

class SaveAllResponse(BaseModel):
    ok:     bool
    counts: dict[str, dict[str, int]]


# ── Generation ────────────────────────────────────────────────────────────────

class GenerateResponse(BaseModel):
    job_id: str

class JobStatusResponse(BaseModel):
    job_id:                  str
    status:                  str
    started_at:              Optional[str]   = None
    finished_at:             Optional[str]   = None
    error:                   Optional[str]   = None
    generation_time_seconds: Optional[float] = None

class TimetableEntryOut(BaseModel):
    lesson_id:    str
    day:          int
    start_period: int
    duration:     int
    subject_id:   str
    subject_name: str
    teacher_ids:  list[str]
    class_ids:    list[str]
    room_ids:     list[str]

class TimetableResultResponse(BaseModel):
    timetable_id: str
    fitness:      int
    entries:      list[TimetableEntryOut]