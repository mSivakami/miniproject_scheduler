import { useState, useEffect, useRef } from "react";

const API = "http://localhost:8000";
const CATEGORIES = ["General", "Work", "Personal", "Ideas", "Archive"];

// ── API layer ─────────────────────────────────────────────────────────────────
async function apiFetch(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = (msg, type = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  };
  return { toasts, push };
}
function Toast({ toasts }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        right: 28,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 999,
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.type === "success" ? "✓" : "✕"}</span> {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Connection Banner ─────────────────────────────────────────────────────────
function ConnectionBanner({ status }) {
  if (status === "ok") return null;
  const checking = status === "checking";
  return (
    <div
      style={{
        background: checking ? "#fef9ec" : "#fff0f0",
        borderBottom: `2px solid ${checking ? "#f0c040" : "#e05050"}`,
        padding: "10px 32px",
        fontFamily: "'Outfit',sans-serif",
        fontSize: 13,
        color: checking ? "#7a5c00" : "#a02020",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {checking ? (
        <>
          <span className="spinner-sm" /> Connecting to backend at {API}…
        </>
      ) : (
        <>
          ⚠ Cannot reach backend at{" "}
          <code
            style={{ background: "#fdd", padding: "1px 6px", borderRadius: 4 }}
          >
            {API}
          </code>
          — run:{" "}
          <code
            style={{ background: "#fdd", padding: "1px 6px", borderRadius: 4 }}
          >
            uvicorn main:app --reload
          </code>
        </>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const CAT_COLORS = {
  General: "#c2a96e",
  Work: "#7eb8c9",
  Personal: "#c97ea8",
  Ideas: "#82c97e",
  Archive: "#aaaaaa",
};
function CategoryPill({ cat }) {
  return (
    <span
      style={{
        background: CAT_COLORS[cat] || "#c2a96e",
        color: "#1a1208",
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "'Outfit',sans-serif",
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}
    >
      {cat}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="card" style={{ gap: 12 }}>
      <div
        className="skel"
        style={{ width: 70, height: 20, borderRadius: 20 }}
      />
      <div className="skel" style={{ width: "80%", height: 22 }} />
      <div className="skel" style={{ width: "60%", height: 14 }} />
      <div
        style={{
          marginTop: "auto",
          paddingTop: 14,
          borderTop: "1px solid #e8dfc8",
          display: "flex",
          gap: 8,
        }}
      >
        <div
          className="skel"
          style={{ width: 52, height: 32, borderRadius: 8 }}
        />
        <div
          className="skel"
          style={{ width: 52, height: 32, borderRadius: 8 }}
        />
      </div>
    </div>
  );
}

// ── Item Card ─────────────────────────────────────────────────────────────────
function ItemCard({ item, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const date = new Date(item.created_at * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 10,
        }}
      >
        <CategoryPill cat={item.category} />
        <span
          style={{
            fontSize: 11,
            color: "#9a8a6a",
            fontFamily: "'Outfit',sans-serif",
          }}
        >
          {date}
        </span>
      </div>
      <h3
        style={{
          margin: "0 0 6px",
          fontSize: 18,
          color: "#1a1208",
          fontFamily: "'Playfair Display',serif",
          lineHeight: 1.3,
        }}
      >
        {item.name}
      </h3>
      {item.note && (
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 13,
            color: "#6a5a3a",
            lineHeight: 1.6,
            fontFamily: "'Outfit',sans-serif",
          }}
        >
          {item.note}
        </p>
      )}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: "auto",
          paddingTop: 14,
          borderTop: "1px solid #e8dfc8",
        }}
      >
        <button className="btn btn-ghost" onClick={() => onEdit(item)}>
          Edit
        </button>
        {confirming ? (
          <button className="btn btn-danger" onClick={() => onDelete(item.id)}>
            Confirm?
          </button>
        ) : (
          <button
            className="btn btn-ghost"
            style={{ color: "#c0392b" }}
            onClick={() => {
              setConfirming(true);
              setTimeout(() => setConfirming(false), 3000);
            }}
          >
            Delete
          </button>
        )}
        <code
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "#b8a880",
            alignSelf: "center",
          }}
        >
          #{item.id}
        </code>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ editing, onClose, onSave, saving }) {
  const [name, setName] = useState(editing?.name || "");
  const [category, setCategory] = useState(editing?.category || "General");
  const [note, setNote] = useState(editing?.note || "");
  const nameRef = useRef();

  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 80);
  }, []);
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const handle = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), category, note: note.trim() });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "'Playfair Display',serif",
              fontSize: 24,
              color: "#1a1208",
            }}
          >
            {editing ? "Edit item" : "New item"}
          </h2>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ fontSize: 16, padding: "4px 10px" }}
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={handle}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <label className="field">
            <span className="label">Name *</span>
            <input
              ref={nameRef}
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name…"
              required
            />
          </label>
          <label className="field">
            <span className="label">Category</span>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Note</span>
            <textarea
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note…"
              rows={3}
              style={{ resize: "vertical" }}
            />
          </label>
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: 8,
            }}
          >
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [items, setItems] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connStatus, setConnStatus] = useState("checking");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("All");
  const { toasts, push } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/items`);
        if (!res.ok) throw new Error("bad response");
        setConnStatus("ok");
        setItems(await res.json());
      } catch {
        setConnStatus("error");
        push("Cannot reach backend — is FastAPI running?", "error");
      } finally {
        setInitialLoad(false);
      }
    })();
  }, []);

  const reload = async () => {
    try {
      const data = await apiFetch("GET", "/items");
      setItems(data);
      setConnStatus("ok");
    } catch (e) {
      push(e.message, "error");
    }
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editing) {
        const updated = await apiFetch("PUT", `/items/${editing.id}`, payload);
        setItems((p) => p.map((i) => (i.id === updated.id ? updated : i)));
        push(`"${updated.name}" updated`);
      } else {
        const created = await apiFetch("POST", "/items", payload);
        setItems((p) => [created, ...p]);
        push(`"${created.name}" created`);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      push(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiFetch("DELETE", `/items/${id}`);
      setItems((p) => p.filter((i) => i.id !== id));
      push("Item deleted");
    } catch (e) {
      push(e.message, "error");
    }
  };

  const allCats = ["All", ...CATEGORIES];
  const visible =
    filter === "All" ? items : items.filter((i) => i.category === filter);

  return (
    <div className="app">
      <ConnectionBanner status={connStatus} />
      <header className="header">
        <div className="header-inner">
          <div>
            <h1 className="wordmark">Fieldnotes</h1>
            <p className="tagline">FastAPI · React · CRUD</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn btn-ghost" onClick={reload}>
              ↺ Refresh
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              disabled={connStatus === "error"}
            >
              + New item
            </button>
          </div>
        </div>
        <div className="filter-bar">
          {allCats.map((c) => (
            <button
              key={c}
              className={`filter-tab ${filter === c ? "active" : ""}`}
              onClick={() => setFilter(c)}
            >
              {c}{" "}
              <span className="filter-count">
                {c === "All"
                  ? items.length
                  : items.filter((i) => i.category === c).length}
              </span>
            </button>
          ))}
        </div>
      </header>

      <main className="main">
        {initialLoad ? (
          <div className="grid">
            {[1, 2, 3].map((n) => (
              <SkeletonCard key={n} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <p
              style={{
                fontFamily: "'Playfair Display',serif",
                fontSize: 22,
                color: "#9a8a6a",
                margin: 0,
              }}
            >
              Nothing here yet.
            </p>
            <p style={{ color: "#b8a880", fontSize: 14, margin: "8px 0 0" }}>
              {filter === "All"
                ? "Create your first item above."
                : `No "${filter}" items.`}
            </p>
          </div>
        ) : (
          <div className="grid">
            {visible.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onEdit={(i) => {
                  setEditing(i);
                  setModalOpen(true);
                }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {modalOpen && (
        <Modal
          editing={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
          saving={saving}
        />
      )}
      <Toast toasts={toasts} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#f5efe0;min-height:100vh;}
        .app{min-height:100vh;background:radial-gradient(ellipse 80% 50% at 20% -10%,#e8d5a3 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 110%,#d4c49a 0%,transparent 60%),#f5efe0;}
        .header{background:rgba(245,239,224,0.88);backdrop-filter:blur(12px);border-bottom:1.5px solid #e0d4b4;position:sticky;top:0;z-index:100;}
        .header-inner{max-width:1100px;margin:0 auto;padding:22px 32px 0;display:flex;justify-content:space-between;align-items:flex-start;}
        .wordmark{font-family:'Playfair Display',serif;font-size:30px;font-weight:700;color:#1a1208;letter-spacing:-0.5px;}
        .tagline{font-family:'Outfit',sans-serif;font-size:11px;color:#9a8a6a;letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
        .filter-bar{max-width:1100px;margin:0 auto;padding:14px 32px 0;display:flex;gap:2px;overflow-x:auto;}
        .filter-tab{font-family:'Outfit',sans-serif;font-size:13px;font-weight:500;background:none;border:none;cursor:pointer;color:#9a8a6a;padding:8px 14px;border-bottom:2px solid transparent;white-space:nowrap;transition:all 0.18s;display:flex;align-items:center;gap:6px;}
        .filter-tab:hover{color:#1a1208;}
        .filter-tab.active{color:#1a1208;border-bottom-color:#c2a96e;font-weight:600;}
        .filter-count{background:#e0d4b4;color:#6a5a3a;font-size:10px;font-weight:700;padding:1px 6px;border-radius:20px;}
        .filter-tab.active .filter-count{background:#c2a96e;color:#1a1208;}
        .main{max-width:1100px;margin:0 auto;padding:36px 32px;}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:18px;}
        .card{background:#fffdf5;border:1.5px solid #e8dfc8;border-radius:12px;padding:20px;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(100,80,30,0.06);animation:fadeUp 0.28s ease both;transition:transform 0.2s,box-shadow 0.2s;}
        .card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(100,80,30,0.12);}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .skel{background:linear-gradient(90deg,#ede4cc 25%,#f5efe0 50%,#ede4cc 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:4px;}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .empty-state{text-align:center;padding:80px 20px;display:flex;flex-direction:column;align-items:center;}
        .btn{font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;border:none;border-radius:8px;cursor:pointer;padding:9px 18px;transition:all 0.15s;letter-spacing:0.2px;}
        .btn:disabled{opacity:0.45;cursor:not-allowed;}
        .btn-primary{background:#1a1208;color:#f5efe0;}
        .btn-primary:hover:not(:disabled){background:#3a2a18;transform:translateY(-1px);}
        .btn-ghost{background:#f0e8d4;color:#4a3a1a;}
        .btn-ghost:hover{background:#e8dfc8;}
        .btn-danger{background:#c0392b;color:#fff;animation:shake 0.3s ease;}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
        .modal-backdrop{position:fixed;inset:0;background:rgba(26,18,8,0.45);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:500;animation:fadeIn 0.18s ease;}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .modal{background:#fffdf5;border:1.5px solid #e8dfc8;border-radius:16px;padding:32px;width:min(480px,92vw);box-shadow:0 24px 64px rgba(26,18,8,0.18);animation:slideUp 0.22s ease;}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}
        .field{display:flex;flex-direction:column;gap:6px;}
        .label{font-family:'Outfit',sans-serif;font-size:11px;font-weight:600;color:#9a8a6a;text-transform:uppercase;letter-spacing:1px;}
        .input{font-family:'Outfit',sans-serif;font-size:14px;background:#f5efe0;border:1.5px solid #e0d4b4;color:#1a1208;padding:10px 14px;border-radius:8px;outline:none;width:100%;transition:border-color 0.2s;}
        .input:focus{border-color:#c2a96e;background:#fffdf5;}
        .toast{font-family:'Outfit',sans-serif;font-size:13px;font-weight:500;padding:11px 18px;border-radius:10px;display:flex;align-items:center;gap:10px;animation:slideLeft 0.25s ease;box-shadow:0 4px 16px rgba(26,18,8,0.15);min-width:210px;}
        .toast-success{background:#1a1208;color:#f5efe0;}
        .toast-error{background:#c0392b;color:#fff;}
        @keyframes slideLeft{from{transform:translateX(20px);opacity:0}to{transform:none;opacity:1}}
        .spinner-sm{display:inline-block;width:14px;height:14px;border:2px solid #e0d4b4;border-top-color:#c2a96e;border-radius:50%;animation:spin 0.7s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
