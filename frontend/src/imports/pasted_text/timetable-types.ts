# All structures must match exactly for backend to work.

# ============================================================
# 1. ZUSTAND STORE — EXACT TYPES
# ============================================================

interface Teacher {
  id: string
  name: string
  short: string
  color: string
  unavailable_slots: { day: number; period: number }[]
  # day: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
  # period: 0-indexed (0 to periodsPerDay-1)
  # timeOff 2D array is REMOVED — use unavailable_slots instead
}

interface Subject {
  id: string
  name: string
  short: string
  is_difficult: boolean   # replaces type: 'soft'|'hard'|'medium'
  is_lab: boolean         # new field
  priority: number        # 1-10, kept but hidden in UI per spec
}

interface Class {
  id: string
  name: string
  short: string
  # count REMOVED
  # timeOff REMOVED
}

interface Classroom {
  id: string
  name: string
  short: string
  is_lab: boolean         # replaces type: 'R'|'L'|'H'
  building: string
  color: string
  # count REMOVED
  # timeOff REMOVED
  # type string REMOVED
}

interface Session {
  duration: 1 | 2 | 3    # 1=single, 2=double, 3=triple — INTEGER not string
  count: number
}

interface Lesson {
  id: string
  subject_id: string                  # snake_case
  teacher_ids: string[]               # ARRAY — supports multiple
  class_ids: string[]                 # ARRAY — supports multiple
  room_ids: string[]                  # ARRAY — supports multiple
  sessions: Session[]
  is_locked: boolean
  locked_day: number | null           # 0=Mon … 4=Fri
  locked_start_period: number | null  # 0-INDEXED (UI shows 1-7, store 0-6)
  locked_duration: 1 | 2 | 3 | null  # INTEGER not string
}

interface Break {
  day: number     # 0=Mon … 4=Fri, or use -1 for "every day"
  period: number  # 0-indexed
}

interface AppSettings {
  schoolName: string
  academicYear: string
  periodsPerDay: string   # keep as string for select input
  numberOfDays: string    # keep as string for select input
  breaks: Break[]         # replaces weekend string
}

interface GenerationState {
  jobId: string | null
  status: 'idle' | 'pending' | 'running' | 'done' | 'failed'
  error: string | null
  timetable: {
    timetable_id: string
    fitness: number
    entries: TimetableEntry[]
    generation_time_seconds: number | null
  } | null
}

interface TimetableEntry {
  lesson_id: string
  day: number           # 0-indexed
  start_period: number  # 0-indexed
  duration: number      # 1, 2, or 3
  subject_id: string
  subject_name: string
  teacher_ids: string[]
  class_ids: string[]
  room_ids: string[]
}

# Partialize (what gets saved to localStorage):
partialize: {
  changes: Changes   # only unsaved edits persist
  # everything else resets on reload
}

# ============================================================
# 2. SAVE-ALL PAYLOAD — exact shape to POST /api/save-all
# ============================================================

POST /api/save-all
Authorization: Bearer <token>
Content-Type: application/json

{
  "teachers": {
    "added": [
      {
        "name": "John Doe",
        "short": "JD",
        "color": "#3b82f6",
        "unavailable_slots": [
          { "day": 0, "period": 2 },
          { "day": 1, "period": 4 }
        ]
      }
    ],
    "updated": {
      "<real-uuid>": {
        "name": "John Doe",
        "short": "JD",
        "color": "#3b82f6",
        "unavailable_slots": [{ "day": 0, "period": 2 }]
      }
    },
    "deleted": ["<real-uuid>"]
  },

  "subjects": {
    "added": [
      {
        "name": "Physics",
        "short": "PHY",
        "is_difficult": true,
        "is_lab": false,
        "priority": 2
      }
    ],
    "updated": { "<real-uuid>": { "name": "...", "short": "...", "is_difficult": false, "is_lab": false, "priority": 3 } },
    "deleted": []
  },

  "rooms": {
    "added": [
      {
        "name": "Lab A",
        "short": "LA",
        "is_lab": true,
        "building": "CS Building",
        "color": "#10b981"
      }
    ],
    "updated": {},
    "deleted": []
  },

  "classes": {
    "added": [
      { "name": "Semester 2", "short": "S2" }
    ],
    "updated": {},
    "deleted": []
  },

  "lessons": {
    "added": [
      {
        "subject_id": "<real-uuid>",
        "teacher_ids": ["<uuid1>", "<uuid2>"],
        "class_ids": ["<uuid1>"],
        "room_ids": ["<uuid1>", "<uuid2>"],
        "sessions": [
          { "duration": 1, "count": 3 },
          { "duration": 2, "count": 1 }
        ],
        "is_locked": false,
        "locked_day": null,
        "locked_start_period": null,
        "locked_duration": null
      }
    ],
    "updated": {
      "<real-uuid>": {
        "subject_id": "<real-uuid>",
        "teacher_ids": ["<uuid>"],
        "class_ids": ["<uuid>"],
        "room_ids": ["<uuid>"],
        "sessions": [{ "duration": 1, "count": 4 }],
        "is_locked": true,
        "locked_day": 0,
        "locked_start_period": 2,
        "locked_duration": 2
      }
    },
    "deleted": []
  }
}

