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

function TimetableGrid({
  entries,
  classes,
  filterClassId,
}: {
  entries: TimetableEntry[];
  classes: { id: string; name: string }[];
  filterClassId: string;
}) {
  // Build grid: day → start_period → entries
  const grid: Record<number, Record<number, TimetableEntry[]>> = {};
  for (const e of entries) {
    if (filterClassId && !e.class_ids.includes(filterClassId)) continue;
    if (!grid[e.day]) grid[e.day] = {};
    if (!grid[e.day][e.start_period]) grid[e.day][e.start_period] = [];
    grid[e.day][e.start_period].push(e);
  }

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
                // Check if this period is covered by a multi-period lesson starting earlier
                const isContinuation = PERIODS.slice(0, p).some((prevP) => {
                  const prevEntries = grid[d]?.[prevP] ?? [];
                  return prevEntries.some(
                    (e) => e.start_period + e.duration > p,
                  );
                });
                if (isContinuation && cellEntries.length === 0) {
                  return (
                    <td
                      key={d}
                      style={{ background: "var(--accent-dim)", opacity: 0.4 }}
                    />
                  );
                }
                return (
                  <td key={d}>
                    {cellEntries.length === 0 ? (
                      <div className="tt-cell" />
                    ) : (
                      cellEntries.map((e, i) => (
                        <div key={i} className="tt-cell occupied">
                          <div className="tt-subject">{e.subject_name}</div>
                          <div className="tt-meta">
                            {e.class_ids
                              .map(
                                (id) =>
                                  classes.find((c) => c.id === id)?.name ?? id,
                              )
                              .join(", ")}
                          </div>
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

export default function GeneratePage() {
  const { generate, status, error, timetable, isRunning } = useGeneration();
  const { lessons, classes } = useAppStore();
  const [filterClass, setFilterClass] = useState("");

  const quality = timetable ? qualityLabel(timetable.fitness) : null;

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
        {/* Status banner */}
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

        {/* Stats card */}
        {timetable && (
          <div className="gen-card" style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
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
                    maxWidth: 320,
                  }}
                >
                  Lower score = better. 0 = constraint-perfect. Soft constraints
                  (balance, gaps) accumulate the remaining score.
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
            </div>
            <div style={{ textAlign: "center" }}>
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
        )}

        {/* Timetable grid */}
        {timetable && timetable.entries.length > 0 && (
          <div className="gen-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  color: "var(--text2)",
                }}
              >
                TIMETABLE GRID
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--text3)",
                  }}
                >
                  FILTER
                </span>
                <select
                  className="form-select"
                  style={{ width: 160, padding: "5px 10px", fontSize: 12 }}
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                >
                  <option value="">All classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <TimetableGrid
              entries={timetable.entries}
              classes={classes}
              filterClassId={filterClass}
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
