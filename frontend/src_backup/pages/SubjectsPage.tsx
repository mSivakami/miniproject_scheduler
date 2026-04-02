// pages/SubjectsPage.tsx
import { useState } from "react";
import { useAppStore, Subject } from "../store/useAppStore";
import { EntityPage } from "../components/EntityPage";

function SubjectForm({
  item,
  onClose,
}: {
  item: Subject | null;
  onClose: () => void;
}) {
  const { addSubject, updateSubject } = useAppStore();
  const [name, setName] = useState(item?.name ?? "");
  const [isDifficult, setDifficult] = useState(item?.is_difficult ?? false);
  const [isLab, setLab] = useState(item?.is_lab ?? false);
  const [priority, setPriority] = useState(item?.priority ?? 5);

  const save = () => {
    if (!name.trim()) return;
    const data = { name, is_difficult: isDifficult, is_lab: isLab, priority };
    item ? updateSubject(item.id, data) : addSubject(data);
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-title">
        📚 {item ? "Edit Subject" : "Add Subject"}
      </div>
      <div className="form-group">
        <label>Name</label>
        <input
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Subject name"
        />
      </div>
      <div className="form-group">
        <label>Priority (1 = highest)</label>
        <input
          className="form-input"
          type="number"
          min={1}
          max={10}
          value={priority}
          onChange={(e) => setPriority(+e.target.value)}
        />
      </div>
      <div className="form-row">
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={isDifficult}
            onChange={(e) => setDifficult(e.target.checked)}
          />
          Difficult subject
        </label>
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={isLab}
            onChange={(e) => setLab(e.target.checked)}
          />
          Lab subject
        </label>
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

export default function SubjectsPage() {
  const { subjects, deleteSubject } = useAppStore();
  return (
    <EntityPage
      title="Subjects"
      subtitle={`${subjects.length} configured`}
      items={subjects}
      columns={[
        { key: "name", label: "Name" },
        {
          key: "priority",
          label: "Priority",
          render: (s) => <span className="chip chip-blue">P{s.priority}</span>,
        },
        {
          key: "is_difficult",
          label: "Flags",
          render: (s) => (
            <div style={{ display: "flex", gap: 4 }}>
              {s.is_difficult && <span className="chip chip-red">HARD</span>}
              {s.is_lab && <span className="chip chip-amber">LAB</span>}
            </div>
          ),
        },
      ]}
      renderForm={(item, close) => (
        <SubjectForm item={item as Subject} onClose={close} />
      )}
      onDelete={deleteSubject}
    />
  );
}
