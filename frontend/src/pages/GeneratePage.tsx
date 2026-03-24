// pages/GeneratePage.tsx
import { useState, useEffect } from "react";
import { useGeneration } from "../hooks/useGeneration";
import { useAppStore, TimetableEntry } from "../store/useAppStore";
import { getSessionToken } from "../auth";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = [0, 1, 2, 3, 4, 5, 6];
const PERIOD_TIMES = [
  "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00",
];

const isBreak = (day: number, period: number) =>
  (day < 4 && period === 3) || (day === 4 && period === 4);

function qualityLabel(fitness: number) {
  if (fitness < 1_000)  return { label: "PERFECT",    cls: "chip-green",  color: "#22c55e" };
  if (fitness < 5_000)  return { label: "EXCELLENT",  cls: "chip-green",  color: "#86efac" };
  if (fitness < 20_000) return { label: "GOOD",       cls: "chip-blue",   color: "#60a5fa" };
  if (fitness < 60_000) return { label: "ACCEPTABLE", cls: "chip-amber",  color: "#fbbf24" };
  return                       { label: "NEEDS WORK", cls: "chip-red",    color: "#f87171" };
}

// ── Subject colour palette — matches pdf_generation.py ────────────────────
const SUBJECT_COLORS = [
  "#D6EAF8","#D5F5E3","#FCF3CF","#FAD7A0","#EBDEF0",
  "#D1F2EB","#F5C6CB","#D4E6F1","#E0E7FF","#FADBD8",
  "#D4EFDF","#FDEBD0","#D6DBFF","#DFFFD6","#FFE4E1",
  "#E0FFFF","#FFF3B0","#E6D6FF","#DFFFE0","#FFECD1",
];

function buildSubjectColorMap(entries: TimetableEntry[]): Record<string, string> {
  const seen: string[] = [];
  for (const e of entries) {
    if (!seen.includes(e.subject_id)) seen.push(e.subject_id);
  }
  const map: Record<string, string> = {};
  seen.forEach((sid, i) => {
    map[sid] = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
  });
  return map;
}

// ── Legend component ──────────────────────────────────────────────────────
function SubjectLegend({
  entries,
  colorMap,
}: {
  entries: TimetableEntry[];
  colorMap: Record<string, string>;
}) {
  const seen = new Map<string, string>();
  for (const e of entries) {
    if (!seen.has(e.subject_id)) seen.set(e.subject_id, e.subject_name);
  }
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16,
    }}>
      {Array.from(seen.entries()).map(([sid, name]) => (
        <div key={sid} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "3px 8px", borderRadius: 4,
          background: colorMap[sid] ?? "#eee",
          border: "1px solid rgba(0,0,0,0.08)",
          fontSize: 10, fontFamily: "var(--mono)",
          color: "#333",
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: 2,
            background: "rgba(0,0,0,0.15)",
          }} />
          {name}
        </div>
      ))}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "3px 8px", borderRadius: 4,
        background: "#ffe4b5",
        border: "1px solid rgba(0,0,0,0.08)",
        fontSize: 10, fontFamily: "var(--mono)", color: "#333",
      }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(0,0,0,0.15)" }} />
        Break
      </div>
    </div>
  );
}

