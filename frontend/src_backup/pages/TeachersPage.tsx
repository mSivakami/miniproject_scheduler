// pages/TeachersPage.tsx
import { useState } from "react";
import { useAppStore, Teacher } from "../store/useAppStore";
import { EntityPage } from "../components/EntityPage";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

function TeacherForm({
  item,
  onClose,
}: {
  item: Teacher | null;
  onClose: () => void;
}) {
  const { addTeacher, updateTeacher } = useAppStore();
  const [name, setName] = useState(item?.name ?? "");
  const [unavail, setUnavail] = useState<Set<string>>(
    new Set((item?.unavailable_slots ?? []).map((s) => `${s.day}-${s.period}`)),
  );

  const toggle = (day: number, period: number) => {
    const key = `${day}-${period}`;
    setUnavail((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const save = () => {
    if (!name.trim()) return;
    const unavailable_slots = Array.from(unavail).map((k) => {
      const [d, p] = k.split("-").map(Number);
      return { day: d, period: p };
    });
    if (item) {
      updateTeacher(item.id, { name, unavailable_slots });
    } else {
      addTeacher({ name, unavailable_slots });
    }
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-title">
        👤 {item ? "Edit Teacher" : "Add Teacher"}
      </div>
      <div className="form-group">
        <label>Name</label>
        <input
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Teacher name"
        />
      </div>
      <div className="form-group">
        <label>Unavailable slots</label>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ fontSize: 11, borderCollapse: "collapse", width: "100%" }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    padding: "4px 8px",
                    color: "var(--text3)",
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                  }}
                ></th>
                {PERIODS.map((p) => (
                  <th
                    key={p}
                    style={{
                      padding: "4px 6px",
                      color: "var(--text3)",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                    }}
                  >
                    P{p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, di) => (
                <tr key={di}>
                  <td
                    style={{
                      padding: "3px 8px",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      color: "var(--text2)",
                    }}
                  >
                    {day}
                  </td>
                  {PERIODS.map((_, pi) => (
                    <td
                      key={pi}
                      style={{ padding: "3px 6px", textAlign: "center" }}
                    >
                      <input
                        type="checkbox"
                        checked={unavail.has(`${di}-${pi}`)}
                        onChange={() => toggle(di, pi)}
                        style={{ accentColor: "var(--red)", cursor: "pointer" }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}

export default function TeachersPage() {
  const { teachers, deleteTeacher } = useAppStore();
  return (
    <EntityPage
      title="Teachers"
      subtitle={`${teachers.length} configured`}
      items={teachers}
      columns={[
        { key: "name", label: "Name" },
        {
          key: "unavailable_slots",
          label: "Unavailable",
          render: (t) => (
            <span className="chip chip-gray">
              {t.unavailable_slots.length} slots
            </span>
          ),
        },
      ]}
      renderForm={(item, close) => (
        <TeacherForm item={item as Teacher} onClose={close} />
      )}
      onDelete={deleteTeacher}
    />
  );
}
