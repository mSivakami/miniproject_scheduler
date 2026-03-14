-- Run this once in your Neon SQL editor, or call GET /init-db after deploying.

CREATE TABLE IF NOT EXISTS teachers (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teacher_unavailable (
    teacher_id TEXT    REFERENCES teachers(id) ON DELETE CASCADE,
    day        INTEGER NOT NULL,
    period     INTEGER NOT NULL,
    PRIMARY KEY (teacher_id, day, period)
);

CREATE TABLE IF NOT EXISTS subjects (
    id           TEXT    PRIMARY KEY,
    name         TEXT    NOT NULL,
    is_difficult BOOLEAN DEFAULT FALSE,
    is_lab       BOOLEAN DEFAULT FALSE,
    priority     INTEGER DEFAULT 5
);

CREATE TABLE IF NOT EXISTS rooms (
    id     TEXT    PRIMARY KEY,
    name   TEXT    NOT NULL,
    is_lab BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS classes (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_blocks (
    id                  TEXT    PRIMARY KEY,
    subject_id          TEXT    REFERENCES subjects(id),
    duration            INTEGER DEFAULT 1,
    is_locked           BOOLEAN DEFAULT FALSE,
    locked_day          INTEGER,
    locked_start_period INTEGER
);

CREATE TABLE IF NOT EXISTS lesson_teachers (
    lesson_id  TEXT REFERENCES lesson_blocks(id) ON DELETE CASCADE,
    teacher_id TEXT REFERENCES teachers(id)      ON DELETE CASCADE,
    PRIMARY KEY (lesson_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS lesson_classes (
    lesson_id TEXT REFERENCES lesson_blocks(id) ON DELETE CASCADE,
    class_id  TEXT REFERENCES classes(id)       ON DELETE CASCADE,
    PRIMARY KEY (lesson_id, class_id)
);

CREATE TABLE IF NOT EXISTS lesson_rooms (
    lesson_id TEXT REFERENCES lesson_blocks(id) ON DELETE CASCADE,
    room_id   TEXT REFERENCES rooms(id)         ON DELETE CASCADE,
    PRIMARY KEY (lesson_id, room_id)
);

CREATE TABLE IF NOT EXISTS breaks (
    day    INTEGER NOT NULL,
    period INTEGER NOT NULL,
    name   TEXT    DEFAULT 'Break',
    PRIMARY KEY (day, period)
);