# IMPORTANT RULES FOR SAVE-ALL:
# - added items: strip the id field entirely (backend assigns real UUID)
# - updated items: key is the REAL DB uuid (not tmp_xxx)
# - deleted items: only REAL DB uuids (filter out tmp_xxx before sending)
# - lessons.added: subject_id, teacher_ids, class_ids, room_ids must be REAL UUIDs
# - save in TWO PASSES: teachers/subjects/rooms/classes first → bootstrap → then lessons
# - locked_start_period is 0-INDEXED: UI period 1 = store value 0

# ============================================================
# 3. BOOTSTRAP RESPONSE — exact shape from GET /api/bootstrap
# ============================================================

GET /api/bootstrap
Authorization: Bearer <token>

Response:
{
  "teachers": [
    {
      "id": "<uuid>",
      "name": "John Doe",
      "short": "JD",
      "color": "#3b82f6",
      "unavailable_slots": [{ "day": 0, "period": 2 }]
    }
  ],
  "subjects": [
    {
      "id": "<uuid>",
      "name": "Physics",
      "short": "PHY",
      "is_difficult": true,
      "is_lab": false,
      "priority": 2
    }
  ],
  "rooms": [
    {
      "id": "<uuid>",
      "name": "Lab A",
      "short": "LA",
      "is_lab": true,
      "building": "CS Building",
      "color": "#10b981"
    }
  ],
  "classes": [
    { "id": "<uuid>", "name": "Semester 2", "short": "S2" }
  ],
  "lessons": [
    {
      "id": "<uuid>",
      "subject_id": "<uuid>",
      "teacher_ids": ["<uuid>"],
      "class_ids": ["<uuid>"],
      "room_ids": ["<uuid>"],
      "sessions": [{ "duration": 1, "count": 3 }, { "duration": 2, "count": 1 }],
      "is_locked": false,
      "locked_day": null,
      "locked_start_period": null,
      "locked_duration": null,
      "total_periods": 5
    }
  ]
}

# On bootstrap load:
# - replace entire store (teachers, subjects, rooms, classes, lessons) with response
# - convert unavailable_slots back to timeOff grid if UI needs it:
#     timeOff[day][period] = !unavailable_slots.some(s => s.day===day && s.period===period)

# ============================================================
# 4. GENERATION API
# ============================================================

# Step 1 — Start generation
POST /api/generate
Authorization: Bearer <token>
Body: { "breaks": [{ "day": 0, "period": 3 }, { "day": 1, "period": 3 }, ...] }
Response: { "job_id": "<uuid>" }

# Step 2 — Poll status every 2 seconds
GET /api/status/<job_id>
Response: {
  "job_id": "<uuid>",
  "status": "pending" | "running" | "done" | "failed",
  "started_at": "2026-01-01T00:00:00Z" | null,
  "finished_at": "2026-01-01T00:00:30Z" | null,
  "error": null | "error message",
  "generation_time_seconds": 28.4 | null
}

# Step 3 — Fetch result when status === "done"
GET /api/result/<job_id>
Response: {
  "timetable_id": "<uuid>",
  "fitness": 1240,
  "entries": [
    {
      "lesson_id": "<uuid>",
      "day": 0,             # 0=Mon … 4=Fri
      "start_period": 0,    # 0-indexed
      "duration": 1,
      "subject_id": "<uuid>",
      "subject_name": "Physics",
      "teacher_ids": ["<uuid>"],
      "class_ids": ["<uuid>"],
      "room_ids": ["<uuid>"]
    }
  ]
}

# NOTE: generation_time_seconds comes from status response, not result response
# Store it from the last status poll when status becomes "done"



--- ignore things below this.

# ============================================================
# 5. CONVERSIONS — CRITICAL
# ============================================================

# sessionType string → duration integer (before save)
const durationMap = { single: 1, double: 2, triple: 3 }
duration = durationMap[sessionType.type]

# duration integer → sessionType string (after bootstrap / for display)
const typeMap = { 1: 'single', 2: 'double', 3: 'triple' }
type = typeMap[session.duration]

# classroom.type string → is_lab boolean (before save)
is_lab = classroom.type === 'L'

# is_lab boolean → classroom.type string (after bootstrap / for display)
type = is_lab ? 'L' : 'R'

# subject.type string → is_difficult boolean (before save)
is_difficult = subject.type === 'hard'

# is_difficult boolean → subject.type string (after bootstrap / for display)
type = is_difficult ? 'hard' : 'medium'

# locked_start_period: UI is 1-indexed, backend is 0-indexed
# Save:    locked_start_period = uiPeriod - 1
# Display: uiPeriod = locked_start_period + 1

# breaks from settings → POST /api/generate body
# settings.breaks is already [{ day, period }] — send directly
