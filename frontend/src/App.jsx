import { useState, useEffect, useCallback } from "react";
import { DataPage } from "./pages/DataPage";
import { TimetablePage } from "./pages/TimetablePage";
import { api } from "./api/client";
import "./index.css";

export default function App() {
  const [tab, setTab] = useState("data");

  // shared data needed by TimetablePage
  const [lessons, setLessons] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [breaks, setBreaks] = useState([]);

  const loadShared = useCallback(async () => {
    const [le, su, te, ro, cl, br] = await Promise.all([
      api.getLessons(),
      api.getSubjects(),
      api.getTeachers(),
      api.getRooms(),
      api.getClasses(),
      api.getBreaks(),
    ]);
    setLessons(le);
    setSubjects(su);
    setTeachers(te);
    setRooms(ro);
    setClasses(cl);
    setBreaks(br);
  }, []);

  // reload shared data when switching to timetable tab
  useEffect(() => {
    if (tab === "timetable") loadShared();
  }, [tab, loadShared]);

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Scheduler</span>
        <nav className="app-nav">
          <button
            className={`nav-btn${tab === "data" ? " active" : ""}`}
            onClick={() => setTab("data")}
          >
            Data
          </button>
          <button
            className={`nav-btn${tab === "timetable" ? " active" : ""}`}
            onClick={() => setTab("timetable")}
          >
            Timetable
          </button>
        </nav>
      </header>

      <main className="app-main">
        {tab === "data" && <DataPage />}
        {tab === "timetable" && (
          <TimetablePage
            lessons={lessons}
            subjects={subjects}
            teachers={teachers}
            rooms={rooms}
            classes={classes}
            breaks={breaks}
          />
        )}
      </main>
    </div>
  );
}