// ── Timetable grid ────────────────────────────────────────────────────────
function TimetableGrid({
  entries,
  teachers,
  classes,
  rooms,
  mode,
  filterId,
  colorMap,
}: {
  entries: TimetableEntry[];
  teachers: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  mode: "class" | "teacher" | "room";
  filterId: string;
  colorMap: Record<string, string>;
}) {
  const filtered = entries.filter((e) => {
    if (!filterId) return true;
    if (mode === "class")   return e.class_ids.includes(filterId);
    if (mode === "teacher") return e.teacher_ids.includes(filterId);
    if (mode === "room")    return e.room_ids.includes(filterId);
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
            {DAYS.map((d, i) => <th key={i}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((p) => (
            <tr key={p}>
              <td style={{
                padding: "6px 10px",
                fontFamily: "var(--mono)", fontSize: 10,
                color: "var(--text3)", background: "var(--bg2)",
                whiteSpace: "nowrap",
              }}>
                P{p + 1}<br />
                <span style={{ fontSize: 9 }}>{PERIOD_TIMES[p]}</span>
              </td>
              {DAYS.map((_, d) => {
                if (isBreak(d, p)) {
                  return (
                    <td key={d}>
                      <div className="tt-cell break-cell" style={{
                        background: "#ffe4b5",
                        border: "1px solid rgba(0,0,0,0.06)",
                      }}>
                        <span style={{
                          fontFamily: "var(--mono)", fontSize: 9,
                          color: "#92400e", letterSpacing: "0.05em",
                        }}>
                          🔔 BREAK
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
                  return <td key={d} style={{ background: "var(--accent-dim)", opacity: 0.3 }} />;

                return (
                  <td key={d}>
                    {cellEntries.length === 0 ? (
                      <div className="tt-cell" />
                    ) : (
                      cellEntries.map((e, i) => (
                        <div key={i} className="tt-cell occupied" style={{
                          background: colorMap[e.subject_id] ?? "var(--bg3)",
                          border: `1px solid rgba(0,0,0,0.07)`,
                          borderLeft: `3px solid rgba(0,0,0,0.15)`,
                        }}>
                          <div className="tt-subject" style={{ color: "#1a1a1a", fontWeight: 600 }}>
                            {e.subject_name}
                          </div>
                          {mode !== "class" && e.class_ids.length > 0 && (
                            <div className="tt-meta" style={{ color: "#374151" }}>
                              {e.class_ids.map((id) => nameOf(id, classes)).join(", ")}
                            </div>
                          )}
                          {mode !== "teacher" && e.teacher_ids.length > 0 && (
                            <div className="tt-meta" style={{ color: "#6b7280" }}>
                              {e.teacher_ids.map((id) => nameOf(id, teachers)).join(", ")}
                            </div>
                          )}
                          {mode !== "room" && e.room_ids.length > 0 && (
                            <div className="tt-meta" style={{ color: "#9ca3af", fontSize: 9 }}>
                              {e.room_ids.map((id) => nameOf(id, rooms)).join(", ")}
                            </div>
                          )}
                          {e.duration > 1 && (
                            <div className="tt-meta" style={{
                              color: "rgba(0,0,0,0.4)", fontSize: 9,
                              marginTop: 2, fontStyle: "italic",
                            }}>
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

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "14px 18px",
      minWidth: 120,
    }}>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 9,
        color: "var(--text3)", letterSpacing: "0.08em", marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 24, fontWeight: 700,
        color: accent ?? "var(--text)", lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: "var(--mono)", fontSize: 9,
          color: "var(--text3)", marginTop: 4,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Constraint legend ─────────────────────────────────────────────────────
function ConstraintLegend() {
  const items = [
    { label: "Hard constraints", desc: "Conflicts, breaks, locked slots", color: "#ef4444" },
    { label: "Structural",       desc: "Labs, consecutive, afternoon",    color: "#f59e0b" },
    { label: "Soft constraints", desc: "Balance, gaps, distribution",     color: "#3b82f6" },
  ];
  return (
    <div style={{
      display: "flex", gap: 12, flexWrap: "wrap",
      padding: "10px 14px",
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      marginBottom: 16,
    }}>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 9,
        color: "var(--text3)", letterSpacing: "0.06em",
        alignSelf: "center", marginRight: 4,
      }}>
        SCORE BREAKDOWN
      </div>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: item.color, flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text2)" }}>
              {item.label}
            </div>
            <div style={{ fontSize: 9, color: "var(--text3)", fontFamily: "var(--mono)" }}>
              {item.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Export PDF button logic ───────────────────────────────────────────────
// FIX: Changed to POST, passing entries from frontend cache
async function downloadPdf(jobId: string, entries: any[], setExporting: (v: boolean) => void) {
  setExporting(true);
  try {
    const token = await getSessionToken();
    console.log("entry sample:", JSON.stringify(entries[0], null, 2));
    const res = await fetch(`${BASE}/export-pdf/${jobId}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) throw new Error("PDF export failed");
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `timetable_${jobId.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("PDF export error:", e);
    alert("PDF export failed. Please try again.");
  } finally {
    setExporting(false);
  }
}

// ── Main page ─────────────────────────────────────────────────────────────
type ViewMode = "class" | "teacher" | "room";

export default function GeneratePage() {
  const { generate, status, error, timetable, isRunning } = useGeneration();
  const { lessons, teachers, classes, rooms } = useAppStore();
  const generation = useAppStore((s) => s.generation);

  const [mode, setMode]         = useState<ViewMode>("class");
  const [filterId, setFilterId] = useState("");
  const [exporting, setExporting] = useState(false);

  // Default to first class on load / when timetable arrives
  useEffect(() => {
    if (classes.length > 0 && !filterId) {
      setFilterId(classes[0].id);
    }
  }, [classes, timetable]);

  const handleMode = (m: ViewMode) => {
    setMode(m);
    const list = m === "class" ? classes : m === "teacher" ? teachers : rooms;
    setFilterId(list[0]?.id ?? "");
  };

  const quality    = timetable ? qualityLabel(timetable.fitness) : null;
  const filterList = mode === "class" ? classes : mode === "teacher" ? teachers : rooms;
  const colorMap   = timetable ? buildSubjectColorMap(timetable.entries) : {};

  const totalExpected = lessons.reduce((s, l) => {
    const periods = l.sessions?.reduce((a, sess) => a + sess.duration * sess.count, 0) ?? 0;
    return s + periods;
  }, 0);

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Generate Timetable</div>
          <div className="page-subtitle">
            {lessons.length} lesson blocks · {totalExpected} total periods · genetic algorithm
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {timetable && generation.jobId && (
            <button
              className="btn"
              // FIX: pass timetable.entries to downloadPdf
              onClick={() => downloadPdf(generation.jobId!, timetable.entries, setExporting)}
              disabled={exporting}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                minWidth: 130,
              }}
            >
              {exporting ? (
                <><span className="spinner" style={{ width: 12, height: 12 }} /> Exporting…</>
              ) : (
                <>📄 Export PDF</>
              )}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={generate}
            disabled={isRunning || lessons.length === 0}
            style={{ minWidth: 160 }}
          >
            {isRunning ? (
              <><span className="spinner" style={{ width: 13, height: 13 }} /> Running…</>
            ) : (
              "⚡ Generate"
            )}
          </button>
        </div>
      </div>

      <div className="page-body">

        {/* ── Status banner ── */}
        <div className={`gen-status ${status}`} style={{
          display: "flex", alignItems: "center", gap: 8,
          borderRadius: "var(--radius)",
          marginBottom: 16,
        }}>
          {isRunning && <span className="spinner" style={{ width: 14, height: 14 }} />}
          {status === "idle"    && "⊞ Ready — configure your data and click Generate"}
          {status === "pending" && "⏳ Queuing job…"}
          {status === "running" && "🧬 Algorithm running — polling every 2s…"}
          {status === "done"    && "✓ Timetable generated successfully"}
          {status === "failed"  && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 600 }}>✗ Generation failed</span>
              {error && (
                <pre style={{
                  margin: 0, fontSize: 10, fontFamily: "var(--mono)",
                  whiteSpace: "pre-wrap", opacity: 0.85,
                }}>
                  {error}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* ── Stats row ── */}
        {timetable && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <StatCard
                label="FITNESS SCORE"
                value={timetable.fitness.toLocaleString()}
                sub="lower = better · 0 = perfect"
                accent={quality!.color}
              />
              <StatCard
                label="QUALITY"
                value={quality!.label}
                sub={`fitness < ${
                  timetable.fitness < 1000 ? "1,000" :
                  timetable.fitness < 5000 ? "5,000" :
                  timetable.fitness < 20000 ? "20,000" :
                  timetable.fitness < 60000 ? "60,000" : "∞"
                }`}
                accent={quality!.color}
              />
              <StatCard
                label="LESSONS PLACED"
                value={`${timetable.entries.length}`}
                sub={`of ${lessons.length} blocks`}
                accent={timetable.entries.length < lessons.length ? "#f87171" : "#22c55e"}
              />
              <StatCard
                label="GA RUNTIME"
                value={timetable.generationTime !== null ? `${timetable.generationTime}s` : "—"}
                sub="wall clock time"
              />
              {timetable.entries.length < lessons.length && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 14px",
                  background: "rgba(251,191,36,0.1)",
                  border: "1px solid rgba(251,191,36,0.3)",
                  borderRadius: "var(--radius)",
                  fontFamily: "var(--mono)", fontSize: 11,
                  color: "var(--amber)",
                }}>
                  ⚠ {lessons.length - timetable.entries.length} lesson block(s) unplaced
                </div>
              )}
            </div>
            <ConstraintLegend />
          </>
        )}

        {/* ── Timetable grid card ── */}
        {timetable && timetable.entries.length > 0 && (
          <div className="gen-card">

            {/* Tabs + filter */}
            <div style={{
              display: "flex", alignItems: "center",
              gap: 8, marginBottom: 14, flexWrap: "wrap",
            }}>
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
                      fontFamily: "var(--mono)", fontSize: 11,
                      cursor: "pointer", fontWeight: mode === m ? 600 : 400,
                      transition: "all 0.15s",
                    }}
                  >
                    {m === "class" ? "🎓 Class" : m === "teacher" ? "👤 Teacher" : "🏫 Room"}
                  </button>
                ))}
              </div>

              <select
                className="form-select"
                style={{ width: 200, padding: "5px 10px", fontSize: 12, marginLeft: "auto" }}
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
              >
                <option value="">All {mode}s</option>
                {filterList.map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
            </div>

            {/* Grid label */}
            <div style={{
              fontFamily: "var(--mono)", fontSize: 10,
              color: "var(--text3)", marginBottom: 10,
              letterSpacing: "0.06em",
            }}>
              {filterId
                ? `TIMETABLE — ${filterList.find((x) => x.id === filterId)?.name?.toUpperCase()}`
                : `TIMETABLE — ALL ${mode.toUpperCase()}S`}
            </div>

            {/* Subject colour legend */}
            <SubjectLegend entries={timetable.entries} colorMap={colorMap} />

            <TimetableGrid
              entries={timetable.entries}
              teachers={teachers}
              classes={classes}
              rooms={rooms}
              mode={mode}
              filterId={filterId}
              colorMap={colorMap}
            />
          </div>
        )}

        {/* ── Empty state ── */}
        {!timetable && status === "idle" && (
          <div className="gen-card">
            <div className="empty-state" style={{ padding: "48px 20px" }}>
              <div className="empty-state-icon">⊞</div>
              <div className="empty-state-text">
                Configure teachers, subjects, rooms, classes, and lessons
                <br />
                then click <strong>⚡ Generate</strong> to run the algorithm
              </div>
              <div style={{
                marginTop: 16, display: "flex", gap: 8,
                justifyContent: "center", flexWrap: "wrap",
              }}>
                {[
                  ["👤 Teachers", teachers.length],
                  ["📚 Subjects", useAppStore.getState().subjects.length],
                  ["🏫 Rooms", rooms.length],
                  ["🎓 Classes", classes.length],
                  ["📋 Lessons", lessons.length],
                ].map(([label, count]) => (
                  <div key={label as string} style={{
                    padding: "4px 10px", borderRadius: 4,
                    background: (count as number) > 0 ? "rgba(34,197,94,0.1)" : "var(--bg3)",
                    border: `1px solid ${(count as number) > 0 ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                    fontFamily: "var(--mono)", fontSize: 10,
                    color: (count as number) > 0 ? "#22c55e" : "var(--text3)",
                  }}>
                    {label} {(count as number) > 0 ? `✓ ${count}` : "✗ 0"}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}