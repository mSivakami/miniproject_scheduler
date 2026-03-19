// pages/LessonsPage.tsx
import { useState } from "react";
import { useAppStore, Lesson } from "../store/useAppStore";
import { EntityPage } from "../components/EntityPage";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

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
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  };
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
  const [duration, setDuration] = useState(item?.duration ?? 1);
  const [isLocked, setLocked] = useState(item?.is_locked ?? false);
  const [lockedDay, setLockedDay] = useState<number | "">(
    item?.locked_day ?? "",
  );
  const [lockedPeriod, setLockedPeriod] = useState<number | "">(
    item?.locked_start_period ?? "",
  );

  const save = () => {
    if (
      !subjectId ||
      teacherIds.length === 0 ||
      classIds.length === 0 ||
      roomIds.length === 0
    )
      return;
    const data: Omit<Lesson, "id"> = {
      subject_id: subjectId,
      teacher_ids: teacherIds,
      class_ids: classIds,
      room_ids: roomIds,
      duration,
      is_locked: isLocked,
      locked_day: isLocked && lockedDay !== "" ? Number(lockedDay) : null,
      locked_start_period:
        isLocked && lockedPeriod !== "" ? Number(lockedPeriod) : null,
    };
    item ? updateLesson(item.id, data) : addLesson(data);
    onClose();
  };

  const isValid =
    subjectId &&
    teacherIds.length > 0 &&
    classIds.length > 0 &&
    roomIds.length > 0;

  return (
    <div className="modal" style={{ width: 560 }}>
      <div className="modal-title">
        📋 {item ? "Edit Lesson Block" : "Add Lesson Block"}
      </div>

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

      <div className="form-row">
        <div className="form-group">
          <label>Duration (periods)</label>
          <select
            className="form-select"
            value={duration}
            onChange={(e) => setDuration(+e.target.value)}
          >
            <option value={1}>1 period</option>
            <option value={2}>2 periods (double)</option>
            <option value={3}>3 periods (triple)</option>
          </select>
        </div>
        <div
          className="form-group"
          style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}
        >
          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={isLocked}
              onChange={(e) => setLocked(e.target.checked)}
            />
            Lock to specific slot
          </label>
        </div>
      </div>

      {isLocked && (
        <div className="form-row" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label>Locked Day</label>
            <select
              className="form-select"
              value={lockedDay}
              onChange={(e) =>
                setLockedDay(e.target.value === "" ? "" : +e.target.value)
              }
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
            <label>Locked Period (0-indexed)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              max={6}
              value={lockedPeriod}
              onChange={(e) =>
                setLockedPeriod(e.target.value === "" ? "" : +e.target.value)
              }
              placeholder="0–6"
            />
          </div>
        </div>
      )}

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

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save} disabled={!isValid}>
          Save
        </button>
      </div>
    </div>
  );
}

export default function LessonsPage() {
  const { lessons, subjects, teachers, classes, rooms, deleteLesson } =
    useAppStore();

  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t.name]));
  const classMap = Object.fromEntries(classes.map((c) => [c.id, c.name]));

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  return (
    <EntityPage
      title="Lessons"
      subtitle={`${lessons.length} lesson blocks`}
      items={lessons}
      columns={[
        {
          key: "subject_id",
          label: "Subject",
          render: (l) => (
            <strong>{subjectMap[l.subject_id] ?? l.subject_id}</strong>
          ),
        },
        {
          key: "duration",
          label: "Duration",
          render: (l) => <span className="chip chip-blue">{l.duration}×</span>,
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
                  {classMap[id] ?? id.slice(0, 6)}
                </span>
              ))}
            </div>
          ),
        },
        {
          key: "is_locked",
          label: "Locked",
          render: (l) =>
            l.is_locked ? (
              <span className="chip chip-amber">
                {DAYS[l.locked_day!]} P{(l.locked_start_period ?? 0) + 1}
              </span>
            ) : (
              <span className="chip chip-gray">FREE</span>
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
