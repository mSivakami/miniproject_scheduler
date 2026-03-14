import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import { EntityTable } from "../components/EntityTable";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// ── tiny form helpers ────────────────────────────────────────────────────────

function TeacherForm({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [slots, setSlots] = useState([]);

  const addSlot = () => setSlots([...slots, { day: 0, period: 0 }]);
  const removeSlot = (i) => setSlots(slots.filter((_, idx) => idx !== i));
  const updateSlot = (i, field, val) =>
    setSlots(
      slots.map((s, idx) => (idx === i ? { ...s, [field]: Number(val) } : s)),
    );

  const submit = async () => {
    if (!name.trim()) return;
    await api.createTeacher({ name, unavailable_slots: slots });
    onSave();
    onClose();
  };

  return (
    <div className="form-grid">
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="slot-list">
        {slots.map((s, i) => (
          <span key={i} className="slot-row">
            <select
              value={s.day}
              onChange={(e) => updateSlot(i, "day", e.target.value)}
            >
              {DAYS.map((d, di) => (
                <option key={di} value={di}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={s.period}
              onChange={(e) => updateSlot(i, "period", e.target.value)}
            >
              {[...Array(7)].map((_, p) => (
                <option key={p} value={p}>
                  P{p + 1}
                </option>
              ))}
            </select>
            <button className="btn-del" onClick={() => removeSlot(i)}>
              ✕
            </button>
          </span>
        ))}
        <button className="btn-sm" onClick={addSlot}>
          + unavailable slot
        </button>
      </div>
      <button className="btn-primary" onClick={submit}>
        save
      </button>
    </div>
  );
}

function SubjectForm({ onSave, onClose }) {
  const [f, setF] = useState({
    name: "",
    is_difficult: false,
    is_lab: false,
    priority: 5,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!f.name.trim()) return;
    await api.createSubject(f);
    onSave();
    onClose();
  };
  return (
    <div className="form-grid">
      <input
        placeholder="Name"
        value={f.name}
        onChange={(e) => set("name", e.target.value)}
      />
      <span className="form-row">
        <label>
          <input
            type="checkbox"
            checked={f.is_difficult}
            onChange={(e) => set("is_difficult", e.target.checked)}
          />{" "}
          difficult
        </label>
        <label>
          <input
            type="checkbox"
            checked={f.is_lab}
            onChange={(e) => set("is_lab", e.target.checked)}
          />{" "}
          lab
        </label>
        <label>
          priority{" "}
          <input
            type="number"
            min={1}
            max={10}
            value={f.priority}
            onChange={(e) => set("priority", Number(e.target.value))}
            style={{ width: 42 }}
          />
        </label>
      </span>
      <button className="btn-primary" onClick={submit}>
        save
      </button>
    </div>
  );
}

function SimpleForm({ placeholder, onSave, onClose, buildPayload }) {
  const [name, setName] = useState("");
  const submit = async () => {
    if (!name.trim()) return;
    await onSave(buildPayload(name));
    onClose();
  };
  return (
    <div className="form-grid">
      <input
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="btn-primary" onClick={submit}>
        save
      </button>
    </div>
  );
}

function RoomForm({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [isLab, setIsLab] = useState(false);
  const submit = async () => {
    if (!name.trim()) return;
    await api.createRoom({ name, is_lab: isLab });
    onSave();
    onClose();
  };
  return (
    <div className="form-grid">
      <input
        placeholder="Room name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label>
        <input
          type="checkbox"
          checked={isLab}
          onChange={(e) => setIsLab(e.target.checked)}
        />{" "}
        is lab
      </label>
      <button className="btn-primary" onClick={submit}>
        save
      </button>
    </div>
  );
}

function LessonForm({ onSave, onClose, teachers, subjects, rooms, classes }) {
  const [f, setF] = useState({
    subject_id: "",
    teacher_ids: [],
    class_ids: [],
    room_ids: [],
    duration: 1,
    is_locked: false,
    locked_day: 0,
    locked_start_period: 0,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (k, id) =>
    setF((p) => ({
      ...p,
      [k]: p[k].includes(id) ? p[k].filter((x) => x !== id) : [...p[k], id],
    }));

  const submit = async () => {
    if (
      !f.subject_id ||
      !f.teacher_ids.length ||
      !f.class_ids.length ||
      !f.room_ids.length
    )
      return;
    const payload = { ...f };
    if (!f.is_locked) {
      payload.locked_day = null;
      payload.locked_start_period = null;
    }
    await api.createLesson(payload);
    onSave();
    onClose();
  };

  return (
    <div className="form-grid lesson-form">
      <label>
        Subject
        <select
          value={f.subject_id}
          onChange={(e) => set("subject_id", e.target.value)}
        >
          <option value="">— select —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Teachers
        <div className="check-group">
          {teachers.map((t) => (
            <label key={t.id} className="check-item">
              <input
                type="checkbox"
                checked={f.teacher_ids.includes(t.id)}
                onChange={() => toggle("teacher_ids", t.id)}
              />
              {t.name}
            </label>
          ))}
        </div>
      </label>

      <label>
        Classes
        <div className="check-group">
          {classes.map((c) => (
            <label key={c.id} className="check-item">
              <input
                type="checkbox"
                checked={f.class_ids.includes(c.id)}
                onChange={() => toggle("class_ids", c.id)}
              />
              {c.name}
            </label>
          ))}
        </div>
      </label>

      <label>
        Rooms
        <div className="check-group">
          {rooms.map((r) => (
            <label key={r.id} className="check-item">
              <input
                type="checkbox"
                checked={f.room_ids.includes(r.id)}
                onChange={() => toggle("room_ids", r.id)}
              />
              {r.name}
              {r.is_lab ? " (lab)" : ""}
            </label>
          ))}
        </div>
      </label>

      <span className="form-row">
        <label>
          Duration
          <select
            value={f.duration}
            onChange={(e) => set("duration", Number(e.target.value))}
          >
            {[1, 2, 3].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={f.is_locked}
            onChange={(e) => set("is_locked", e.target.checked)}
          />{" "}
          locked
        </label>
        {f.is_locked && (
          <>
            <select
              value={f.locked_day}
              onChange={(e) => set("locked_day", Number(e.target.value))}
            >
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={f.locked_start_period}
              onChange={(e) =>
                set("locked_start_period", Number(e.target.value))
              }
            >
              {[...Array(7)].map((_, p) => (
                <option key={p} value={p}>
                  P{p + 1}
                </option>
              ))}
            </select>
          </>
        )}
      </span>
      <button className="btn-primary" onClick={submit}>
        save
      </button>
    </div>
  );
}

function BreakForm({ onSave, onClose }) {
  const [day, setDay] = useState(0);
  const [period, setPeriod] = useState(3);
  const [name, setName] = useState("Lunch");
  const submit = async () => {
    await api.createBreak({ day, period, name });
    onSave();
    onClose();
  };
  return (
    <div className="form-grid">
      <span className="form-row">
        <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {DAYS.map((d, i) => (
            <option key={i} value={i}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
        >
          {[...Array(7)].map((_, p) => (
            <option key={p} value={p}>
              P{p + 1}
            </option>
          ))}
        </select>
        <input
          placeholder="Label"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: 90 }}
        />
      </span>
      <button className="btn-primary" onClick={submit}>
        save
      </button>
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export function DataPage() {
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [breaks, setBreaks] = useState([]);

  const reload = useCallback(async () => {
    const [t, su, ro, cl, le, br] = await Promise.all([
      api.getTeachers(),
      api.getSubjects(),
      api.getRooms(),
      api.getClasses(),
      api.getLessons(),
      api.getBreaks(),
    ]);
    setTeachers(t);
    setSubjects(su);
    setRooms(ro);
    setClasses(cl);
    setLessons(le);
    setBreaks(br);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const subjectName = (id) => subjects.find((s) => s.id === id)?.name ?? id;
  const teacherNames = (ids) =>
    ids.map((id) => teachers.find((t) => t.id === id)?.name ?? id).join(", ");
  const classNames = (ids) =>
    ids.map((id) => classes.find((c) => c.id === id)?.name ?? id).join(", ");
  const roomNames = (ids) =>
    ids.map((id) => rooms.find((r) => r.id === id)?.name ?? id).join(", ");

  return (
    <div className="data-page">
      <EntityTable
        title="Teachers"
        rows={teachers}
        columns={[
          { key: "name", label: "Name" },
          {
            key: "unavailable_slots",
            label: "Unavailable",
            render: (r) =>
              r.unavailable_slots
                .map((s) => `${DAYS[s.day]} P${s.period + 1}`)
                .join(", ") || "—",
          },
        ]}
        onDelete={async (id) => {
          await api.deleteTeacher(id);
          reload();
        }}
        addForm={(close) => <TeacherForm onSave={reload} onClose={close} />}
      />

      <EntityTable
        title="Subjects"
        rows={subjects}
        columns={[
          { key: "name", label: "Name" },
          { key: "priority", label: "Priority" },
          {
            key: "is_difficult",
            label: "Difficult",
            render: (r) => (r.is_difficult ? "yes" : "—"),
          },
          {
            key: "is_lab",
            label: "Lab",
            render: (r) => (r.is_lab ? "yes" : "—"),
          },
        ]}
        onDelete={async (id) => {
          await api.deleteSubject(id);
          reload();
        }}
        addForm={(close) => <SubjectForm onSave={reload} onClose={close} />}
      />

      <EntityTable
        title="Rooms"
        rows={rooms}
        columns={[
          { key: "name", label: "Name" },
          {
            key: "is_lab",
            label: "Lab",
            render: (r) => (r.is_lab ? "yes" : "—"),
          },
        ]}
        onDelete={async (id) => {
          await api.deleteRoom(id);
          reload();
        }}
        addForm={(close) => <RoomForm onSave={reload} onClose={close} />}
      />

      <EntityTable
        title="Classes"
        rows={classes}
        columns={[{ key: "name", label: "Name" }]}
        onDelete={async (id) => {
          await api.deleteClass(id);
          reload();
        }}
        addForm={(close) => (
          <SimpleForm
            placeholder="Class name"
            buildPayload={(name) => ({ name })}
            onSave={async (payload) => {
              await api.createClass(payload);
              reload();
            }}
            onClose={close}
          />
        )}
      />

      <EntityTable
        title="Lessons"
        rows={lessons}
        columns={[
          {
            key: "subject_id",
            label: "Subject",
            render: (r) => subjectName(r.subject_id),
          },
          {
            key: "teacher_ids",
            label: "Teachers",
            render: (r) => teacherNames(r.teacher_ids),
          },
          {
            key: "class_ids",
            label: "Classes",
            render: (r) => classNames(r.class_ids),
          },
          {
            key: "room_ids",
            label: "Rooms",
            render: (r) => roomNames(r.room_ids),
          },
          { key: "duration", label: "Dur" },
          {
            key: "is_locked",
            label: "Locked",
            render: (r) =>
              r.is_locked
                ? `${DAYS[r.locked_day]} P${r.locked_start_period + 1}`
                : "—",
          },
        ]}
        onDelete={async (id) => {
          await api.deleteLesson(id);
          reload();
        }}
        addForm={(close) => (
          <LessonForm
            onSave={reload}
            onClose={close}
            teachers={teachers}
            subjects={subjects}
            rooms={rooms}
            classes={classes}
          />
        )}
      />

      <EntityTable
        title="Breaks"
        rows={breaks.map((b) => ({ ...b, id: `${b.day}-${b.period}` }))}
        columns={[
          { key: "day", label: "Day", render: (r) => DAYS[r.day] },
          { key: "period", label: "Period", render: (r) => `P${r.period + 1}` },
          { key: "name", label: "Label" },
        ]}
        onDelete={async (id) => {
          const [day, period] = id.split("-").map(Number);
          await api.deleteBreak(day, period);
          reload();
        }}
        addForm={(close) => <BreakForm onSave={reload} onClose={close} />}
      />
    </div>
  );
}
