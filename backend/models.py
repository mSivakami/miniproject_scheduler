# -*- coding: utf-8 -*-
"""
models.py — SQLAlchemy ORM Models
===================================
Following 02_BACKEND.md §2 with simplifications:
- No User/Auth (optional, localhost-first)
- No Job model (synchronous generation, no polling)
- Junction tables for many-to-many relationships
"""

from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean,
    Float, Text, ForeignKey, DateTime, Table
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid


def gen_uuid():
    return str(uuid.uuid4())


# ─── Auth ────────────────────────────────────────────────────────────────────

class Account(Base):
    """Primary sign-in account model used by the app."""
    __tablename__ = "accounts"

    id            = Column(String, primary_key=True, default=gen_uuid)
    username      = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at    = Column(DateTime, server_default=func.now())


class AdminUser(Base):
    """Legacy table kept for compatibility with older local databases."""
    __tablename__ = "admin_users"

    id            = Column(String, primary_key=True, default=gen_uuid)
    username      = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at    = Column(DateTime, server_default=func.now())


class UserAccount(Base):
    """Legacy table kept for compatibility with older local databases."""
    __tablename__ = "user_accounts"

    id            = Column(String, primary_key=True, default=gen_uuid)
    username      = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at    = Column(DateTime, server_default=func.now())


# ─── Junction Tables ────────────────────────────────────────────────────────

block_teachers = Table(
    "block_teachers", Base.metadata,
    Column("block_id", String, ForeignKey("lesson_blocks.id", ondelete="CASCADE")),
    Column("teacher_id", String, ForeignKey("teachers.id", ondelete="CASCADE")),
)

block_subjects = Table(
    "block_subjects", Base.metadata,
    Column("block_id", String, ForeignKey("lesson_blocks.id", ondelete="CASCADE")),
    Column("subject_id", String, ForeignKey("subjects.id", ondelete="CASCADE")),
)

block_classrooms = Table(
    "block_classrooms", Base.metadata,
    Column("block_id", String, ForeignKey("lesson_blocks.id", ondelete="CASCADE")),
    Column("classroom_id", String, ForeignKey("classrooms.id", ondelete="CASCADE")),
)

block_rooms = Table(
    "block_rooms", Base.metadata,
    Column("block_id", String, ForeignKey("lesson_blocks.id", ondelete="CASCADE")),
    Column("room_id", String, ForeignKey("rooms.id", ondelete="CASCADE")),
)


# ─── Core Models ────────────────────────────────────────────────────────────

class Institution(Base):
    __tablename__ = "institutions"

    id               = Column(String, primary_key=True, default=gen_uuid)
    account_id       = Column(String, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    name             = Column(String, nullable=False, default="My Institution")
    days_per_week    = Column(Integer, default=5)
    periods_per_day  = Column(Integer, default=7)
    break_after_period = Column(Integer, default=3)  # 0-indexed: break after this period
    break_mask       = Column(String, default="0")
    working_slot_mask = Column(String, default="0")
    created_at       = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, onupdate=func.now())

    # Relationships
    account       = relationship("Account", backref="institutions")
    teachers      = relationship("Teacher", back_populates="institution", cascade="all, delete-orphan")
    classrooms    = relationship("Classroom", back_populates="institution", cascade="all, delete-orphan")
    subjects      = relationship("Subject", back_populates="institution", cascade="all, delete-orphan")
    rooms         = relationship("Room", back_populates="institution", cascade="all, delete-orphan")
    lesson_blocks = relationship("LessonBlock", back_populates="institution", cascade="all, delete-orphan")
    timetables    = relationship("GeneratedTimetable", back_populates="institution", cascade="all, delete-orphan")
    mini_groups   = relationship("MiniGroup", back_populates="institution", cascade="all, delete-orphan")
    constraint_settings = relationship("ConstraintSettings", back_populates="institution", cascade="all, delete-orphan")


class Teacher(Base):
    __tablename__ = "teachers"

    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    name            = Column(String, nullable=False)
    short_name      = Column(String, nullable=True)
    available_mask  = Column(String, default="-1")  # -1 = all bits = always available
    max_per_day     = Column(Integer, default=6)
    max_per_week    = Column(Integer, default=30)
    created_at      = Column(DateTime, server_default=func.now())

    institution     = relationship("Institution", back_populates="teachers")
    lesson_blocks   = relationship("LessonBlock", secondary=block_teachers, back_populates="teachers")


class Classroom(Base):
    """A student class / section (e.g. 'Semester 2', '10A'). NOT a physical room."""
    __tablename__ = "classrooms"

    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    name            = Column(String, nullable=False)
    short_name      = Column(String, nullable=True)
    capacity        = Column(Integer, default=40)
    created_at      = Column(DateTime, server_default=func.now())

    institution     = relationship("Institution", back_populates="classrooms")
    lesson_blocks   = relationship("LessonBlock", secondary=block_classrooms, back_populates="classrooms")


