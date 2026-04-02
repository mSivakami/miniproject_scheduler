# ChromaSchedule — Deep Project Evaluation & Master Architecture
## Complete Analysis, Design Decisions & Development Plan

---

## Table of Contents

1. [Problem Statement Analysis](#1-problem-statement-analysis)
2. [Critical Design Decisions](#2-critical-design-decisions)
3. [System Architecture](#3-system-architecture)
4. [Entity Relationship & Data Model](#4-entity-relationship--data-model)
5. [Feature Breakdown by Module](#5-feature-breakdown-by-module)
6. [Authentication & Storage Strategy](#6-authentication--storage-strategy)
7. [Timetable Generation Pipeline](#7-timetable-generation-pipeline)
8. [Mini-Group Logic Design](#8-mini-group-logic-design)
9. [Saved Timetables & Drag-Drop System](#9-saved-timetables--drag-drop-system)
10. [PDF Export Strategy](#10-pdf-export-strategy)
11. [Development Phases](#11-development-phases)
12. [Risk Analysis](#12-risk-analysis)

---

## 1. Problem Statement Analysis

### What You Are Building

A **localhost-first, single-institution timetable generation system** with:
- A React frontend (Vite + Zustand)
- A FastAPI backend (Python)
- A C++ GA engine (called via subprocess or Pybind11)
- SQLite as the local database
- Optional future: deployable version with NeonDB/Postgres swap

### Core Complexity Factors

**1. The Lesson Block is the hardest entity to model.**
Your lesson block is not a simple "subject + teacher + room" triple. It can be:
- 1 teacher + 1 subject + 1 classroom + 1 room (standard)
- 2 teachers + 2 subjects + 2 rooms + 1 classroom split (elective/combined)
- Multiple teachers for the same subject (co-teaching)
- Lab sessions needing specific room types
- Sessions that must be contiguous (double/triple periods)

This means the chromosome encoding must treat a **lesson block as the atomic unit**, not individual periods. This is the most important architectural decision in the entire project.

**2. Contiguous period constraints (double/triple) require special GA handling.**
Standard GA encodes one gene per period. Doubles/triples must be encoded as a single gene with a `length` field, and crossover/mutation must respect that they cannot be split. This requires a custom chromosome structure — not something off-the-shelf GA libraries handle well.

**3. Two completely separate timetable contexts (Main + Mini-Group).**
These share teacher/room/subject data but have independent:
- Institution settings (days, periods, breaks)
- Lesson lists
- Constraint settings
- Generated output

The database must model this cleanly — not as a hack on top of the main structure.

**4. The "Pre-flight check" before generation is critical.**
Many GA runs fail or produce garbage because the input is mathematically impossible (more lesson-hours than available slots, locked lessons blocking key slots, etc.). Running a feasibility check before GA starts is not optional — it's what separates a professional tool from a toy.

**5. Bitmask strategy must be consistent end-to-end.**
Bitmasks for teacher availability, break positions, and room availability must use the same bit-index convention from database storage through the C++ GA engine. A mismatch here produces silent, hard-to-debug errors.

---

## 2. Critical Design Decisions

### Decision 1: SQLite, not MySQL
**Chosen: SQLite**

Reasons:
- Zero setup for localhost — no server process, no credentials
- Single `.db` file — entire project state is one file, easy to backup/copy
- SQLAlchemy ORM supports SQLite identically to MySQL/Postgres
- When you want deployment: change one connection string to Postgres/NeonDB — zero code changes
- For your data scale (< 10,000 rows total), SQLite is faster than MySQL

### Decision 2: Authentication Model
**Chosen: Local bcrypt + JWT, single-user per install**

Since this is localhost, you don't need multi-tenant auth. But you do need:
- Password-protected login (bcrypt hashed, stored in SQLite)
- JWT token for session (stored in httpOnly cookie or localStorage)
- First-run setup wizard to create the admin account

This gives you:
- Encryption (bcrypt for password, JWT for session)
- A foundation to expand to multi-user later
- No external dependency (no OAuth, no email server)

If you want the "login from any device" feel later — swap SQLite for NeonDB and add a proper auth flow. The code barely changes.

### Decision 3: Lesson Block as Atomic Gene Unit
**Chosen: Lesson Block is the gene**

Do NOT encode individual periods as genes. Encode entire lesson blocks. This means:
- A "double period Math, Class 10A, Room 201, Teacher Raj" is ONE gene
- The gene carries: block_id, assigned_day, assigned_start_period
- Contiguous blocks are guaranteed by construction — crossover cannot split them
- The chromosome is a list of (block, day, start_period) assignments

This is the approach used in the best academic literature (Schaerf 1999, Pillay 2010, Sørensen & Dahms 2014).

### Decision 4: Subprocess over Pybind11 for GA Integration
**Chosen: Subprocess (initially)**

Reasons:
- Simpler build pipeline for a first version
- C++ reads JSON from stdin, writes JSON to stdout
- Clean separation — can replace C++ with a Python GA for testing
- Migration to Pybind11 later is straightforward if needed

### Decision 5: Settings Export as Binary
**Chosen: MessagePack binary format**

- More compact than JSON
- Not human-readable (which you want for a "binary file" feel)
- Python has `msgpack` library, easy to implement
- Can be imported back to restore constraint settings exactly

### Decision 6: Post-GA Refinement Pass
**Chosen: Implement as Hill-Climbing, skip if risky**

After GA produces best timetable, a fast hill-climbing pass:
- Randomly selects two genes
- Checks if swapping improves soft constraint score
- Accepts swap only if improvement >= 0 (greedy, not SA)
- Runs for fixed time budget (e.g., 5 seconds max)
- Completely separate from GA — safe to skip if it causes issues

This is fast because it only checks affected constraints, not all constraints.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                   │
│                                                              │
│  Pages: Login | Setup | Dashboard | Data Entry | Settings   │
│          Generate | View Timetable | Saved | Export          │
│                                                              │
│  State: Zustand stores for each entity                      │
│         Dirty flags for unsaved changes                      │
│         Polling hook for job status                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP REST (localhost:8000)
┌──────────────────────▼──────────────────────────────────────┐
│                    BACKEND (FastAPI)                          │
│                                                              │
│  Routers: /auth  /institution  /teachers  /rooms            │
│           /subjects  /classrooms  /lessons                   │
│           /constraints  /generate  /jobs  /timetables        │
│           /mini-groups  /export                              │
│                                                              │
│  Services: AuthService | DataService | JobService           │
│            TimetableService | ExportService                  │
│                                                              │
│  Background: Job queue (asyncio) for GA runs                │
└──────────┬───────────────────────────────┬──────────────────┘
           │                               │
           ▼                               ▼
┌──────────────────┐             ┌─────────────────────┐
│  SQLite Database │             │  C++ GA Engine       │
│                  │             │                      │
│  - users         │             │  Input:  JSON stdin  │
│  - institution   │             │  Output: JSON stdout │
│  - teachers      │             │                      │
│  - classrooms    │             │  Compiled binary:    │
│  - subjects      │             │  ./ga_solver         │
│  - rooms         │             │                      │
│  - lesson_blocks │             │  Modules:            │
│  - constraints   │             │  - chromosome.h      │
│  - jobs          │             │  - fitness.h         │
│  - timetables    │             │  - crossover.h       │
│  - mini_groups   │             │  - mutation.h        │
└──────────────────┘             │  - selection.h       │
                                 │  - preflight.h       │
                                 └─────────────────────┘
```

---

## 4. Entity Relationship & Data Model

### Core Entities

```
Institution (1)
    │
    ├── has many → Teachers
    ├── has many → Classrooms
    ├── has many → Subjects
    ├── has many → Rooms
    ├── has many → LessonBlocks
    ├── has one  → ConstraintSettings (main)
    ├── has many → GeneratedTimetables (max 5)
    └── has many → MiniGroups (max 2)
                        │
                        └── has its own:
                                LessonBlocks (mini)
                                InstitutionSettings (mini)
                                ConstraintSettings (mini)
```

### Bitmask Convention (CRITICAL — must be consistent everywhere)

```
Slot index = (day_index × periods_per_day) + period_index

Example: 5 days × 8 periods = 40 slots → uint64 is more than enough

Day 0, Period 0 → bit 0  (least significant)
Day 0, Period 1 → bit 1
Day 0, Period 7 → bit 7
Day 1, Period 0 → bit 8
...
Day 4, Period 7 → bit 39

Break positions for Day 0, after Period 2:
  break_mask bit = day_index × periods_per_day + period_index
  (marks the period AFTER which a break occurs)
```

This same convention is used in:
- `teacher.available_mask` (uint64)
- `room.available_mask` (uint64)
- `institution.break_mask` (uint64)
- `lesson_block.locked_slot` (uint64, only 1 bit set, or 0 if unlocked)

### Key Table Schemas

#### `institution`
```sql
id, name, days_per_week, periods_per_day,
break_mask BIGINT,        -- bitmask of break positions
working_slot_mask BIGINT, -- precomputed: all valid non-break slots
created_at, updated_at
```

#### `teachers`
```sql
id, institution_id, name,
available_mask BIGINT,    -- 1=available, 0=unavailable
max_periods_per_day INT,
max_periods_per_week INT,
created_at
```

#### `classrooms`
```sql
id, institution_id, name, capacity INT, created_at
```

#### `subjects`
```sql
id, institution_id, name,
is_difficult BOOLEAN,     -- avoid scheduling in last periods
is_lab BOOLEAN,
created_at
```

#### `rooms`
```sql
id, institution_id, name,
is_lab BOOLEAN,
available_mask BIGINT,
created_at
```

#### `lesson_blocks` (most complex entity)
```sql
id, institution_id, mini_group_id (nullable),
lesson_type ENUM('single','double','triple'),
count INT,                -- how many times per week
is_locked BOOLEAN,
locked_slot BIGINT,       -- if locked: which slot (single bit set)
created_at

-- linked via junction tables:
-- lesson_block_teachers (block_id, teacher_id)
-- lesson_block_subjects (block_id, subject_id)
-- lesson_block_classrooms (block_id, classroom_id)
-- lesson_block_rooms (block_id, room_id)
```

#### `jobs`
```sql
id UUID, institution_id, job_type ENUM('main','mini'),
mini_group_id (nullable),
status ENUM('pending','running','complete','failed'),
progress INT (0-100),
result_json TEXT,
error_message TEXT,
created_at, updated_at
```

#### `generated_timetables`
```sql
id, institution_id, job_id,
name VARCHAR,             -- user can rename
timetable_json TEXT,      -- full serialized timetable
fitness_score FLOAT,
constraint_violations INT,
created_at
-- max 5 per institution, enforced in service layer
```

#### `mini_groups`
```sql
id, institution_id,
slot_index INT (1 or 2),  -- max 2 per institution
name VARCHAR,
days_per_week INT,
periods_per_day INT,
break_mask BIGINT,
constraint_settings_json TEXT,
created_at
```

#### `constraint_settings`
```sql
id, institution_id, mini_group_id (nullable),
settings_json TEXT,       -- full constraint config as JSON
is_active BOOLEAN,
created_at
```

---

## 5. Feature Breakdown by Module

### Module 1: Authentication & First-Run Setup
- First-run detection (no users in DB → redirect to setup)
- Institution name + admin account creation
- bcrypt password hashing
- JWT token issuance (24h expiry)
- Protected routes on frontend

### Module 2: Institution Settings
- Days per week (1–7)
- Periods per day (1–12)
- Break positions (visual period grid, click to mark breaks)
- Break mask computed and stored as uint64
- Working slot mask precomputed: `all_slots & ~break_mask`
- Edit anytime — regeneration required after change

### Module 3: Data Entry (Teachers, Rooms, Subjects, Classrooms)
- Full CRUD for each entity
- Teacher availability: visual grid (day × period), stored as bitmask
- Room availability: same grid
- Zustand holds unsaved changes with dirty flag
- "Save All" button commits all pending changes to SQLite

### Module 4: Lesson Block Builder
- Select: which teachers (multi-select)
- Select: which subjects (multi-select)
- Select: which classrooms (multi-select)
- Select: which rooms (multi-select)
- Set: lesson type (single/double/triple)
- Set: count per week
- Set: locked? → if yes, pick slot on grid
- Add to lesson list
- List view shows all blocks with edit/delete

### Module 5: Constraint Settings
- Toggle panel for all constraints (hard/soft)
- Soft constraint weight sliders
- Save settings to DB
- Export as `.csp` binary file (MessagePack)
- Import `.csp` file to restore settings

### Module 6: Timetable Generation
- Pre-flight validation (before GA runs)
- Job submission → backend queues GA run
- Progress polling (every 2s)
- Result display: class-wise, teacher-wise, room-wise views
- Save to favourites (max 5)

### Module 7: Mini-Group
- Select slot (1 or 2)
- Configure mini institution settings
- Build mini lesson list from main entity pool
- Set mini constraint settings
- Generate mini timetable (same pipeline, isolated data)

### Module 8: Saved Timetables & Drag-Drop
- List of up to 5 saved timetables
- Load any into drag-drop editor
- Swap two slots: validate constraint impact
- Warn on hard constraint violation, allow soft
- Mark as "final" to lock for export

### Module 9: PDF Export
- Select timetable
- Choose view: classwise / teacherwise / roomwise
- Generate PDF (WeasyPrint on backend OR jsPDF on frontend)
- Download file

---

## 6. Authentication & Storage Strategy

### Local Auth (Primary)
```
First launch:
  → No users in DB
  → Frontend detects → redirects to /setup
  → User enters: institution name, admin name, password
  → Backend: bcrypt.hash(password, 12) → store in users table
  → Issue JWT → store in localStorage (acceptable for localhost)
  → Redirect to dashboard

Subsequent launches:
  → Login page
  → POST /auth/login {username, password}
  → Backend: bcrypt.verify() → issue JWT
  → Frontend stores JWT → all API calls include Authorization: Bearer <token>
```

### Optional Future: Cloud Sync
When you want the "NeonDB feel":
1. Change `DATABASE_URL` in `.env` from `sqlite:///./app.db` to your NeonDB URL
2. Add user registration flow
3. Zero other code changes (SQLAlchemy handles it)

This is why using SQLAlchemy ORM matters — it abstracts the database entirely.

---

## 7. Timetable Generation Pipeline

```
[Frontend: User clicks Generate]
          │
          ▼
POST /api/generate
  → Create job record (status: pending)
  → Return job_id immediately
          │
          ▼ (background task)
[Pre-flight Check]
  → Total lesson-periods ≤ available slots?
  → Locked lessons not on break slots?
  → All teachers available for their assigned blocks?
  → All rooms available enough?
  → Double/triple blocks: enough contiguous slots?
  → Returns: warnings list, errors list
  → If hard errors: job status = "failed", return error list
  → If warnings only: proceed, attach warnings to result
          │
          ▼
[Serialize Input to JSON]
  → All lesson blocks with their teacher/room/subject/classroom assignments
  → Institution settings (days, periods, break_mask)
  → Teacher availability masks
  → Room availability masks
  → Active constraint mask (bitmask of which constraints are on)
  → Constraint weights
          │
          ▼
[Spawn C++ GA Process]
  subprocess.run(["./ga_solver"], input=json_string, ...)
          │ (C++ runs, Python waits)
          ▼
[C++ GA Output: JSON]
  → Best chromosome: list of (block_id, day, start_period)
  → Fitness score
  → Constraint violations list
  → Generation count
  → Time taken
          │
          ▼
[Post-GA Hill Climbing] (optional, time-limited)
  → Fast greedy swap pass
  → Runs max 5 seconds
  → Only improves soft constraints
          │
          ▼
[Expand Timetable]
  → Convert gene assignments to full slot-by-slot schedule
  → Build classwise view, teacherwise view, roomwise view
  → Attach all metadata (teacher names, room names, etc.)
          │
          ▼
[Save Result]
  → Update job status = "complete"
  → Store full timetable JSON in jobs table
          │
          ▼
[Frontend: Polling detects "complete"]
  → GET /api/jobs/{id}/result
  → Render timetable views
  → Offer "Save to Favourites"
```

---

## 8. Mini-Group Logic Design

### What a Mini-Group Is
A completely self-contained scheduling context that:
- **Borrows** entity definitions (teachers, rooms, subjects, classrooms) from the main institution pool
- **Defines its own** lesson blocks, institution settings (days/periods/breaks), and constraints
- **Generates independently** — does not affect main timetable
- **Has its own** saved timetables (separate from main's 5)

### Mini-Group Database Isolation
```
All mini-group lesson_blocks have: mini_group_id = <id>
All mini-group jobs have:          mini_group_id = <id>
All mini-group timetables have:    mini_group_id = <id>
Main timetable entities have:      mini_group_id = NULL
```

### Why Max 2 Mini-Groups
Two is enough for all real scenarios:
- Slot 1: Online-only mode (no labs, reduced teachers)
- Slot 2: Lab-intensive mode (catch-up labs, specific teachers)

More than 2 creates management complexity with no real benefit.

### Mini-Group UI Flow
```
[Mini-Groups Tab]
  → Slot 1: [Create] or [Edit] or [Generate]
  → Slot 2: [Create] or [Edit] or [Generate]

[Create/Edit Mini-Group]
  → Name this mini-group
  → Days: [3] Periods: [6] Breaks: [visual grid]
  → Select teachers from main list (multi-select with checkboxes)
  → Select rooms from main list
  → Build lesson blocks (same UI as main, but filtered to selected entities)
  → Configure constraints (simplified set, mini-specific)
  → Save

[Generate Mini-Group Timetable]
  → Same pipeline as main generation
  → GA receives only the mini-group's entities
  → Result stored under mini_group_id
```

---

## 9. Saved Timetables & Drag-Drop System

### Storage: Max 5 Per Context
```
Main timetable: max 5 saved
Mini-group 1:   max 5 saved
Mini-group 2:   max 5 saved
```

When the 6th is saved: either reject with "delete one first" or auto-delete oldest (user preference in settings).

### Drag-Drop Editor Design

The timetable is displayed as a grid: rows = periods, columns = days.
Each cell contains: subject, teacher, room.

**Swap interaction:**
1. User drags cell A onto cell B
2. Frontend calls `POST /api/timetable/{id}/swap` with `{slot_a, slot_b}`
3. Backend checks: does swapping violate any hard constraints?
   - Teacher available at new time?
   - Room available at new time?
   - Double/triple block: does new position have contiguous slots?
4. Returns: `{allowed: true/false, warnings: [...], violations: [...]}`
5. Frontend: if allowed → apply swap visually; if not → show error, revert

**Important:** Drag-drop only modifies the in-memory/displayed timetable. Changes are saved to DB only when user clicks "Save Changes".

### Timetable JSON Structure
```json
{
  "metadata": {
    "fitness_score": 0.94,
    "violations": [],
    "generated_at": "2025-01-01T10:00:00",
    "generation_count": 847
  },
  "slots": [
    {
      "day": 0,
      "period": 0,
      "block_id": "uuid",
      "teachers": [{"id": "uuid", "name": "Raj Kumar"}],
      "subjects": [{"id": "uuid", "name": "Mathematics"}],
      "classrooms": [{"id": "uuid", "name": "10A"}],
      "rooms": [{"id": "uuid", "name": "Room 201"}],
      "is_double": false,
      "is_locked": false
    }
  ],
  "views": {
    "by_class": { "10A": [[...slots by day/period...]] },
    "by_teacher": { "Raj Kumar": [[...]] },
    "by_room": { "Room 201": [[...]] }
  }
}
```

---

## 10. PDF Export Strategy

**Recommendation: Frontend PDF using `jsPDF` + `html2canvas`**

Reasons:
- No backend dependency
- User sees exactly what gets exported (WYSIWYG)
- No WeasyPrint installation headache on Windows

Implementation:
```javascript
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

async function exportPDF(viewType) {
  const element = document.getElementById('timetable-grid');
  const canvas = await html2canvas(element, { scale: 2 }); // 2x for sharpness
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  pdf.addImage(imgData, 'PNG', 10, 10, 277, 190);
  pdf.save(`timetable_${viewType}_${date}.pdf`);
}
```

For multi-page (one page per class/teacher/room):
- Iterate over each entity
- Render to canvas
- Add new page to PDF
- Result: one PDF with all views

---

## 11. Development Phases

### Phase 1: Foundation (Week 1–2)
- Project scaffold (Vite + FastAPI + SQLite)
- Authentication (login, JWT, first-run setup)
- Institution settings page
- Database models + migrations (Alembic)

### Phase 2: Data Entry (Week 2–3)
- Teacher CRUD + availability grid
- Classroom, Subject, Room CRUD
- Zustand stores for all entities
- Save All flow

### Phase 3: Lesson Builder (Week 3–4)
- Lesson block creation UI
- Multi-select for teachers/subjects/rooms/classrooms
- Single/double/triple type selector
- Locked lesson slot picker
- Lesson block list view

### Phase 4: Constraint Settings (Week 4)
- Constraint toggle panel
- Weight sliders
- Settings save/export/import (MessagePack)

### Phase 5: C++ GA Engine (Week 4–6)
- Chromosome encoding
- Fitness function with all constraints
- Crossover and mutation operators
- Pre-flight checker
- FastAPI job queue integration
- Progress reporting

### Phase 6: Timetable Display (Week 6–7)
- Class-wise, teacher-wise, room-wise views
- Save to favourites
- Drag-drop swap editor

### Phase 7: Mini-Groups (Week 7–8)
- Mini-group CRUD
- Mini-group generation pipeline
- Separate saved timetables

### Phase 8: Export & Polish (Week 8)
- PDF export (all views)
- Error handling and edge cases
- Performance testing
- Setup script + documentation

---

## 12. Risk Analysis

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| C++ build fails on target machine | Medium | Ship pre-compiled binary for Windows/Linux/Mac |
| GA doesn't converge for complex inputs | Medium | Pre-flight check catches impossible cases; time limit with best-so-far output |
| Double/triple block splitting in crossover | High | Encode as single gene — crossover at block boundaries only |
| SQLite write contention during background GA | Low | GA result written once at end; no concurrent writes |
| PDF rendering looks bad | Low | Test with multiple timetable sizes; use landscape A4 |
| Mini-group constraint conflicts with main pool | Low | Mini-groups are fully isolated — no shared job state |
| 5-timetable limit enforcement | Low | Service layer check before insert |

---

*This document is the master reference. Backend, Frontend, and GA Logic documents provide implementation detail for each layer.*
