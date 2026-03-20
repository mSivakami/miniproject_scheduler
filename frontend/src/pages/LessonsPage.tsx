// pages/LessonsPage.tsx
import { useState } from "react";
import { useAppStore, Lesson, SessionSpec } from "../store/useAppStore";
import { EntityPage } from "../components/EntityPage";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const totalPeriods = (sessions: SessionSpec[]) =>
  (sessions ?? []).reduce((sum, s) => sum + s.duration * s.count, 0);

// ── Multi-select ──────────────────────────────────────────────────────────────

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );

  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="multi-select">
        {options.length === 0 && (
          <span
            style={{ color: "var(--text3)", fontSize: 11, padding: "4px 6px" }}
          >
            No options — add some first
          </span>
        )}
        {options.map((o) => (
          <label key={o.id}>
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={() => toggle(o.id)}
            />
            {o.name}
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Session builder ───────────────────────────────────────────────────────────

function SessionBuilder({
  sessions,
  onChange,
}: {
  sessions: SessionSpec[];
  onChange: (s: SessionSpec[]) => void;
}) {
  const add = () => onChange([...sessions, { duration: 1, count: 1 }]);

  const remove = (i: number) =>
    onChange(sessions.filter((_, idx) => idx !== i));

  const update = (i: number, field: keyof SessionSpec, val: number) =>
    onChange(
      sessions.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)),
    );

  const total = totalPeriods(sessions);

  return (
    <div className="form-group">
      <label
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Weekly sessions</span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: total > 0 ? "var(--accent)" : "var(--text3)",
          }}
        >
          {total} periods / week
        </span>
      </label>

      <div
        style={{
          border: "1px solid var(--border2)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 60px 32px",
            gap: 8,
            padding: "6px 10px",
            background: "var(--bg3)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--text3)",
              letterSpacing: "0.06em",
            }}
          >
            SESSION TYPE
          </span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--text3)",
              letterSpacing: "0.06em",
            }}
          >
            COUNT / WK
          </span>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              color: "var(--text3)",
              letterSpacing: "0.06em",
            }}
          >
            TOTAL
          </span>
          <span />
        </div>

        {/* Session rows */}
        {sessions.length === 0 && (
          <div
            style={{
              padding: "12px 10px",
              color: "var(--text3)",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            No sessions — add one below
          </div>
        )}

        {sessions.map((sess, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 60px 32px",
              gap: 8,
              padding: "6px 10px",
              alignItems: "center",
              borderBottom:
                i < sessions.length - 1 ? "1px solid var(--border)" : "none",
              background: i % 2 === 0 ? "var(--bg2)" : "var(--bg3)",
            }}
          >
            {/* Duration select */}
            <select
              className="form-select"
              style={{ fontSize: 12, padding: "5px 8px" }}
              value={sess.duration}
              onChange={(e) =>
                update(i, "duration", +e.target.value as 1 | 2 | 3)
              }
            >
              <option value={1}>Single — 1 period</option>
              <option value={2}>Double — 2 periods</option>
              <option value={3}>Triple — 3 periods</option>
            </select>

            {/* Count input */}
            <input
              className="form-input"
              type="number"
              min={1}
              max={10}
              value={sess.count}
              onChange={(e) => update(i, "count", Math.max(1, +e.target.value))}
              style={{ fontSize: 12, padding: "5px 8px", textAlign: "center" }}
            />

            {/* Total periods display */}
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--accent)",
                textAlign: "center",
              }}
            >
              {sess.duration * sess.count}p
            </span>

            {/* Remove button */}
            <button
              className="btn btn-danger btn-icon btn-sm"
              onClick={() => remove(i)}
              disabled={sessions.length === 1}
              title="Remove"
              style={{ fontSize: 11 }}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Add row button */}
        <button
          onClick={add}
          style={{
            width: "100%",
            padding: "7px",
            background: "transparent",
            border: "none",
            borderTop:
              sessions.length > 0 ? "1px dashed var(--border2)" : "none",
            color: "var(--text3)",
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "var(--sans)",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text3)")}
        >
          + add session type
        </button>
      </div>
    </div>
  );
}

// ── Lesson form ───────────────────────────────────────────────────────────────

