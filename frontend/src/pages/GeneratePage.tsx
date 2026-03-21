// pages/GeneratePage.tsx
import { useState } from "react";
import { useGeneration } from "../hooks/useGeneration";
import { useAppStore, TimetableEntry } from "../store/useAppStore";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = [0, 1, 2, 3, 4, 5, 6];
const PERIOD_TIMES = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
];

const isBreak = (day: number, period: number) =>
  (day < 4 && period === 3) || (day === 4 && period === 4);

function qualityLabel(fitness: number) {
  if (fitness < 1_000) return { label: "PERFECT", cls: "chip-green" };
  if (fitness < 5_000) return { label: "EXCELLENT", cls: "chip-green" };
  if (fitness < 20_000) return { label: "GOOD", cls: "chip-blue" };
  if (fitness < 60_000) return { label: "ACCEPTABLE", cls: "chip-amber" };
  return { label: "NEEDS WORK", cls: "chip-red" };
}

// ── Timetable grid ─────────────────────────────────────────────────────────

function TimetableGrid({
  entries,
  teachers,
  classes,
  rooms,
  mode,
  filterId,
}: {
  entries: TimetableEntry[];
  teachers: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  mode: "class" | "teacher" | "room";
  filterId: string;
}) {
  const filtered = entries.filter((e) => {
    if (!filterId) return true;
    if (mode === "class") return e.class_ids.includes(filterId);
    if (mode === "teacher") return e.teacher_ids.includes(filterId);
    if (mode === "room") return e.room_ids.includes(filterId);
    return true;
  });

  const grid: Record<number, Record<number, TimetableEntry[]>> = {};
  for (const e of filtered) {
    if (!grid[e.day]) grid[e.day] = {};
    if (!grid[e.day][e.start_period]) grid[e.day][e.start_period] = [];
    grid[e.day][e.start_period].push(e);
  }

  const nameOf = (id: string, list: { id: string; name: string }[]) =>
    list.find((x) => x.id === id)?.name ?? id;

  return (
    <div className="tt-grid-wrapper">
      <table className="tt-grid">
        <thead>
          <tr>
            <th style={{ minWidth: 70 }}>Period</th>
            {DAYS.map((d, i) => (
              <th key={i}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((p) => (
            <tr key={p}>
              <td
                style={{
                  padding: "6px 10px",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--text3)",
                  background: "var(--bg2)",
                  whiteSpace: "nowrap",
                }}
              >
                P{p + 1}
                <br />
                <span style={{ fontSize: 9 }}>{PERIOD_TIMES[p]}</span>
              </td>
              {DAYS.map((_, d) => {
                if (isBreak(d, p)) {
                  return (
                    <td key={d}>
                      <div className="tt-cell break-cell">
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 9,
                            color: "var(--text3)",
                          }}
                        >
                          BREAK
                        </span>
                      </div>
                    </td>
                  );
                }
                const cellEntries = grid[d]?.[p] ?? [];
                const isContinuation = PERIODS.slice(0, p).some((prevP) =>
                  (grid[d]?.[prevP] ?? []).some(
                    (e) => e.start_period + e.duration > p,
                  ),
                );
                if (isContinuation && cellEntries.length === 0)
                  return (
                    <td
                      key={d}
                      style={{ background: "var(--accent-dim)", opacity: 0.4 }}
                    />
                  );
                return (
                  <td key={d}>
                    {cellEntries.length === 0 ? (
                      <div className="tt-cell" />
                    ) : (
                      cellEntries.map((e, i) => (
                        <div key={i} className="tt-cell occupied">
                          <div className="tt-subject">{e.subject_name}</div>
                          {mode !== "class" && e.class_ids.length > 0 && (
                            <div className="tt-meta">
                              {e.class_ids
                                .map((id) => nameOf(id, classes))
                                .join(", ")}
                            </div>
                          )}
                          {mode !== "teacher" && e.teacher_ids.length > 0 && (
                            <div
                              className="tt-meta"
                              style={{ color: "var(--text3)" }}
                            >
                              {e.teacher_ids
                                .map((id) => nameOf(id, teachers))
                                .join(", ")}
                            </div>
                          )}
                          {mode !== "room" && e.room_ids.length > 0 && (
                            <div
                              className="tt-meta"
                              style={{ color: "var(--text3)" }}
                            >
                              {e.room_ids
                                .map((id) => nameOf(id, rooms))
                                .join(", ")}
                            </div>
                          )}
                          {e.duration > 1 && (
                            <div
                              className="tt-meta"
                              style={{ color: "var(--accent)" }}
                            >
                              ×{e.duration} periods
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

type ViewMode = "class" | "teacher" | "room";

export default function GeneratePage() {
  const { generate, status, error, timetable, isRunning } = useGeneration();
  const { lessons, teachers, classes, rooms } = useAppStore();

  const [mode, setMode] = useState<ViewMode>("class");
  const [filterId, setFilterId] = useState("");

  const handleMode = (m: ViewMode) => {
    setMode(m);
    setFilterId("");
  };

  const quality = timetable ? qualityLabel(timetable.fitness) : null;
  const filterList =
    mode === "class" ? classes : mode === "teacher" ? teachers : rooms;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Generate Timetable</div>
          <div className="page-subtitle">
            {lessons.length} lesson blocks · genetic algorithm
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={generate}
          disabled={isRunning || lessons.length === 0}
          style={{ minWidth: 160 }}
        >
          {isRunning ? (
            <>
              <span className="spinner" style={{ width: 13, height: 13 }} />{" "}
              Running…
            </>
          ) : (
            "⚡ Generate"
          )}
        </button>
      </div>

      <div className="page-body">
        {/* Status */}
        <div className={`gen-status ${status}`}>
          {isRunning && (
            <span className="spinner" style={{ width: 14, height: 14 }} />
          )}
          {status === "idle" && "⊞ Ready — click Generate to start"}
          {status === "pending" && "Queuing job…"}
          {status === "running" && "Algorithm running — polling every 2s…"}
          {status === "done" && "✓ Timetable generated successfully"}
          {status === "failed" && `✗ Generation failed: ${error}`}
        </div>

        {/* Stats */}
        {timetable && (
          <div className="gen-card" style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 24,
              }}
            >
              <div>
                <div className="fitness-label">FITNESS SCORE</div>
                <div className="fitness-display">
                  {timetable.fitness.toLocaleString()}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span className={`chip ${quality!.cls}`}>
                    {quality!.label}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--text3)",
                  }}
                >
                  Lower = better. 0 = constraint-perfect.
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="fitness-label">LESSONS PLACED</div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--text)",
                    marginTop: 4,
                  }}
                >
                  {timetable.entries.length}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--text3)",
                    marginTop: 2,
                  }}
                >
                  / {lessons.length} total
                </div>
                {timetable.entries.length < lessons.length && (
                  <div
                    style={{
                      marginTop: 6,
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      color: "var(--amber)",
                    }}
                  >
                    ⚠ {lessons.length - timetable.entries.length} unplaced
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="fitness-label">TIME TAKEN</div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--text)",
                    marginTop: 4,
                  }}
                >
                  {timetable.generationTime !== null
                    ? `${timetable.generationTime}s`
                    : "—"}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--text3)",
                    marginTop: 2,
                  }}
                >
                  ga runtime
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Grid */}
        {timetable && timetable.entries.length > 0 && (
          <div className="gen-card">
            {/* Tabs + filter */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: 4 }}>
                {(["class", "teacher", "room"] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleMode(m)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border2)",
                      background: mode === m ? "var(--accent)" : "var(--bg3)",
                      color: mode === m ? "#fff" : "var(--text2)",
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: mode === m ? 600 : 400,
                    }}
                  >
                    {m === "class"
                      ? "🎓 By Class"
                      : m === "teacher"
                        ? "👤 By Teacher"
                        : "🏫 By Room"}
                  </button>
                ))}
              </div>

              <select
                className="form-select"
                style={{
                  width: 200,
                  padding: "5px 10px",
                  fontSize: 12,
                  marginLeft: "auto",
                }}
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
              >
                <option value="">
                  All{" "}
                  {mode === "class"
                    ? "classes"
                    : mode === "teacher"
                      ? "teachers"
                      : "rooms"}
                </option>
                {filterList.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--text3)",
                marginBottom: 12,
              }}
            >
              {filterId
                ? `TIMETABLE — ${filterList.find((x) => x.id === filterId)?.name?.toUpperCase()}`
                : `TIMETABLE — ALL ${mode.toUpperCase()}S`}
            </div>

            <TimetableGrid
              entries={timetable.entries}
              teachers={teachers}
              classes={classes}
              rooms={rooms}
              mode={mode}
              filterId={filterId}
            />
          </div>
        )}

        {/* Empty state */}
        {!timetable && status === "idle" && (
          <div className="gen-card">
            <div className="empty-state" style={{ padding: "40px 20px" }}>
              <div className="empty-state-icon">⊞</div>
              <div className="empty-state-text">
                Configure teachers, subjects, rooms, classes, and lessons
                <br />
                then click Generate to run the algorithm
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
