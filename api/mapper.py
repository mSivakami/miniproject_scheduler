"""
mapper.py
---------
Fetches every row the scheduler needs from Neon and converts them into the
exact dataclass / object types that structures.py defines.

Returns
-------
teachers      : Dict[str, Teacher]
subjects      : Dict[str, Subject]
rooms         : Dict[str, Room]
classes       : Dict[str, Class]
lesson_blocks : List[LessonBlock]
breaks        : Dict[(day, period), Break]
"""

from sqlalchemy.orm import Session, joinedload

from models import (
    TeacherModel, SubjectModel, RoomModel,
    ClassModel, LessonBlockModel, BreakModel,
)
from structures import Teacher, Subject, Room, Class, LessonBlock, TimeSlot, Break


def fetch_and_map(db: Session):
    # ── Teachers ──────────────────────────────────────────────────────────
    teacher_rows = (
        db.query(TeacherModel)
        .options(joinedload(TeacherModel.unavailable))
        .all()
    )
    teachers: dict[str, Teacher] = {}
    for row in teacher_rows:
        teachers[row.id] = Teacher(
            id=row.id,
            name=row.name,
            unavailable_slots=[(u.day, u.period) for u in row.unavailable],
        )

    # ── Subjects ──────────────────────────────────────────────────────────
    subject_rows = db.query(SubjectModel).all()
    subjects: dict[str, Subject] = {
        row.id: Subject(
            id=row.id,
            name=row.name,
            is_difficult=row.is_difficult,
            is_lab=row.is_lab,
            priority=row.priority,
        )
        for row in subject_rows
    }

    # ── Rooms ─────────────────────────────────────────────────────────────
    room_rows = db.query(RoomModel).all()
    rooms: dict[str, Room] = {
        row.id: Room(id=row.id, name=row.name, is_lab=row.is_lab)
        for row in room_rows
    }

    # ── Classes ───────────────────────────────────────────────────────────
    class_rows = db.query(ClassModel).all()
    classes: dict[str, Class] = {
        row.id: Class(id=row.id, name=row.name)
        for row in class_rows
    }

    # ── Lesson blocks ─────────────────────────────────────────────────────
    lesson_rows = (
        db.query(LessonBlockModel)
        .options(
            joinedload(LessonBlockModel.teachers),
            joinedload(LessonBlockModel.classes),
            joinedload(LessonBlockModel.rooms),
        )
        .all()
    )
    lesson_blocks: list[LessonBlock] = []
    for row in lesson_rows:
        locked_ts = None
        if row.is_locked and row.locked_day is not None:
            locked_ts = TimeSlot(
                day=row.locked_day,
                start_period=row.locked_start_period,
                duration=row.duration,
            )
        lesson_blocks.append(
            LessonBlock(
                id=row.id,
                teacher_ids=[t.id for t in row.teachers],
                subject_id=row.subject_id,
                class_ids=[c.id for c in row.classes],
                room_ids=[r.id for r in row.rooms],
                duration=row.duration,
                is_locked=row.is_locked,
                locked_timeslot=locked_ts,
            )
        )

    # ── Breaks ────────────────────────────────────────────────────────────
    break_rows = db.query(BreakModel).all()
    breaks: dict[tuple, Break] = {
        (row.day, row.period): Break(name=row.name)
        for row in break_rows
    }

    return teachers, subjects, rooms, classes, lesson_blocks, breaks