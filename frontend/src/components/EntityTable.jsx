import { useState } from "react";

export function EntityTable({
  title,
  columns,
  rows,
  onDelete,
  onAdd,
  addForm,
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="entity-block">
      <div className="entity-header">
        <span className="entity-title">{title}</span>
        <button className="btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "cancel" : "+ add"}
        </button>
      </div>

      {showForm && (
        <div className="add-form">{addForm(() => setShowForm(false))}</div>
      )}

      {rows.length === 0 ? (
        <p className="empty-note">no records yet</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
                ))}
                <td>
                  <button className="btn-del" onClick={() => onDelete(row.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
