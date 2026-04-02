# ChromaSchedule — Backend Architecture & Implementation Guide
## FastAPI + SQLite + C++ GA Integration

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Database Models (SQLAlchemy)](#2-database-models-sqlalchemy)
3. [API Router Design](#3-api-router-design)
4. [Authentication Service](#4-authentication-service)
5. [Data Services](#5-data-services)
6. [Job Queue & GA Integration](#6-job-queue--ga-integration)
7. [Pre-Flight Validator](#7-pre-flight-validator)
8. [Timetable Expansion Service](#8-timetable-expansion-service)
9. [Constraint Settings Export/Import](#9-constraint-settings-exportimport)
10. [Drag-Drop Swap Validator](#10-drag-drop-swap-validator)
11. [PDF Export Backend (Optional)](#11-pdf-export-backend-optional)
12. [Setup & Build Scripts](#12-setup--build-scripts)

---

## 1. Project Structure

```
backend/
├── main.py                    # FastAPI app entry point
├── database.py                # SQLAlchemy engine + session
├── models.py                  # All ORM models
├── schemas.py                 # Pydantic request/response schemas
├── dependencies.py            # Auth dependency injection
│
├── routers/
│   ├── auth.py                # /auth/login, /auth/setup, /auth/me
│   ├── institution.py         # /institution CRUD
│   ├── teachers.py            # /teachers CRUD
│   ├── classrooms.py          # /classrooms CRUD
│   ├── subjects.py            # /subjects CRUD
│   ├── rooms.py               # /rooms CRUD
│   ├── lesson_blocks.py       # /lesson-blocks CRUD
│   ├── constraints.py         # /constraints CRUD + export/import
│   ├── generate.py            # /generate, /jobs polling
│   ├── timetables.py          # /timetables CRUD + swap
│   ├── mini_groups.py         # /mini-groups CRUD + generate
│   └── export.py              # /export/pdf
│
├── services/
│   ├── auth_service.py        # bcrypt + JWT logic
│   ├── bitmask_service.py     # bitmask utilities
│   ├── preflight_service.py   # pre-generation validation
│   ├── job_service.py         # job lifecycle management
│   ├── ga_runner.py           # C++ subprocess wrapper
│   ├── timetable_service.py   # expansion + view building
│   └── export_service.py      # settings binary export
│
├── ga_engine/
│   ├── ga_solver.cpp          # Main C++ GA source
│   ├── chromosome.h
│   ├── fitness.h
│   ├── crossover.h
│   ├── mutation.h
│   ├── preflight.h
│   └── CMakeLists.txt
│
├── alembic/                   # DB migrations
│   ├── env.py
│   └── versions/
│
├── requirements.txt
├── .env
└── app.db                     # SQLite database (auto-created)
```

---

## 2. Database Models (SQLAlchemy)

```python
# models.py
from sqlalchemy import (Column, String, Integer, BigInteger, Boolean,
                        Float, Text, Enum, ForeignKey, DateTime, Table)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

def gen_uuid():
    return str(uuid.uuid4())

# ─── Junction Tables ────────────────────────────────────────────────────────

block_teachers = Table('block_teachers', Base.metadata,
    Column('block_id', String, ForeignKey('lesson_blocks.id')),
    Column('teacher_id', String, ForeignKey('teachers.id'))
)

block_subjects = Table('block_subjects', Base.metadata,
    Column('block_id', String, ForeignKey('lesson_blocks.id')),
    Column('subject_id', String, ForeignKey('subjects.id'))
)

block_classrooms = Table('block_classrooms', Base.metadata,
    Column('block_id', String, ForeignKey('lesson_blocks.id')),
    Column('classroom_id', String, ForeignKey('classrooms.id'))
)

block_rooms = Table('block_rooms', Base.metadata,
    Column('block_id', String, ForeignKey('lesson_blocks.id')),
    Column('room_id', String, ForeignKey('rooms.id'))
)

# ─── Core Models ────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = 'users'
    id            = Column(String, primary_key=True, default=gen_uuid)
    username      = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    institution_id = Column(String, ForeignKey('institutions.id'))
    created_at    = Column(DateTime, server_default=func.now())


class Institution(Base):
    __tablename__ = 'institutions'
    id               = Column(String, primary_key=True, default=gen_uuid)
    name             = Column(String, nullable=False)
    days_per_week    = Column(Integer, default=5)
    periods_per_day  = Column(Integer, default=8)
    break_mask       = Column(BigInteger, default=0)
    working_slot_mask = Column(BigInteger, default=0)  # precomputed
    created_at       = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, onupdate=func.now())

    teachers    = relationship('Teacher', back_populates='institution')
    classrooms  = relationship('Classroom', back_populates='institution')
    subjects    = relationship('Subject', back_populates='institution')
    rooms       = relationship('Room', back_populates='institution')
    lesson_blocks = relationship('LessonBlock',
                        primaryjoin="and_(LessonBlock.institution_id==Institution.id, "
                                         "LessonBlock.mini_group_id==None)")
    mini_groups = relationship('MiniGroup', back_populates='institution')
    timetables  = relationship('GeneratedTimetable', back_populates='institution')


class Teacher(Base):
    __tablename__ = 'teachers'
    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey('institutions.id'))
    name            = Column(String, nullable=False)
    available_mask  = Column(BigInteger, default=-1)  # -1 = all bits set = always available
    max_per_day     = Column(Integer, default=6)
    max_per_week    = Column(Integer, default=30)
    created_at      = Column(DateTime, server_default=func.now())

    institution     = relationship('Institution', back_populates='teachers')
    lesson_blocks   = relationship('LessonBlock', secondary=block_teachers)


class Classroom(Base):
    __tablename__ = 'classrooms'
    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey('institutions.id'))
    name            = Column(String, nullable=False)
    capacity        = Column(Integer, default=40)
    created_at      = Column(DateTime, server_default=func.now())

    institution     = relationship('Institution', back_populates='classrooms')


class Subject(Base):
    __tablename__ = 'subjects'
    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey('institutions.id'))
    name            = Column(String, nullable=False)
    is_difficult    = Column(Boolean, default=False)
    is_lab          = Column(Boolean, default=False)
    created_at      = Column(DateTime, server_default=func.now())

    institution     = relationship('Institution', back_populates='subjects')


class Room(Base):
    __tablename__ = 'rooms'
    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey('institutions.id'))
    name            = Column(String, nullable=False)
    is_lab          = Column(Boolean, default=False)
    available_mask  = Column(BigInteger, default=-1)
    created_at      = Column(DateTime, server_default=func.now())

    institution     = relationship('Institution', back_populates='rooms')


class LessonBlock(Base):
    __tablename__ = 'lesson_blocks'
    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey('institutions.id'))
    mini_group_id   = Column(String, ForeignKey('mini_groups.id'), nullable=True)
    lesson_type     = Column(Enum('single','double','triple'), default='single')
    count           = Column(Integer, default=1)  # times per week
    is_locked       = Column(Boolean, default=False)
    locked_slot     = Column(BigInteger, default=0)  # single bit set if locked
    created_at      = Column(DateTime, server_default=func.now())

    teachers    = relationship('Teacher',   secondary=block_teachers)
    subjects    = relationship('Subject',   secondary=block_subjects)
    classrooms  = relationship('Classroom', secondary=block_classrooms)
    rooms       = relationship('Room',      secondary=block_rooms)


class MiniGroup(Base):
    __tablename__ = 'mini_groups'
    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey('institutions.id'))
    slot_index      = Column(Integer, nullable=False)  # 1 or 2
    name            = Column(String, nullable=False)
    days_per_week   = Column(Integer, default=5)
    periods_per_day = Column(Integer, default=6)
    break_mask      = Column(BigInteger, default=0)
    constraint_settings_json = Column(Text, default='{}')
    created_at      = Column(DateTime, server_default=func.now())

    institution     = relationship('Institution', back_populates='mini_groups')
    lesson_blocks   = relationship('LessonBlock',
                        primaryjoin="LessonBlock.mini_group_id==MiniGroup.id")
    timetables      = relationship('GeneratedTimetable',
                        primaryjoin="GeneratedTimetable.mini_group_id==MiniGroup.id")


class ConstraintSettings(Base):
    __tablename__ = 'constraint_settings'
    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey('institutions.id'))
    mini_group_id   = Column(String, ForeignKey('mini_groups.id'), nullable=True)
    settings_json   = Column(Text, nullable=False)  # full constraint config
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, server_default=func.now())


class Job(Base):
    __tablename__ = 'jobs'
    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey('institutions.id'))
    mini_group_id   = Column(String, ForeignKey('mini_groups.id'), nullable=True)
    job_type        = Column(Enum('main','mini'), default='main')
    status          = Column(Enum('pending','running','complete','failed'), default='pending')
    progress        = Column(Integer, default=0)
    result_json     = Column(Text, nullable=True)
    warnings_json   = Column(Text, nullable=True)
    error_message   = Column(String, nullable=True)
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, onupdate=func.now())


class GeneratedTimetable(Base):
    __tablename__ = 'generated_timetables'
    id              = Column(String, primary_key=True, default=gen_uuid)
    institution_id  = Column(String, ForeignKey('institutions.id'))
    mini_group_id   = Column(String, ForeignKey('mini_groups.id'), nullable=True)
    job_id          = Column(String, ForeignKey('jobs.id'))
    name            = Column(String, default='Untitled Timetable')
    timetable_json  = Column(Text, nullable=False)
    fitness_score   = Column(Float, default=0.0)
    constraint_violations = Column(Integer, default=0)
    created_at      = Column(DateTime, server_default=func.now())

    institution     = relationship('Institution', back_populates='timetables')
```

---

## 3. API Router Design

```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import (auth, institution, teachers, classrooms,
                     subjects, rooms, lesson_blocks, constraints,
                     generate, timetables, mini_groups, export)

app = FastAPI(title="ChromaSchedule API")

app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Public
app.include_router(auth.router,         prefix="/api/auth")

# Protected (require JWT)
app.include_router(institution.router,  prefix="/api/institution")
app.include_router(teachers.router,     prefix="/api/teachers")
app.include_router(classrooms.router,   prefix="/api/classrooms")
app.include_router(subjects.router,     prefix="/api/subjects")
app.include_router(rooms.router,        prefix="/api/rooms")
app.include_router(lesson_blocks.router,prefix="/api/lesson-blocks")
app.include_router(constraints.router,  prefix="/api/constraints")
app.include_router(generate.router,     prefix="/api/generate")
app.include_router(timetables.router,   prefix="/api/timetables")
app.include_router(mini_groups.router,  prefix="/api/mini-groups")
app.include_router(export.router,       prefix="/api/export")

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

### Key Endpoints

```
POST   /api/auth/login              → {access_token}
POST   /api/auth/setup              → first-run account creation
GET    /api/auth/me                 → current user info

GET    /api/institution             → get institution settings
PUT    /api/institution             → update institution settings

GET    /api/teachers                → list all teachers
POST   /api/teachers                → create teacher
PUT    /api/teachers/{id}           → update teacher
DELETE /api/teachers/{id}           → delete teacher

POST   /api/lesson-blocks           → create lesson block
GET    /api/lesson-blocks           → list (filter: mini_group_id=null for main)
PUT    /api/lesson-blocks/{id}      → update
DELETE /api/lesson-blocks/{id}      → delete

GET    /api/constraints             → get active constraints
PUT    /api/constraints             → update constraints
POST   /api/constraints/export      → download .csp binary
POST   /api/constraints/import      → upload .csp binary

POST   /api/generate/preflight      → run pre-flight check only
POST   /api/generate/main           → start main GA job → {job_id}
POST   /api/generate/mini/{group_id} → start mini GA job → {job_id}
GET    /api/generate/jobs/{job_id}  → poll status {status, progress}
GET    /api/generate/jobs/{job_id}/result → get result timetable

GET    /api/timetables              → list saved (max 5)
POST   /api/timetables/save         → save current result
DELETE /api/timetables/{id}         → delete saved
POST   /api/timetables/{id}/swap    → swap two slots (drag-drop)
PUT    /api/timetables/{id}/name    → rename

GET    /api/mini-groups             → list mini-groups (max 2)
POST   /api/mini-groups             → create mini-group
PUT    /api/mini-groups/{id}        → update
DELETE /api/mini-groups/{id}        → delete

POST   /api/export/pdf              → generate PDF → file response
```

---

## 4. Authentication Service

```python
# services/auth_service.py
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM
    )

def decode_token(token: str) -> str:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload.get("sub")

# dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db)
):
    try:
        user_id = decode_token(credentials.credentials)
        user = db.query(User).get(user_id)
        if not user:
            raise HTTPException(status_code=401)
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

## 5. Data Services

### Bitmask Service

```python
# services/bitmask_service.py

def slot_to_bit(day: int, period: int, periods_per_day: int) -> int:
    """Convert day+period to bit index."""
    return day * periods_per_day + period

def bit_to_slot(bit: int, periods_per_day: int) -> tuple[int, int]:
    """Convert bit index to (day, period)."""
    return bit // periods_per_day, bit % periods_per_day

def compute_working_mask(days: int, periods: int, break_mask: int) -> int:
    """All valid slots minus breaks."""
    total_slots = days * periods
    all_slots = (1 << total_slots) - 1
    return all_slots & ~break_mask

def mask_to_grid(mask: int, days: int, periods: int) -> list[list[bool]]:
    """Convert bitmask to 2D grid for frontend display."""
    grid = []
    for d in range(days):
        row = []
        for p in range(periods):
            bit = slot_to_bit(d, p, periods)
            row.append(bool((mask >> bit) & 1))
        grid.append(row)
    return grid

def grid_to_mask(grid: list[list[bool]], periods_per_day: int) -> int:
    """Convert 2D grid from frontend to bitmask."""
    mask = 0
    for d, row in enumerate(grid):
        for p, available in enumerate(row):
            if available:
                mask |= (1 << slot_to_bit(d, p, periods_per_day))
    return mask
```

---

## 6. Job Queue & GA Integration

```python
# services/ga_runner.py
import subprocess, json, asyncio
from pathlib import Path

GA_BINARY = Path(__file__).parent.parent / "ga_engine" / "ga_solver"

def build_ga_input(institution, lesson_blocks, teachers, rooms,
                   constraints, mini_group=None) -> dict:
    """Serialize all scheduling data into GA input JSON."""
    return {
        "institution": {
            "days": mini_group.days_per_week if mini_group else institution.days_per_week,
            "periods": mini_group.periods_per_day if mini_group else institution.periods_per_day,
            "break_mask": mini_group.break_mask if mini_group else institution.break_mask,
            "working_mask": institution.working_slot_mask
        },
        "teachers": [
            {
                "id": t.id,
                "name": t.name,
                "available_mask": t.available_mask,
                "max_per_day": t.max_per_day,
                "max_per_week": t.max_per_week
            }
            for t in teachers
        ],
        "rooms": [
            {
                "id": r.id,
                "name": r.name,
                "is_lab": r.is_lab,
                "available_mask": r.available_mask
            }
            for r in rooms
        ],
        "subjects": [
            {
                "id": s.id,
                "name": s.name,
                "is_difficult": s.is_difficult,
                "is_lab": s.is_lab
            }
            for s in lesson_blocks[0].subjects  # all subjects from blocks
        ],
        "lesson_blocks": [
            {
                "id": b.id,
                "type": b.lesson_type,    # single/double/triple
                "length": {"single":1,"double":2,"triple":3}[b.lesson_type],
                "count": b.count,
                "is_locked": b.is_locked,
                "locked_slot": b.locked_slot,
                "teacher_ids": [t.id for t in b.teachers],
                "subject_ids": [s.id for s in b.subjects],
                "classroom_ids": [c.id for c in b.classrooms],
                "room_ids": [r.id for r in b.rooms]
            }
            for b in lesson_blocks
        ],
        "constraints": constraints,
        "ga_config": {
            "population_size": 300,
            "max_generations": 2000,
            "time_limit_seconds": 120,
            "elite_count": 15,
            "mutation_rate": 0.02,
            "tournament_size": 5
        }
    }


def run_ga_subprocess(ga_input: dict) -> dict:
    """Run C++ GA binary synchronously. Called in background thread."""
    input_json = json.dumps(ga_input)
    result = subprocess.run(
        [str(GA_BINARY)],
        input=input_json,
        capture_output=True,
        text=True,
        timeout=180  # 3 min hard limit
    )
    if result.returncode != 0:
        raise RuntimeError(f"GA failed: {result.stderr}")
    return json.loads(result.stdout)


# routers/generate.py
from fastapi import BackgroundTasks

@router.post("/main")
async def generate_main(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Create job record
    job = Job(institution_id=user.institution_id, job_type='main')
    db.add(job); db.commit()

    # Queue background task
    background_tasks.add_task(
        execute_ga_job, job.id, user.institution_id, None, db
    )
    return {"job_id": job.id}


def execute_ga_job(job_id: str, institution_id: str,
                   mini_group_id: str | None, db: Session):
    """Background task: run preflight, then GA, then save result."""
    job = db.query(Job).get(job_id)
    try:
        job.status = 'running'; db.commit()

        # Load data
        institution = db.query(Institution).get(institution_id)
        blocks = db.query(LessonBlock).filter(
            LessonBlock.institution_id == institution_id,
            LessonBlock.mini_group_id == mini_group_id
        ).all()
        teachers = institution.teachers
        rooms = institution.rooms
        constraints = get_active_constraints(db, institution_id, mini_group_id)

        # Pre-flight
        pf = PreflightValidator(institution, blocks, teachers, rooms)
        pf_result = pf.validate()
        if pf_result.has_hard_errors:
            job.status = 'failed'
            job.error_message = json.dumps(pf_result.errors)
            db.commit(); return

        job.warnings_json = json.dumps(pf_result.warnings)
        job.progress = 10; db.commit()

        # Build GA input
        mini_group = db.query(MiniGroup).get(mini_group_id) if mini_group_id else None
        ga_input = build_ga_input(institution, blocks, teachers, rooms,
                                  constraints, mini_group)

        job.progress = 15; db.commit()

        # Run GA
        ga_result = run_ga_subprocess(ga_input)

        job.progress = 90; db.commit()

        # Expand timetable
        expanded = TimetableExpander(ga_result, institution, blocks,
                                     teachers, rooms).expand()

        job.result_json = json.dumps(expanded)
        job.status = 'complete'
        job.progress = 100
        db.commit()

    except Exception as e:
        job.status = 'failed'
        job.error_message = str(e)
        db.commit()


@router.get("/jobs/{job_id}")
def poll_job(job_id: str, db=Depends(get_db), user=Depends(get_current_user)):
    job = db.query(Job).get(job_id)
    return {
        "status": job.status,
        "progress": job.progress,
        "warnings": json.loads(job.warnings_json or "[]"),
        "error": job.error_message
    }


@router.get("/jobs/{job_id}/result")
def get_result(job_id: str, db=Depends(get_db), user=Depends(get_current_user)):
    job = db.query(Job).get(job_id)
    if job.status != 'complete':
        raise HTTPException(400, "Job not complete")
    return json.loads(job.result_json)
```

---

## 7. Pre-Flight Validator

```python
# services/preflight_service.py
from dataclasses import dataclass, field

@dataclass
class PreflightResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def has_hard_errors(self) -> bool:
        return len(self.errors) > 0


class PreflightValidator:
    def __init__(self, institution, blocks, teachers, rooms):
        self.inst = institution
        self.blocks = blocks
        self.teachers = teachers
        self.rooms = rooms
        self.result = PreflightResult()

        self.days = institution.days_per_week
        self.periods = institution.periods_per_day
        self.working_mask = institution.working_slot_mask
        self.total_working = bin(self.working_mask).count('1')

    def validate(self) -> PreflightResult:
        self._check_slot_capacity()
        self._check_locked_lessons_on_breaks()
        self._check_locked_lessons_valid_slot()
        self._check_teacher_capacity()
        self._check_double_triple_feasibility()
        self._check_room_availability()
        return self.result

    def _check_slot_capacity(self):
        """Total lesson-periods must not exceed available working slots."""
        total_lesson_periods = sum(
            b.count * {"single":1,"double":2,"triple":3}[b.lesson_type]
            for b in self.blocks
        )
        # Very rough check: each classroom needs its own slots
        classrooms = set(c.id for b in self.blocks for c in b.classrooms)
        slots_needed = total_lesson_periods  # minimum
        if slots_needed > self.total_working * len(classrooms):
            self.result.errors.append(
                f"Too many lesson-periods ({slots_needed}) for available slots "
                f"({self.total_working} per classroom × {len(classrooms)} classrooms)"
            )
        elif slots_needed > self.total_working * len(classrooms) * 0.9:
            self.result.warnings.append(
                "Slot utilization > 90% — timetable will be very tight. "
                "Consider adding periods or reducing lessons."
            )

    def _check_locked_lessons_on_breaks(self):
        """Locked lessons must not fall on break slots."""
        from services.bitmask_service import bit_to_slot
        for b in self.blocks:
            if b.is_locked and b.locked_slot:
                bit = b.locked_slot.bit_length() - 1
                if self.inst.break_mask & b.locked_slot:
                    day, period = bit_to_slot(bit, self.periods)
                    self.result.errors.append(
                        f"Lesson block '{b.id}' is locked to a break slot "
                        f"(Day {day+1}, Period {period+1})"
                    )

    def _check_locked_lessons_valid_slot(self):
        """Locked lessons must be within the institution's grid."""
        for b in self.blocks:
            if b.is_locked and b.locked_slot:
                bit = b.locked_slot.bit_length() - 1
                max_bit = self.days * self.periods - 1
                if bit > max_bit:
                    self.result.errors.append(
                        f"Lesson block '{b.id}' locked slot exceeds institution grid"
                    )

    def _check_double_triple_feasibility(self):
        """Double/triple blocks need contiguous available slots."""
        length_map = {"single":1,"double":2,"triple":3}
        for b in self.blocks:
            length = length_map[b.lesson_type]
            if length < 2:
                continue
            # Check if any day has enough contiguous working slots
            has_valid_slot = False
            for day in range(self.days):
                consec = 0
                for period in range(self.periods):
                    bit = day * self.periods + period
                    if (self.working_mask >> bit) & 1:
                        consec += 1
                        if consec >= length:
                            has_valid_slot = True
                            break
                    else:
                        consec = 0
                if has_valid_slot:
                    break
            if not has_valid_slot:
                self.result.errors.append(
                    f"{'Double' if length==2 else 'Triple'} block '{b.id}' "
                    f"cannot fit — no {length} consecutive working slots exist"
                )

    def _check_teacher_capacity(self):
        """Total teacher assignments must fit their available slots."""
        from collections import defaultdict
        teacher_load = defaultdict(int)
        for b in self.blocks:
            length = {"single":1,"double":2,"triple":3}[b.lesson_type]
            for t in b.teachers:
                teacher_load[t.id] += b.count * length

        for t in self.teachers:
            load = teacher_load.get(t.id, 0)
            avail = bin(t.available_mask & self.working_mask).count('1')
            if load > avail:
                self.result.errors.append(
                    f"Teacher '{t.name}' has {load} lesson-periods but only "
                    f"{avail} available working slots"
                )
            elif load > avail * 0.85:
                self.result.warnings.append(
                    f"Teacher '{t.name}' schedule is very dense ({load}/{avail} slots used)"
                )

    def _check_room_availability(self):
        """Rooms must have enough available slots for assigned blocks."""
        from collections import defaultdict
        room_load = defaultdict(int)
        for b in self.blocks:
            length = {"single":1,"double":2,"triple":3}[b.lesson_type]
            for r in b.rooms:
                room_load[r.id] += b.count * length

        for r in self.rooms:
            load = room_load.get(r.id, 0)
            avail = bin(r.available_mask & self.working_mask).count('1')
            if load > avail:
                self.result.errors.append(
                    f"Room '{r.name}' has {load} periods needed but only "
                    f"{avail} available slots"
                )
```

---

## 8. Timetable Expansion Service

```python
# services/timetable_service.py

class TimetableExpander:
    """Convert raw GA gene output into rich display structure."""

    def __init__(self, ga_result, institution, blocks_map,
                 teachers_map, rooms_map):
        self.ga_result = ga_result  # list of {block_id, day, start_period}
        self.inst = institution
        self.blocks_map = {b.id: b for b in blocks_map}
        self.teachers_map = {t.id: t for t in teachers_map}
        self.rooms_map = {r.id: r for r in rooms_map}

    def expand(self) -> dict:
        days = self.inst.days_per_week
        periods = self.inst.periods_per_day

        # Initialize empty grid: [day][period] = None
        grid = [[None] * periods for _ in range(days)]

        slots = []
        for gene in self.ga_result["genes"]:
            block = self.blocks_map[gene["block_id"]]
            length = {"single":1,"double":2,"triple":3}[block.lesson_type]

            for offset in range(length):
                period = gene["start_period"] + offset
                entry = {
                    "day": gene["day"],
                    "period": period,
                    "block_id": block.id,
                    "is_double_start": block.lesson_type != 'single' and offset == 0,
                    "is_continuation": offset > 0,
                    "length": length,
                    "teachers": [{"id": t.id, "name": t.name} for t in block.teachers],
                    "subjects": [{"id": s.id, "name": s.name} for s in block.subjects],
                    "classrooms": [{"id": c.id, "name": c.name} for c in block.classrooms],
                    "rooms": [{"id": r.id, "name": r.name} for r in block.rooms],
                    "is_lab": any(s.is_lab for s in block.subjects),
                    "is_locked": block.is_locked
                }
                grid[gene["day"]][period] = entry
                slots.append(entry)

        return {
            "metadata": {
                "fitness_score": self.ga_result["fitness"],
                "constraint_violations": self.ga_result["violations"],
                "generation_count": self.ga_result["generations"],
                "time_ms": self.ga_result["time_ms"]
            },
            "slots": slots,
            "grid": grid,
            "views": {
                "by_class": self._build_class_view(slots),
                "by_teacher": self._build_teacher_view(slots),
                "by_room": self._build_room_view(slots)
            }
        }

    def _build_class_view(self, slots):
        from collections import defaultdict
        view = defaultdict(lambda: [[None]*self.inst.periods_per_day
                                    for _ in range(self.inst.days_per_week)])
        for s in slots:
            for c in s["classrooms"]:
                view[c["name"]][s["day"]][s["period"]] = s
        return dict(view)

    def _build_teacher_view(self, slots):
        from collections import defaultdict
        view = defaultdict(lambda: [[None]*self.inst.periods_per_day
                                    for _ in range(self.inst.days_per_week)])
        for s in slots:
            for t in s["teachers"]:
                view[t["name"]][s["day"]][s["period"]] = s
        return dict(view)

    def _build_room_view(self, slots):
        from collections import defaultdict
        view = defaultdict(lambda: [[None]*self.inst.periods_per_day
                                    for _ in range(self.inst.days_per_week)])
        for s in slots:
            for r in s["rooms"]:
                view[r["name"]][s["day"]][s["period"]] = s
        return dict(view)
```

---

## 9. Constraint Settings Export/Import

```python
# services/export_service.py
import msgpack

def export_constraints(settings_dict: dict) -> bytes:
    """Serialize constraint settings to binary MessagePack."""
    return msgpack.packb({
        "version": 1,
        "type": "chromaschedule_constraints",
        "settings": settings_dict
    }, use_bin_type=True)

def import_constraints(binary_data: bytes) -> dict:
    """Deserialize constraint settings from binary file."""
    data = msgpack.unpackb(binary_data, raw=False)
    if data.get("type") != "chromaschedule_constraints":
        raise ValueError("Invalid constraint file format")
    return data["settings"]

# Router
@router.post("/export")
def export_constraints_file(db=Depends(get_db), user=Depends(get_current_user)):
    settings = get_active_constraints(db, user.institution_id)
    binary = export_constraints(settings)
    return Response(
        content=binary,
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename=constraints.csp"}
    )

@router.post("/import")
async def import_constraints_file(
    file: UploadFile,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    data = await file.read()
    settings = import_constraints(data)
    save_constraints(db, user.institution_id, settings)
    return {"message": "Constraints imported successfully"}
```

---

## 10. Drag-Drop Swap Validator

```python
# services/swap_validator.py

def validate_swap(timetable: dict, slot_a: dict, slot_b: dict,
                  teachers_map, rooms_map, institution) -> dict:
    """
    Check if swapping two timetable slots is valid.
    Returns {allowed, warnings, violations}
    """
    violations = []
    warnings = []

    entry_a = get_slot_entry(timetable, slot_a["day"], slot_a["period"])
    entry_b = get_slot_entry(timetable, slot_b["day"], slot_b["period"])

    if not entry_a or not entry_b:
        return {"allowed": False, "violations": ["One or both slots are empty"]}

    # Cannot swap locked lessons
    if entry_a.get("is_locked") or entry_b.get("is_locked"):
        return {"allowed": False, "violations": ["Cannot move locked lessons"]}

    # Cannot swap continuations (middle of double/triple)
    if entry_a.get("is_continuation") or entry_b.get("is_continuation"):
        return {"allowed": False, "violations": ["Cannot move middle of double/triple period"]}

    # Check: after swap, do teachers have conflicts?
    for teacher in entry_a["teachers"]:
        t = teachers_map[teacher["id"]]
        bit_b = slot_b["day"] * institution.periods_per_day + slot_b["period"]
        if not ((t.available_mask >> bit_b) & 1):
            violations.append(f"Teacher {teacher['name']} not available at new slot")

    for teacher in entry_b["teachers"]:
        t = teachers_map[teacher["id"]]
        bit_a = slot_a["day"] * institution.periods_per_day + slot_a["period"]
        if not ((t.available_mask >> bit_a) & 1):
            violations.append(f"Teacher {teacher['name']} not available at new slot")

    # Check: rooms available at swapped positions?
    for room in entry_a["rooms"]:
        r = rooms_map[room["id"]]
        bit_b = slot_b["day"] * institution.periods_per_day + slot_b["period"]
        if not ((r.available_mask >> bit_b) & 1):
            violations.append(f"Room {room['name']} not available at new slot")

    allowed = len(violations) == 0
    return {"allowed": allowed, "warnings": warnings, "violations": violations}
```

---

## 11. Saved Timetables — Max 5 Enforcement

```python
# services/timetable_service.py (continued)

MAX_SAVED_TIMETABLES = 5

def save_timetable(db, institution_id, mini_group_id, job_id,
                   timetable_data, name="Untitled") -> GeneratedTimetable:
    # Count existing
    count = db.query(GeneratedTimetable).filter(
        GeneratedTimetable.institution_id == institution_id,
        GeneratedTimetable.mini_group_id == mini_group_id
    ).count()

    if count >= MAX_SAVED_TIMETABLES:
        raise HTTPException(400,
            f"Maximum {MAX_SAVED_TIMETABLES} saved timetables reached. "
            "Please delete one before saving.")

    tt = GeneratedTimetable(
        institution_id=institution_id,
        mini_group_id=mini_group_id,
        job_id=job_id,
        name=name,
        timetable_json=json.dumps(timetable_data),
        fitness_score=timetable_data["metadata"]["fitness_score"],
        constraint_violations=len(timetable_data["metadata"]["constraint_violations"])
    )
    db.add(tt); db.commit()
    return tt
```

---

## 12. Setup & Build Scripts

### `setup.sh` (Linux/Mac)
```bash
#!/bin/bash
echo "=== ChromaSchedule Setup ==="

# Install Python deps
pip install -r requirements.txt

# Install msgpack
pip install msgpack python-jose passlib pybind11

# Build C++ GA binary
cd backend/ga_engine
g++ -O2 -std=c++17 -o ga_solver ga_solver.cpp
cd ../..

# Run DB migrations
alembic upgrade head

echo "=== Setup complete. Run ./start.sh to launch ==="
```

### `setup.bat` (Windows)
```bat
@echo off
echo === ChromaSchedule Setup ===
pip install -r requirements.txt
cd backend\ga_engine
g++ -O2 -std=c++17 -o ga_solver.exe ga_solver.cpp
cd ..\..
alembic upgrade head
echo === Setup complete. Run start.bat to launch ===
```

### `start.sh`
```bash
#!/bin/bash
# Start backend
cd backend
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
```

### `requirements.txt`
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.36
alembic==1.13.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.12
msgpack==1.1.0
pydantic==2.9.0
```

---

*Refer to GA Logic document for the C++ engine implementation.*
*Refer to Frontend document for Zustand store and React component design.*
