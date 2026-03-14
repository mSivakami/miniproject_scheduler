import { useState } from "react";
import { api } from "../api/client";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

// Build a per-class grid from the raw generate() response
function buildClassGrids(result, lessons, subjects, teachers, rooms, classes) {
  // lesson lookup by id
  const lessonMap = Object.fromEntries(lessons.map((l) => [l.id, l]));
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
  const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));

  // grid[classId][day][period] = cell info
  const grids = {};
  classes.forEach((c) => {
    grids[c.id] = Array.from({ length: 5 }, () => Array(7).fill(null));
  });

  Object.entries(result.assignments).forEach(([lessonId, slot]) => {
    const lesson = lessonMap[lessonId];
    if (!lesson) return;

    const subject = subjectMap[lesson.subject_id] ?? {
      name: lesson.subject_id,
    };
    const tNames = lesson.teacher_ids
      .map((id) => teacherMap[id]?.name ?? id)
      .join(", ");
    const rNames = lesson.room_ids
      .map((id) => roomMap[id]?.name ?? id)
      .join(", ");

    lesson.class_ids.forEach((cid) => {
      if (!grids[cid]) return;
      for (
        let p = slot.start_period;
        p < slot.start_period + slot.duration;
        p++
      ) {
        grids[cid][slot.day][p] = {
          subject: subject.name,
          teachers: tNames,
          rooms: rNames,
          duration: slot.duration,
          isFirst: p === slot.start_period,
          isLab: subject.is_lab,
        };
      }
    });
  });

  return grids;
}

function TimetableGrid({ classObj, grid, breaks }) {
  // breaks set for quick lookup
  const breakSet = new Set(breaks.map((b) => `${b.day}-${b.period}`));

  return (
    <div className="tt-block">
      <div className="tt-class-name">{classObj.name}</div>
      <div className="tt-scroll">
        <table className="tt-table">
          <thead>
            <tr>
              <th className="tt-th-period"></th>
              {DAY_SHORT.map((d) => (
                <th key={d} className="tt-th-day">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p, pi) => (
              <tr key={pi}>
                <td className="tt-period-label">P{p}</td>
                {[0, 1, 2, 3, 4].map((day) => {
                  const isBreak = breakSet.has(`${day}-${pi}`);
                  if (isBreak) {
                    return (
                      <td key={day} className="tt-break">
                        break
                      </td>
                    );
                  }
                  const cell = grid[day][pi];
                  if (!cell)
                    return (
                      <td key={day} className="tt-empty">
                        —
                      </td>
                    );
                  if (!cell.isFirst) return null; // rowspan handled by first
                  return (
                    <td
                      key={day}
                      className={`tt-cell${cell.isLab ? " tt-lab" : ""}`}
                      rowSpan={cell.duration}
                    >
                      <span className="tt-subject">{cell.subject}</span>
                      <span className="tt-teacher">{cell.teachers}</span>
                      <span className="tt-room">{cell.rooms}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TimetablePage({
  lessons,
  subjects,
  teachers,
  rooms,
  classes,
  breaks,
}) {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const run = async () => {
    setStatus("loading");
    setError("");
    setResult(null);
    const t0 = Date.now();

    // tick elapsed time while waiting
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - t0) / 1000)),
      500,
    );

    try {
      const data = await api.generate();
      setResult(data);
      setStatus("done");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    } finally {
      clearInterval(timer);
      setElapsed(Math.floor((Date.now() - t0) / 1000));
    }
  };

  const grids = result
    ? buildClassGrids(result, lessons, subjects, teachers, rooms, classes)
    : null;

  return (
    <div className="tt-page">
      {/* ── generate panel ── */}
      <div className="generate-panel">
        <div className="generate-left">
          <div className="generate-label">Timetable Generator</div>
          <div className="generate-sub">
            {lessons.length} lessons · {classes.length} classes ·{" "}
            {teachers.length} teachers
          </div>
        </div>
        <div className="generate-right">
          {status === "loading" ? (
            <div className="loading-row">
              <span className="spinner" />
              <span className="loading-text">
                running genetic algorithm… {elapsed}s
              </span>
            </div>
          ) : (
            <button
              className="btn-generate"
              onClick={run}
              disabled={status === "loading"}
            >
              Generate
            </button>
          )}
        </div>
      </div>

      {/* ── error ── */}
      {status === "error" && <div className="error-bar">{error}</div>}

      {/* ── result meta ── */}
      {status === "done" && result && (
        <div className="result-meta">
          <span>
            fitness <strong>{result.fitness?.toLocaleString()}</strong>
          </span>
          <span>
            assigned <strong>{result.meta.lessons_assigned}</strong> /{" "}
            {result.meta.lessons_total}
          </span>
          {result.meta.lessons_unassigned > 0 && (
            <span className="warn">
              unassigned <strong>{result.meta.lessons_unassigned}</strong>
            </span>
          )}
          <span>
            generations <strong>{result.meta.generations_run}</strong>
          </span>
          <span>
            completed in <strong>{elapsed}s</strong>
          </span>
        </div>
      )}

      {/* ── timetables ── */}
      {grids &&
        classes.map((c) => (
          <TimetableGrid
            key={c.id}
            classObj={c}
            grid={grids[c.id]}
            breaks={breaks}
          />
        ))}
    </div>
  );
}
