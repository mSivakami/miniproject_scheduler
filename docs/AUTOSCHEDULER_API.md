# AutoScheduler API — Frontend Reference

**Base URL:** `http://localhost:8000`  
**All data endpoints prefixed with `/api/`**  
**Content-Type:** `application/json`

---

## Authentication

All `/api/*` routes require a JWT Bearer token.  
Auth routes (`/auth/*`) and the health check (`/api/health`) are public.

### Boot flow

```
POST /auth/setup   (first run only — creates the admin account)
POST /auth/login   (all subsequent runs — returns a fresh token)
GET  /auth/me      (verify token / get current user)
```

Include the token in every API request:

```
Authorization: Bearer <access_token>
```

A `401 Unauthorized` response means the token is missing, expired, or invalid.  
Redirect the user to the login screen when this occurs.

---

## Quick Reference

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/auth/setup` | ✗ | First-time admin account creation |
| POST | `/auth/login` | ✗ | Login — returns JWT |
| GET | `/auth/me` | ✓ | Current user info |
| GET | `/api/health` | ✗ | Health check |
| GET | `/api/data` | ✓ | Load institution data (main or mini-group) |
| POST | `/api/data` | ✓ | Sync/save institution data (main or mini-group) |
| GET | `/api/mini-groups` | ✓ | List mini-groups |
| POST | `/api/mini-groups` | ✓ | Create mini-group |
| PUT | `/api/mini-groups/{id}` | ✓ | Update mini-group |
| DELETE | `/api/mini-groups/{id}` | ✓ | Delete mini-group |
| POST | `/api/generate/main` | ✓ | Run GA for main timetable |
| POST | `/api/generate/mini/{group_id}` | ✓ | Run GA for mini-group |
| POST | `/api/generate/preflight/main` | ✓ | Validate main schedule config |
| GET | `/api/timetables` | ✓ | List saved timetables |
| GET | `/api/timetables/{id}` | ✓ | Get timetable with full JSON |
| POST | `/api/timetables` | ✓ | Save a timetable |
| PUT | `/api/timetables/{id}/name` | ✓ | Rename a timetable |
| DELETE | `/api/timetables/{id}` | ✓ | Delete a timetable |

---

## Core Concepts

- **Institution** — singleton config (auto-created). Holds schedule grid settings.
- **Classroom** — a student class/section (e.g. "Sem 2A"). NOT a physical room.
- **Room** — a physical room or lab.
- **LessonBlock** — one schedulable event: links teachers + subjects + classrooms + rooms, with frequency/duration.
- **MiniGroup** — an alternate schedule slot (max 2). Has its own lesson blocks and settings.
- All IDs are UUIDs (strings). Client may provide its own IDs on create.

---

## 1. Auth — `/auth`

### `POST /auth/setup`

First-time setup. Creates the single admin account. Returns `409` if an account already exists.

**Request:**
```json
{ "username": "admin", "password": "yourpassword" }
```

**Response: `201 Created`**
```json
{ "access_token": "<jwt>", "token_type": "bearer", "username": "admin" }
```

**Errors:**
- `400` — username < 3 chars or password < 6 chars
- `409` — account already exists, use `/auth/login`

---

### `POST /auth/login`

**Request:**
```json
{ "username": "admin", "password": "yourpassword" }
```

**Response:**
```json
{ "access_token": "<jwt>", "token_type": "bearer", "username": "admin" }
```

**Errors:**
- `401` — incorrect username or password

---

### `GET /auth/me`

Requires `Authorization: Bearer <token>`.

**Response:**
```json
{ "id": "uuid", "username": "admin", "created_at": "2026-04-01T10:00:00" }
```

---

## 2. Data Sync — `/api/data`

This is the **primary integration point**. Load everything on app start; send everything back on save.

Both GET and POST accept an optional `?mini_group_id=<uuid>` query parameter that scopes
the `lesson_blocks` and `constraint_settings` to a specific mini-group.
If omitted (default), only main blocks (`mini_group_id == null`) are included.

Core entities — teachers, subjects, rooms, classrooms — are **always returned and synced institution-wide** regardless of the query param.

### `GET /api/data`

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `mini_group_id` | string (UUID) | `null` | If set, returns lesson blocks for this mini-group instead of main blocks. |

**Response: `AllDataOut`**
```json
{
  "institution": {
    "id": "uuid",
    "name": "My Institution",
    "days_per_week": 5,
    "periods_per_day": 7,
    "break_after_period": 3,
    "break_mask": 0,
    "working_slot_mask": 0
  },
  "teachers": [ ... ],
  "subjects": [ ... ],
  "rooms": [ ... ],
  "classrooms": [ ... ],
  "lesson_blocks": [ ... ],
  "constraint_settings": { ... } | null
}
```

---

### `POST /api/data`

Full upsert sync for a given scope. Send the **entire current state** for the scope.
Missing entities within the scope are **deleted**, existing are **updated**, new are **inserted**.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `mini_group_id` | string (UUID) | `null` | Scope lesson block sync to a specific mini-group. Omit to sync main blocks. |

**Request Body: `AllDataSave`** — all fields optional, send only what changed.
```json
{
  "institution": {
    "name": "My College",
    "days_per_week": 5,
    "periods_per_day": 7,
    "break_after_period": 3
  },
  "teachers": [ /* array of TeacherCreate */ ],
  "subjects":  [ /* array of SubjectCreate */ ],
  "rooms":     [ /* array of RoomCreate */ ],
  "classrooms":[ /* array of ClassroomCreate */ ],
  "lesson_blocks": [ /* array of LessonBlockCreate */ ],
  "constraint_settings": {
    "settings_json": "{}",
    "is_active": true
  }
}
```

**Returns:** Same `AllDataOut` as GET (refreshed state for the same scope).

> **Mini-group lesson blocks:** To save blocks for a mini-group, POST to  
> `/api/data?mini_group_id=<uuid>`. The server enforces the scope server-side —  
> the `mini_group_id` field on individual `LessonBlockCreate` items is ignored.

#### Entity shapes for POST body:

**Teacher**
```json
{ "id": "uuid (optional)", "name": "Alice", "short_name": "ALC",
  "available_mask": -1, "max_per_day": 6, "max_per_week": 30 }
