
QUERY TRUNCATED
-- ============================================================
-- TIMETABLE GENERATOR — PostgreSQL Schema (v4, Neon Auth)
-- ============================================================
-- Users are managed by Neon Auth (neon_auth.user schema).
-- user_id columns store Neon Auth user IDs as plain TEXT —
-- no FK constraint needed since Neon Auth manages lifecycle.
-- ============================================================

-- ── Drop everything cleanly ───────────────────────────────────

DROP TABLE IF EXISTS
    generation_jobs,
    lesson_rooms, lesson_classes, lesson_teachers,
    lesson_blocks, teacher_unavailable,
    teachers, subjects, rooms, classes
CASCADE;

-- ── Core entities (user-scoped) ───────────────────────────────

CREATE TABLE teachers (
    id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id    TEXT NOT NULL,
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
    user_id      TEXT    NOT NULL,
    name         TEXT    NOT NULL,
    is_difficult BOOLEAN NOT NULL DEFAULT false,
    is_lab       BOOLEAN NOT NULL DEFAULT false,
    priority     INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rooms (
    id         TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id    TEXT    NOT NULL,
    name       TEXT    NOT NULL,
    is_lab     BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE classes (
    id         TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id    TEXT    NOT NULL,
    name       TEXT    NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

