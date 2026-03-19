from sqlalchemy import (
    Column, String, Integer, Boolean, Text,
    ForeignKey, Table, CheckConstraint, TIMESTAMP
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()

# ── Join tables ───────────────────────────────────────────────────────────────

lesson_teachers = Table(
    "lesson_teachers", Base.metadata,
    Column("lesson_id",  String, ForeignKey("lesson_blocks.id", ondelete="CASCADE"), primary_key=True),
    Column("teacher_id", String, ForeignKey("teachers.id",      ondelete="RESTRICT"), primary_key=True),
)

lesson_classes = Table(
    "lesson_classes", Base.metadata,
    Column("lesson_id", String, ForeignKey("lesson_blocks.id", ondelete="CASCADE"), primary_key=True),
    Column("class_id",  String, ForeignKey("classes.id",       ondelete="RESTRICT"), primary_key=True),
)

lesson_rooms = Table(
    "lesson_rooms", Base.metadata,
    Column("lesson_id", String, ForeignKey("lesson_blocks.id", ondelete="CASCADE"), primary_key=True),
    Column("room_id",   String, ForeignKey("rooms.id",         ondelete="RESTRICT"), primary_key=True),
)

# ── Core entity models ────────────────────────────────────────────────────────

class TeacherModel(Base):
    __tablename__ = "teachers"

    id         = Column(String, primary_key=True)
    name       = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    unavailable = relationship(
        "TeacherUnavailableModel",
        back_populates="teacher",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    lessons = relationship("LessonBlockModel", secondary=lesson_teachers, back_populates="teachers")


class TeacherUnavailableModel(Base):
    __tablename__ = "teacher_unavailable"

    teacher_id = Column(String, ForeignKey("teachers.id", ondelete="CASCADE"), primary_key=True)
    day        = Column(Integer, primary_key=True)
    period     = Column(Integer, primary_key=True)

    teacher = relationship("TeacherModel", back_populates="unavailable")


class SubjectModel(Base):
    __tablename__ = "subjects"

    id           = Column(String,  primary_key=True)
    name         = Column(String,  nullable=False)
    is_difficult = Column(Boolean, nullable=False, default=False)
    is_lab       = Column(Boolean, nullable=False, default=False)
    priority     = Column(Integer, nullable=False, default=5)
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())


class RoomModel(Base):
    __tablename__ = "rooms"

    id         = Column(String,  primary_key=True)
    name       = Column(String,  nullable=False)
    is_lab     = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    lessons = relationship("LessonBlockModel", secondary=lesson_rooms, back_populates="rooms")


class ClassModel(Base):
    __tablename__ = "classes"

    id         = Column(String, primary_key=True)
    name       = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    lessons = relationship("LessonBlockModel", secondary=lesson_classes, back_populates="classes")


class LessonBlockModel(Base):
    __tablename__ = "lesson_blocks"

    id                  = Column(String,  primary_key=True)
    subject_id          = Column(String,  ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False)
    duration            = Column(Integer, nullable=False, default=1)
    is_locked           = Column(Boolean, nullable=False, default=False)
    locked_day          = Column(Integer, nullable=True)
    locked_start_period = Column(Integer, nullable=True)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now())

    subject  = relationship("SubjectModel")
    teachers = relationship("TeacherModel", secondary=lesson_teachers, back_populates="lessons", lazy="selectin")
    classes  = relationship("ClassModel",   secondary=lesson_classes,  back_populates="lessons", lazy="selectin")
    rooms    = relationship("RoomModel",    secondary=lesson_rooms,    back_populates="lessons", lazy="selectin")


# ── Generation job ────────────────────────────────────────────────────────────

class GenerationJobModel(Base):
    __tablename__ = "generation_jobs"

    id          = Column(String, primary_key=True)
    status      = Column(String, nullable=False, default="pending")
    started_at  = Column(TIMESTAMP(timezone=True), nullable=True)
    finished_at = Column(TIMESTAMP(timezone=True), nullable=True)
    error       = Column(Text, nullable=True)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())

    timetables = relationship("TimetableModel", back_populates="job", cascade="all, delete-orphan")


# ── Timetable result ──────────────────────────────────────────────────────────

class TimetableModel(Base):
    __tablename__ = "timetables"

    id         = Column(String, primary_key=True)
    job_id     = Column(String, ForeignKey("generation_jobs.id", ondelete="CASCADE"), nullable=False)
    fitness    = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    job     = relationship("GenerationJobModel", back_populates="timetables")
    entries = relationship("TimetableEntryModel", back_populates="timetable", cascade="all, delete-orphan")


class TimetableEntryModel(Base):
    __tablename__ = "timetable_entries"

    id           = Column(String, primary_key=True)
    timetable_id = Column(String, ForeignKey("timetables.id",     ondelete="CASCADE"), nullable=False)
    lesson_id    = Column(String, ForeignKey("lesson_blocks.id",  ondelete="CASCADE"), nullable=False)
    day          = Column(Integer, nullable=False)
    start_period = Column(Integer, nullable=False)
    duration     = Column(Integer, nullable=False)

    timetable = relationship("TimetableModel", back_populates="entries")
    lesson    = relationship("LessonBlockModel")