```

**Subject**
```json
{ "id": "uuid (optional)", "name": "Physics", "short_name": "PHY",
  "is_difficult": false, "is_lab": false, "priority": 1 }
```

**Room**
```json
{ "id": "uuid (optional)", "name": "Room 101", "is_lab": false, "available_mask": -1 }
```

**Classroom** (student class, not physical room)
```json
{ "id": "uuid (optional)", "name": "10-A", "capacity": 40 }
```

**LessonBlock**
```json
{
  "id": "uuid (optional)",
  "teacher_ids": ["uuid"],
  "subject_ids": ["uuid"],
  "classroom_ids": ["uuid"],
  "room_ids": [],
  "duration": 1,
  "count": 3,
  "is_locked": false,
  "locked_day": 0,
  "locked_period": 0,
  "is_lab": false,
  "is_difficult": false,
  "subject_name": "Physics"
}
```
> `duration`: 1=single, 2=double, 3=triple period block  
> `count`: times per week this block must appear  
> `locked_day` / `locked_period`: 0-indexed; only used when `is_locked: true`  
> `mini_group_id` on individual blocks is **ignored** — use the query param to set scope

---

## 3. Generate — `/api/generate`

**Blocks until complete** (3–15 sec). No polling needed.

### `POST /api/generate/main`
Run GA for the main institution timetable.

**Request Body** (all optional, shown with defaults):
```json
{
  "max_generations": 2000,
  "population_size": 300,
  "time_limit_seconds": 120,
  "seed": null,
  "fast_mode": false
}
```

**Response: `GenerateResponse`**
```json
{
  "status": "optimal",
  "fitness": 0.987,
  "quality_pct": 98.7,
  "hard_violations": 0,
  "soft_violations": 2,
  "generations": 450,
  "time_ms": 4200,
  "violation_details": [
    { "type": "soft", "description": "Teacher gap on day 2", "block_id": "uuid" }
  ],
  "timetable": { /* full grid object — save this as timetable_json */ }
}
```

> `status` values: `"optimal"` | `"max_generations"` | `"stagnation"` | `"time_limit"`

**Errors:**
- `400` — No lesson blocks / teachers / classrooms configured
- `500` — GA engine error (message in detail)

---

### `POST /api/generate/mini/{group_id}`
Same as above but runs for a specific mini-group. Uses mini-group's own lesson blocks and schedule settings.

---

### `POST /api/generate/preflight/main`

Validates configuration without running the GA. Returns feasibility status and any errors/warnings.

**Response:**
```json
{
  "feasible": true,
  "errors": [],
  "warnings": ["Teacher Alice has no availability on Friday"]
}
```

---

## 4. Mini-Groups — `/api/mini-groups`

Max **2 mini-groups** per institution.

### `GET /api/mini-groups`
Returns list of mini-groups.

### `POST /api/mini-groups`
```json
{
  "id": "uuid (optional)",
  "name": "Evening Batch",
  "slot_index": 1,
  "days_per_week": 5,
  "periods_per_day": 7,
  "break_after_period": 3
}
```

### `PUT /api/mini-groups/{group_id}`
Same body as POST.

### `DELETE /api/mini-groups/{group_id}`
Returns `{ "message": "Deleted" }`

**MiniGroup response shape:**
```json
{
  "id": "uuid",
  "institution_id": "uuid",
  "name": "Evening Batch",
  "slot_index": 1,
  "days_per_week": 5,
  "periods_per_day": 7,
  "break_after_period": 3,
  "break_mask": 0,
  "working_slot_mask": 0
}
```

---

## 5. Timetables — `/api/timetables`

Max **5 saved timetables** per institution.

### `GET /api/timetables`
List all saved timetables (no `timetable_json`, summary only).

**Response item:**
```json
{
  "id": "uuid",
  "institution_id": "uuid",
  "name": "Week 1 Schedule",
  "fitness_score": 0.987,
  "hard_violations": 0,
  "soft_violations": 2,
  "created_at": "2026-03-30T10:00:00"
}
```

### `GET /api/timetables/{id}`
Same as above + `timetable_json: string` (full grid JSON).

### `POST /api/timetables`
Save a generated timetable. Pass the `timetable` field from `GenerateResponse` as a JSON string.
```json
{
  "name": "My Best Schedule",
  "timetable_json": "{...stringified timetable object...}",
  "fitness_score": 0.987,
  "hard_violations": 0,
  "soft_violations": 2
}
```
- `400` if 5 already saved.

### `PUT /api/timetables/{id}/name?name=NewName`
Query param `name`. Returns `{ "message": "Renamed", "name": "NewName" }`.

### `DELETE /api/timetables/{id}`
Returns `{ "message": "Deleted" }`.

---

## 6. Health

### `GET /api/health`
```json
{ "status": "ok", "service": "AutoScheduler API" }
```

---

## Notes for Frontend

### Polling
**No polling needed.** `POST /api/generate/main` and `POST /api/generate/mini/{id}` block until
the GA finishes and return the full result directly. Typical time: 3–15 seconds.
Show a loading spinner; no status-check loop required.

### Typical flow
```
1. GET  /api/health           — verify backend is up
2. GET  /auth/me              — check if token is valid (or POST /auth/login)
3. GET  /api/data             — load main store
4. (user edits)
5. POST /api/data             — persist changes
6. POST /api/generate/main    — run GA
7. POST /api/timetables       — save result
```

For mini-group flows, substitute `GET /api/data?mini_group_id=<uuid>` and
`POST /api/data?mini_group_id=<uuid>` at steps 3 and 5, and use
`POST /api/generate/mini/<uuid>` at step 6.

### Bitmasks
`available_mask`, `break_mask`, `working_slot_mask` are bitmask integers.
`-1` means all slots available. These are computed server-side; send `-1` as default,
never compute manually.

### Constraint settings `settings_json`
Opaque JSON string. Store and return as-is; GA engine interprets it.

### Environment variable
Set `JWT_SECRET` in the environment to a strong random string before production use.
The default value is intentionally weak and for local development only.
