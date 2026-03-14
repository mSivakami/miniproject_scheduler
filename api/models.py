from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey, Table
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


# ── Many-to-many join tables ──────────────────────────────────────────────────

lesson_teachers = Table(
    "lesson_teachers", Base.metadata,
    Column("lesson_id",    String, ForeignKey("lesson_blocks.id"), primary_key=True),
    Column("teacher_id",   String, ForeignKey("teachers.id"),      primary_key=True),
)

lesson_classes = Table(
    "lesson_classes", Base.metadata,
    Column("lesson_id",  String, ForeignKey("lesson_blocks.id"), primary_key=True),
    Column("class_id",   String, ForeignKey("classes.id"),       primary_key=True),
)

lesson_rooms = Table(
    "lesson_rooms", Base.metadata,
    Column("lesson_id", String, ForeignKey("lesson_blocks.id"), primary_key=True),
    Column("room_id",   String, ForeignKey("rooms.id"),         primary_key=True),
)

# ── ORM Models ────────────────────────────────────────────────────────────────

class TeacherModel(Base):
    __tablename__ = "teachers"

    id   = Column(String, primary_key=True)
    name = Column(String, nullable=False)

    unavailable = relationship("TeacherUnavailableModel", back_populates="teacher")
    lessons     = relationship("LessonBlockModel", secondary=lesson_teachers, back_populates="teachers")


class TeacherUnavailableModel(Base):
    __tablename__ = "teacher_unavailable"

    teacher_id = Column(String, ForeignKey("teachers.id"), primary_key=True)
    day        = Column(Integer, primary_key=True)
    period     = Column(Integer, primary_key=True)

    teacher = relationship("TeacherModel", back_populates="unavailable")


class SubjectModel(Base):
    __tablename__ = "subjects"

    id           = Column(String,  primary_key=True)
    name         = Column(String,  nullable=False)
    is_difficult = Column(Boolean, default=False)
    is_lab       = Column(Boolean, default=False)
    priority     = Column(Integer, default=5)


class RoomModel(Base):
    __tablename__ = "rooms"

    id     = Column(String,  primary_key=True)
    name   = Column(String,  nullable=False)
    is_lab = Column(Boolean, default=False)

    lessons = relationship("LessonBlockModel", secondary=lesson_rooms, back_populates="rooms")


class ClassModel(Base):
    __tablename__ = "classes"

    id   = Column(String, primary_key=True)
    name = Column(String, nullable=False)

    lessons = relationship("LessonBlockModel", secondary=lesson_classes, back_populates="classes")


class LessonBlockModel(Base):
    __tablename__ = "lesson_blocks"

    id                   = Column(String,  primary_key=True)
    subject_id           = Column(String,  ForeignKey("subjects.id"), nullable=False)
    duration             = Column(Integer, default=1)
    is_locked            = Column(Boolean, default=False)
    locked_day           = Column(Integer, nullable=True)   # null if not locked
    locked_start_period  = Column(Integer, nullable=True)

    subject  = relationship("SubjectModel")
    teachers = relationship("TeacherModel",  secondary=lesson_teachers, back_populates="lessons")
    classes  = relationship("ClassModel",    secondary=lesson_classes,  back_populates="lessons")
    rooms    = relationship("RoomModel",     secondary=lesson_rooms,    back_populates="lessons")


class BreakModel(Base):
    __tablename__ = "breaks"

    day    = Column(Integer, primary_key=True)
    period = Column(Integer, primary_key=True)
    name   = Column(String,  default="Break")