function LessonForm({
  item,
  onClose,
}: {
  item: Lesson | null;
  onClose: () => void;
}) {
  const { teachers, subjects, rooms, classes, addLesson, updateLesson } =
    useAppStore();

  const [subjectId, setSubjectId] = useState(item?.subject_id ?? "");
  const [teacherIds, setTeacherIds] = useState<string[]>(
    item?.teacher_ids ?? [],
  );
  const [classIds, setClassIds] = useState<string[]>(item?.class_ids ?? []);
  const [roomIds, setRoomIds] = useState<string[]>(item?.room_ids ?? []);
  const [sessions, setSessions] = useState<SessionSpec[]>(
    item?.sessions?.length ? item.sessions : [{ duration: 1, count: 1 }],
  );
  const [isLocked, setLocked] = useState(item?.is_locked ?? false);
  const [lockedDay, setLockedDay] = useState<number | "">(
    item?.locked_day ?? "",
  );
  const [lockedPeriod, setLockedPeriod] = useState<number | "">(
    item?.locked_start_period ?? "",
  );
  const [lockedDur, setLockedDur] = useState<number>(
    item?.locked_duration ?? 1,
  );

  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "";

  const save = () => {
    if (
      !subjectId ||
      teacherIds.length === 0 ||
      classIds.length === 0 ||
      roomIds.length === 0
    )
      return;
    if (!isLocked && sessions.length === 0) return;

    const data: Omit<Lesson, "id" | "total_periods"> = {
      subject_id: subjectId,
      teacher_ids: teacherIds,
      class_ids: classIds,
      room_ids: roomIds,
      sessions: isLocked ? [] : sessions,
      is_locked: isLocked,
      locked_day: isLocked && lockedDay !== "" ? Number(lockedDay) : null,
      locked_start_period:
        isLocked && lockedPeriod !== "" ? Number(lockedPeriod) : null,
      locked_duration: isLocked ? lockedDur : null,
    };

    item ? updateLesson(item.id, data) : addLesson(data);
    onClose();
  };

  const isValid =
    subjectId &&
    teacherIds.length > 0 &&
    classIds.length > 0 &&
    roomIds.length > 0 &&
    (isLocked || sessions.length > 0);

  return (
    <div className="modal" style={{ width: 560 }}>
      <div className="modal-title">
        📋 {item ? "Edit Lesson Block" : "Add Lesson Block"}
        {subjectName && (
          <span
            style={{
              fontWeight: 400,
              color: "var(--text2)",
              marginLeft: 8,
              fontSize: 12,
            }}
          >
            — {subjectName}
          </span>
        )}
      </div>

      {/* Subject */}
      <div className="form-group">
        <label>Subject</label>
        <select
          className="form-select"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          <option value="">— select subject —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Teachers / Classes / Rooms */}
      <MultiSelect
        label="Teachers"
        options={teachers}
        selected={teacherIds}
        onChange={setTeacherIds}
      />
      <MultiSelect
        label="Classes"
        options={classes}
        selected={classIds}
        onChange={setClassIds}
      />
      <MultiSelect
        label="Rooms"
        options={rooms}
        selected={roomIds}
        onChange={setRoomIds}
      />

      {/* Lock toggle */}
      <div className="form-group">
        <label className="form-checkbox" style={{ marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={isLocked}
            onChange={(e) => setLocked(e.target.checked)}
          />
          Lock to a fixed time slot
        </label>
      </div>

      {/* Locked fields */}
      {isLocked ? (
        <div className="form-row">
          <div className="form-group">
            <label>Day</label>
            <select
              className="form-select"
              value={lockedDay}
              onChange={(e) => setLockedDay(+e.target.value)}
            >
              <option value="">— day —</option>
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Start period (0–6)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              max={6}
              value={lockedPeriod}
              onChange={(e) => setLockedPeriod(+e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Duration</label>
            <select
              className="form-select"
              value={lockedDur}
              onChange={(e) => setLockedDur(+e.target.value)}
            >
              <option value={1}>Single (1)</option>
              <option value={2}>Double (2)</option>
              <option value={3}>Triple (3)</option>
            </select>
          </div>
        </div>
      ) : (
        /* Session builder — only shown for free lessons */
        <SessionBuilder sessions={sessions} onChange={setSessions} />
      )}

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save} disabled={!isValid}>
          {item ? "Update" : "Add"} Lesson
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LessonsPage() {
  const { lessons, subjects, teachers, classes, deleteLesson } = useAppStore();

  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t.name]));
  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));

  return (
    <EntityPage
      title="Lessons"
      subtitle={`${lessons.length} lesson blocks · ${lessons.reduce((s, l) => s + totalPeriods(l.sessions), 0)} total periods/week`}
      items={lessons}
      columns={[
        {
          key: "subject_id",
          label: "Subject",
          render: (l) => (
            <strong style={{ fontSize: 13 }}>
              {subjectMap[l.subject_id] ?? l.subject_id}
            </strong>
          ),
        },
        {
          key: "teacher_ids",
          label: "Teachers",
          render: (l) => (
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {l.teacher_ids.map((id) => (
                <span key={id} className="chip chip-gray">
                  {teacherMap[id] ?? id.slice(0, 6)}
                </span>
              ))}
            </div>
          ),
        },
        {
          key: "class_ids",
          label: "Classes",
          render: (l) => (
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {l.class_ids.map((id) => (
                <span key={id} className="chip chip-green">
                  {classMap[id] ?? id}
                </span>
              ))}
            </div>
          ),
        },
        {
          key: "sessions",
          label: "Schedule",
          render: (l) =>
            l.is_locked ? (
              <span className="chip chip-amber">
                LOCKED · {DAYS[l.locked_day!]} P
                {(l.locked_start_period ?? 0) + 1} ×{l.locked_duration}
              </span>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {l.sessions.map((s, i) => (
                  <span key={i} className="chip chip-blue">
                    {s.count}×{s.duration}p
                  </span>
                ))}
                <span className="chip chip-gray">
                  {totalPeriods(l.sessions)}p/wk
                </span>
              </div>
            ),
        },
      ]}
      renderForm={(item, close) => (
        <LessonForm item={item as Lesson} onClose={close} />
      )}
      onDelete={deleteLesson}
    />
  );
}
