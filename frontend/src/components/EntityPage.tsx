// components/EntityPage.tsx
import { useState, ReactNode } from "react";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface Props<T extends { id: string }> {
  title: string;
  subtitle?: string;
  items: T[];
  columns: Column<T>[];
  renderForm: (item: T | null, onClose: () => void) => ReactNode;
  onDelete: (id: string) => void;
}

export function EntityPage<T extends { id: string }>({
  title,
  subtitle,
  items,
  columns,
  renderForm,
  onDelete,
}: Props<T>) {
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<T | null>(null);

  const openAdd = () => {
    setEditing(null);
    setModal("add");
  };
  const openEdit = (item: T) => {
    setEditing(item);
    setModal("edit");
  };
  const close = () => {
    setModal(null);
    setEditing(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{title}</div>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + Add {title.replace(/s$/, "")}
        </button>
      </div>

      <div className="page-body">
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◻</div>
            <div className="empty-state-text">
              No {title.toLowerCase()} yet — add one above
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  {columns.map((c) => (
                    <td key={c.key}>
                      {c.render
                        ? c.render(item)
                        : String((item as any)[c.key] ?? "—")}
                    </td>
                  ))}
                  <td>
                    <div className="actions">
                      <button
                        className="btn btn-sm"
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onDelete(item.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          {renderForm(editing, close)}
        </div>
      )}
    </div>
  );
}
