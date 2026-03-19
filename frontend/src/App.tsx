// App.tsx
import { useState } from "react";
import { useBootstrap } from "./hooks/useBootstrap";
import { useAppStore } from "./store/useAppStore";
import { useSave } from "./hooks/useBootstrap";
import TeachersPage from "./pages/TeachersPage";
import SubjectsPage from "./pages/SubjectsPage";
import RoomsPage from "./pages/RoomsPage";
import ClassesPage from "./pages/ClassesPage";
import LessonsPage from "./pages/LessonsPage";
import GeneratePage from "./pages/GeneratePage";
import "./App.css";

type Page =
  | "teachers"
  | "subjects"
  | "rooms"
  | "classes"
  | "lessons"
  | "generate";

const NAV: { key: Page; label: string; icon: string }[] = [
  { key: "teachers", label: "Teachers", icon: "👤" },
  { key: "subjects", label: "Subjects", icon: "📚" },
  { key: "rooms", label: "Rooms", icon: "🏫" },
  { key: "classes", label: "Classes", icon: "🎓" },
  { key: "lessons", label: "Lessons", icon: "📋" },
  { key: "generate", label: "Generate", icon: "⚡" },
];

export default function App() {
  useBootstrap();
  const { save } = useSave();
  const { loading, saving, saveError, hasChanges } = useAppStore();
  const [page, setPage] = useState<Page>("teachers");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const handleSave = async () => {
    await save();
    const err = useAppStore.getState().saveError;
    if (!err) {
      setSaveMsg("Saved successfully!");
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const dirty = hasChanges();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">⊞</span>
          <span className="brand-text">TimetableAI</span>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ key, label, icon }) => (
            <button
              key={key}
              className={`nav-item ${page === key ? "active" : ""}`}
              onClick={() => setPage(key)}
            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
              {key === "generate" && <span className="nav-badge">GA</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {dirty && <div className="unsaved-badge">● Unsaved changes</div>}
          <button
            className={`save-btn ${dirty ? "dirty" : ""}`}
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? <span className="spinner" /> : "💾"}
            {saving ? "Saving…" : "Save All"}
          </button>
          {saveMsg && <div className="save-success">{saveMsg}</div>}
          {saveError && <div className="save-error">{saveError}</div>}
        </div>
      </aside>

      <main className="main-content">
        {loading && (
          <div className="global-loader">
            <div className="loader-ring" />
            <span>Loading data…</span>
          </div>
        )}
        {!loading && (
          <>
            {page === "teachers" && <TeachersPage />}
            {page === "subjects" && <SubjectsPage />}
            {page === "rooms" && <RoomsPage />}
            {page === "classes" && <ClassesPage />}
            {page === "lessons" && <LessonsPage />}
            {page === "generate" && <GeneratePage />}
          </>
        )}
      </main>
    </div>
  );
}