class Subject(Base):
    __tablename__ = "subjects"

    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    name            = Column(String, nullable=False)
    short_name      = Column(String, nullable=True)
    is_difficult    = Column(Boolean, default=False)
    is_lab          = Column(Boolean, default=False)
    priority        = Column(Integer, default=1)
    created_at      = Column(DateTime, server_default=func.now())

    institution     = relationship("Institution", back_populates="subjects")
    lesson_blocks   = relationship("LessonBlock", secondary=block_subjects, back_populates="subjects")


class Room(Base):
    """A physical room or laboratory."""
    __tablename__ = "rooms"

    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    name            = Column(String, nullable=False)
    short_name      = Column(String, nullable=True)
    is_lab          = Column(Boolean, default=False)
    available_mask  = Column(String, default="-1")
    created_at      = Column(DateTime, server_default=func.now())

    institution     = relationship("Institution", back_populates="rooms")
    lesson_blocks   = relationship("LessonBlock", secondary=block_rooms, back_populates="rooms")


class LessonBlock(Base):
    __tablename__ = "lesson_blocks"

    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    mini_group_id   = Column(String, ForeignKey("mini_groups.id", ondelete="CASCADE"), nullable=True)
    duration        = Column(Integer, default=1)    # 1=single, 2=double, 3=triple
    count           = Column(Integer, default=1)    # times per week
    is_locked       = Column(Boolean, default=False)
    locked_day      = Column(Integer, default=0)    # 0-indexed day (if locked)
    locked_period   = Column(Integer, default=0)    # 0-indexed period (if locked)
    is_lab          = Column(Boolean, default=False)
    is_difficult    = Column(Boolean, default=False)
    subject_name    = Column(String, default="")    # denormalized for display
    created_at      = Column(DateTime, server_default=func.now())

    institution = relationship("Institution", back_populates="lesson_blocks")
    mini_group  = relationship("MiniGroup", back_populates="lesson_blocks")
    teachers    = relationship("Teacher",    secondary=block_teachers,    back_populates="lesson_blocks")
    subjects    = relationship("Subject",    secondary=block_subjects,    back_populates="lesson_blocks")
    classrooms  = relationship("Classroom",  secondary=block_classrooms,  back_populates="lesson_blocks")
    rooms       = relationship("Room",       secondary=block_rooms,       back_populates="lesson_blocks")


class GeneratedTimetable(Base):
    __tablename__ = "generated_timetables"

    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    mini_group_id   = Column(String, ForeignKey("mini_groups.id", ondelete="CASCADE"), nullable=True)
    name            = Column(String, default="Untitled Timetable")
    timetable_json  = Column(Text, nullable=False)
    fitness_score   = Column(Float, default=0.0)
    hard_violations = Column(Integer, default=0)
    soft_violations = Column(Integer, default=0)
    created_at      = Column(DateTime, server_default=func.now())

    institution     = relationship("Institution", back_populates="timetables")
    mini_group      = relationship("MiniGroup", back_populates="timetables")


class MiniGroup(Base):
    __tablename__ = "mini_groups"

    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    slot_index      = Column(Integer, default=1)  # 1 or 2
    name            = Column(String, nullable=False)
    days_per_week   = Column(Integer, default=5)
    periods_per_day = Column(Integer, default=7)
    break_after_period = Column(Integer, default=3)
    break_mask      = Column(String, default="0")
    working_slot_mask = Column(String, default="0")
    
    # Group configurations
    teacher_time_off_overrides = Column(Text, default="{}") 
    selected_teacher_ids = Column(Text, default="[]")
    selected_class_ids = Column(Text, default="[]")
    selected_room_ids = Column(Text, default="[]")
    selected_subject_ids = Column(Text, default="[]")
    
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, onupdate=func.now())

    institution   = relationship("Institution", back_populates="mini_groups")
    lesson_blocks = relationship("LessonBlock", back_populates="mini_group", cascade="all, delete-orphan")
    timetables    = relationship("GeneratedTimetable", back_populates="mini_group", cascade="all, delete-orphan")
    constraint_settings = relationship("ConstraintSettings", back_populates="mini_group", cascade="all, delete-orphan")


class ConstraintSettings(Base):
    __tablename__ = "constraint_settings"

    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    mini_group_id   = Column(String, ForeignKey("mini_groups.id", ondelete="CASCADE"), nullable=True)
    settings_json   = Column(Text, nullable=False, default="{}")
    constraint_mask = Column(BigInteger, nullable=False, default=0)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, server_default=func.now())

    institution     = relationship("Institution", back_populates="constraint_settings")
    mini_group      = relationship("MiniGroup", back_populates="constraint_settings")
