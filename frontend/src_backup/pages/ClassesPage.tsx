// pages/ClassesPage.tsx
import { useState } from "react";
import { useAppStore, Class } from "../store/useAppStore";
import { EntityPage } from "../components/EntityPage";

function ClassForm({
  item,
  onClose,
}: {
  item: Class | null;
  onClose: () => void;
}) {
  const { addClass, updateClass } = useAppStore();
  const [name, setName] = useState(item?.name ?? "");

  const save = () => {
    if (!name.trim()) return;
    item ? updateClass(item.id, { name }) : addClass({ name });
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-title">🎓 {item ? "Edit Class" : "Add Class"}</div>
      <div className="form-group">
        <label>Class Name</label>
        <input
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Grade 10A, S2B"
          autoFocus
        />
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

export default function ClassesPage() {
  const { classes, deleteClass } = useAppStore();
  return (
    <EntityPage
      title="Classes"
      subtitle={`${classes.length} configured`}
      items={classes}
      columns={[
        { key: "name", label: "Name" },
        {
          key: "id",
          label: "ID",
          render: (c) => (
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--text3)",
              }}
            >
              {c.id.startsWith("tmp_") ? "(unsaved)" : c.id.slice(0, 8) + "…"}
            </span>
          ),
        },
      ]}
      renderForm={(item, close) => (
        <ClassForm item={item as Class} onClose={close} />
      )}
      onDelete={deleteClass}
    />
  );
}
