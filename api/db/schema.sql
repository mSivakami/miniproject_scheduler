-- ============================================================
-- TIMETABLE GENERATOR — PostgreSQL Schema (v2)
-- Drop all tables and run this fresh in Neon SQL Editor
-- ============================================================

-- ── Drop everything cleanly first ────────────────────────────

DROP TABLE IF EXISTS
    timetable_entries, timetables, generation_jobs,
    lesson_rooms, lesson_classes, lesson_teachers,
    lesson_blocks, teacher_unavailable,
    teachers, subjects, rooms, classes
CASCADE;

-- ── Core entities ─────────────────────────────────────────────

CREATE TABLE teachers (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE teacher_unavailable (
    teacher_id TEXT    NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    day        INTEGER NOT NULL CHECK (day BETWEEN 0 AND 4),
    period     INTEGER NOT NULL CHECK (period BETWEEN 0 AND 6),
    PRIMARY KEY (teacher_id, day, period)
);

CREATE TABLE subjects (
    id           TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name         TEXT    NOT NULL,
    is_difficult BOOLEAN NOT NULL DEFAULT false,
    is_lab       BOOLEAN NOT NULL DEFAULT false,
    priority     INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rooms (
    id         TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name       TEXT    NOT NULL,
    is_lab     BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE classes (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Lesson blocks ─────────────────────────────────────────────
--
-- One row = one unique subject / teacher / class / room combo.
--
-- FREE lessons use sessions JSONB:
--   [{"duration": 1, "count": 3}, {"duration": 2, "count": 1}]
--   means: 3 single-period + 1 double-period slots per week
--   The mapper explodes this into individual GA LessonBlock objects.
--
-- LOCKED lessons use is_locked + locked_day + locked_start_period + locked_duration.
--   sessions = [] for locked lessons.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE lesson_blocks (
    id                  TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subject_id          TEXT    NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    sessions            JSONB   NOT NULL DEFAULT '[]',
    is_locked           BOOLEAN NOT NULL DEFAULT false,
    locked_day          INTEGER CHECK (locked_day BETWEEN 0 AND 4),
    locked_start_period INTEGER CHECK (locked_start_period BETWEEN 0 AND 6),
    locked_duration     INTEGER CHECK (locked_duration BETWEEN 1 AND 3) DEFAULT 1,
    created_at          TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT locked_fields_required CHECK (
        (is_locked = false) OR
        (is_locked = true AND locked_day IS NOT NULL AND locked_start_period IS NOT NULL)
    )
);

CREATE TABLE lesson_teachers (
    lesson_id  TEXT NOT NULL REFERENCES lesson_blocks(id) ON DELETE CASCADE,
    teacher_id TEXT NOT NULL REFERENCES teachers(id)      ON DELETE RESTRICT,
    PRIMARY KEY (lesson_id, teacher_id)
);

CREATE TABLE lesson_classes (
    lesson_id TEXT NOT NULL REFERENCES lesson_blocks(id) ON DELETE CASCADE,
    class_id  TEXT NOT NULL REFERENCES classes(id)       ON DELETE RESTRICT,
    PRIMARY KEY (lesson_id, class_id)
);

CREATE TABLE lesson_rooms (
    lesson_id TEXT NOT NULL REFERENCES lesson_blocks(id) ON DELETE CASCADE,
    room_id   TEXT NOT NULL REFERENCES rooms(id)         ON DELETE RESTRICT,
    PRIMARY KEY (lesson_id, room_id)
);

-- ── Generation jobs ───────────────────────────────────────────

CREATE TABLE generation_jobs (
    id                      TEXT  PRIMARY KEY DEFAULT gen_random_uuid()::text,
    status                  TEXT  NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','running','done','failed')),
    started_at              TIMESTAMPTZ,
    finished_at             TIMESTAMPTZ,
    error                   TEXT,
    generation_time_seconds FLOAT,
    created_at              TIMESTAMPTZ DEFAULT now()
);

-- ── Timetable results ─────────────────────────────────────────

CREATE TABLE timetables (
    id         TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
    job_id     TEXT    NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
    fitness    INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE timetable_entries (
    id           TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
    timetable_id TEXT    NOT NULL REFERENCES timetables(id)     ON DELETE CASCADE,
    lesson_id    TEXT    NOT NULL REFERENCES lesson_blocks(id)  ON DELETE CASCADE,
    day          INTEGER NOT NULL CHECK (day BETWEEN 0 AND 4),
    start_period INTEGER NOT NULL CHECK (start_period BETWEEN 0 AND 6),
    duration     INTEGER NOT NULL CHECK (duration BETWEEN 1 AND 3)
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX idx_lesson_teachers_lesson ON lesson_teachers(lesson_id);
CREATE INDEX idx_lesson_classes_lesson  ON lesson_classes(lesson_id);
CREATE INDEX idx_lesson_rooms_lesson    ON lesson_rooms(lesson_id);
CREATE INDEX idx_timetable_entries_tt   ON timetable_entries(timetable_id);
CREATE INDEX idx_timetable_entries_day  ON timetable_entries(day, start_period);
CREATE INDEX idx_jobs_status            ON generation_jobs(status);

-- ── Done ──────────────────────────────────────────────────────
-- Tables: teachers, teacher_unavailable, subjects, rooms,
--         classes, lesson_blocks, lesson_teachers, lesson_classes,
--         lesson_rooms, generation_jobs, timetables, timetable_entries