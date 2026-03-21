// App.tsx
// Uses authClient.useSession() hook from BetterAuthReactAdapter
// Routes: / = main app, /auth/:pathname = Neon Auth pages (sign-in, sign-up, Google OAuth)

import { useState, useEffect } from "react";
import {
  Routes,
  Route,
  useParams,
  useNavigate,
  Navigate,
} from "react-router-dom";
import { AuthView } from "@neondatabase/auth/react/ui";
import { authClient } from "./auth";
import { useAppStore } from "./store/useAppStore";
import { useSave, useBootstrap } from "./hooks/useBootstrap";
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

// ── Auth page — renders Neon Auth UI at /auth/* ───────────────────────────────

function AuthPage() {
  const { pathname } = useParams();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      {/* AuthView handles: sign-in, sign-up, forgot-password, callback, etc.
          Google OAuth button appears automatically when configured in Neon Console */}
      <AuthView pathname={pathname} />
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────

function MainApp({ userEmail }: { userEmail: string }) {
  useBootstrap();
  const { save } = useSave();
  const navigate = useNavigate();
  const {
    loading,
    saving,
    saveError,
    hasChanges,
    clearChanges,
    resetGeneration,
  } = useAppStore();
  const [page, setPage] = useState<Page>("teachers");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const handleSave = async () => {
    await save();
    if (!useAppStore.getState().saveError) {
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const handleLogout = async () => {
    await authClient.signOut();
    clearChanges();
    resetGeneration();
    localStorage.removeItem("timetable-app-store");
    navigate("/auth/sign-in", { replace: true });
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
          <div
            style={{
              padding: "8px 10px",
              background: "var(--bg3)",
              borderRadius: "var(--radius)",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--text3)",
                letterSpacing: "0.06em",
              }}
            >
              SIGNED IN AS
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text2)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: 2,
              }}
            >
              {userEmail}
            </div>
          </div>

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

          <button
            className="btn"
            onClick={handleLogout}
            style={{
              width: "100%",
              justifyContent: "center",
              marginTop: 4,
              fontSize: 12,
            }}
          >
            Sign out
          </button>
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

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  // useSession() from BetterAuthReactAdapter — reactive hook
  const session = authClient.useSession();

  if (session.isPending) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          gap: 14,
          color: "var(--text2)",
          fontFamily: "var(--mono)",
          fontSize: 12,
        }}
      >
        <div className="loader-ring" />
        Checking session…
      </div>
    );
  }

  if (!session.data) {
    // Not authenticated — only allow auth routes
    return (
      <Routes>
        <Route path="/auth/:pathname" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth/sign-in" replace />} />
      </Routes>
    );
  }

  // Authenticated
  const email = session.data.user?.email ?? "";
  return (
    <Routes>
      {/* Keep callback route accessible for OAuth redirect */}
      <Route path="/auth/callback" element={<AuthPage />} />
      <Route path="/auth/:pathname" element={<Navigate to="/" replace />} />
      <Route path="*" element={<MainApp userEmail={email} />} />
    </Routes>
  );
}
