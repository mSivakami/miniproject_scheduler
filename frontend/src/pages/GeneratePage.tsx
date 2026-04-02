// pages/GeneratePage.tsx
import { useState, useEffect } from "react";
import { useGeneration } from "../hooks/useGeneration";
import { useAppStore, TimetableEntry } from "../store/useAppStore";
import { getSessionToken } from "../auth";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

const ALL_DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const PERIOD_TIMES = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

function qualityLabel(fitness: number) {
  if (fitness < 1_000) return { label: "PERFECT", color: "#22c55e" };
  if (fitness < 5_000) return { label: "EXCELLENT", color: "#86efac" };
  if (fitness < 20_000) return { label: "GOOD", color: "#60a5fa" };
  if (fitness < 60_000) return { label: "ACCEPTABLE", color: "#fbbf24" };
  return { label: "NEEDS WORK", color: "#f87171" };
}

const SUBJECT_COLORS = [
  "rgba(148, 163, 184, 0.25)", // soft gray
  "rgba(147, 197, 253, 0.25)", // pale blue
  "rgba(134, 239, 172, 0.25)", // mint green
  "rgba(196, 181, 253, 0.25)", // lavender
  "rgba(253, 230, 138, 0.25)", // warm yellow
  "rgba(125, 211, 252, 0.25)", // sky blue
  "rgba(187, 247, 208, 0.25)", // soft green
  "rgba(252, 165, 165, 0.25)", // faint red
  "rgba(203, 213, 225, 0.25)", // cool gray
  "rgba(226, 232, 240, 0.25)", // neutral light
  "rgba(148, 163, 184, 0.20)", // slate lighter
  "rgba(229, 231, 235, 0.25)", // almost white gray
  "rgba(167, 243, 208, 0.25)", // aqua green
  "rgba(221, 214, 254, 0.25)", // pale violet
  "rgba(153, 246, 228, 0.25)", // aqua
  "rgba(254, 215, 170, 0.25)", // peach
  "rgba(191, 219, 254, 0.25)", // soft blue
  "rgba(216, 180, 254, 0.25)", // soft purple
  "rgba(186, 230, 253, 0.25)", // airy blue
  "rgba(241, 245, 249, 0.25)", // UI gray
];

function buildSubjectColorMap(
  entries: TimetableEntry[],
): Record<string, string> {
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

// ── Subject legend ────────────────────────────────────────────────────────
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
    <div
      style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}
    >
      {Array.from(seen.entries()).map(([sid, name]) => (
        <div
          key={sid}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 7px",
            borderRadius: 3,
            background: colorMap[sid] ?? "#eee",
            border: "1px solid rgba(0,0,0,0.07)",
            fontSize: 10,
            fontFamily: "var(--mono)",
            color: "#333",
          }}
        >
          {name}
        </div>
      ))}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 7px",
          borderRadius: 3,
          background: "#ffe4b5",
          border: "1px solid rgba(0,0,0,0.07)",
          fontSize: 10,
          fontFamily: "var(--mono)",
          color: "#92400e",
        }}
      >
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
  numDays,
  numPeriods,
  breakSlots,
}: {
  entries: TimetableEntry[];
  teachers: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  mode: "class" | "teacher" | "room";
  filterId: string;
  colorMap: Record<string, string>;
  numDays: number;
  numPeriods: number;
  breakSlots: { day: number; period: number }[];
}) {
  const days = ALL_DAY_NAMES.slice(0, numDays);
  const periods = Array.from({ length: numPeriods }, (_, i) => i);

  // Build a fast lookup set for break slots
  const breakSet = new Set(breakSlots.map((b) => `${b.day}:${b.period}`));
  const isBreak = (day: number, period: number) =>
    breakSet.has(`${day}:${period}`);

  const filtered = entries.filter((e) => {
    if (mode === "class") return e.class_ids.includes(filterId);
    if (mode === "teacher") return e.teacher_ids.includes(filterId);
    if (mode === "room") return e.room_ids.includes(filterId);
    return false;
  });

  // grid[day][start_period] → entries starting there
  const grid: Record<number, Record<number, TimetableEntry[]>> = {};
  for (const e of filtered) {
    if (!grid[e.day]) grid[e.day] = {};
    if (!grid[e.day][e.start_period]) grid[e.day][e.start_period] = [];
    grid[e.day][e.start_period].push(e);
  }

  const nameOf = (id: string, list: { id: string; name: string }[]) =>
    list.find((x) => x.id === id)?.name ?? id;

  return (
    <div className="tt-grid-wrapper" style={{ overflowX: "auto" }}>
      <table
        className="tt-grid"
        style={{ width: "100%", borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            <th
              style={{
                minWidth: 64,
                padding: "6px 8px",
                fontSize: 10,
                fontFamily: "var(--mono)",
                color: "var(--text3)",
                background: "var(--bg2)",
              }}
            >
              Period
            </th>
            {days.map((d, i) => (
              <th
                key={i}
                style={{
                  padding: "6px 8px",
                  fontSize: 11,
                  fontFamily: "var(--mono)",
                  fontWeight: 700,
                  color: "var(--text)",
                  background: "var(--bg2)",
                }}
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p}>
              {/* Period label */}
              <td
                style={{
                  padding: "5px 8px",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--text3)",
                  background: "var(--bg2)",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  borderRight: "1px solid var(--border)",
                }}
              >
                P{p + 1}
                <div
                  style={{ fontSize: 9, color: "var(--text3)", marginTop: 1 }}
                >
                  {PERIOD_TIMES[p] ?? ""}
                </div>
              </td>

              {days.map((_, d) => {
                // ── Break cell ──────────────────────────────────────────
                if (isBreak(d, p)) {
                  return (
                    <td
                      key={d}
                      style={{
                        background: "rgba(253, 235, 208, 0.50)",
                        border: "1px solid rgba(245,158,11,0.2)",
                        padding: "3px 6px",
                        textAlign: "center",
                        height: 22,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 9,
                          color: "#92400e",
                          letterSpacing: "0.04em",
                        }}
                      >
                        BREAK
                      </span>
                    </td>
                  );
                }

                // ── Continuation cell (covered by a multi-period span) ──
                const isContinuation = periods
                  .slice(0, p)
                  .some((prevP) =>
                    (grid[d]?.[prevP] ?? []).some(
                      (e) => e.start_period + e.duration > p,
                    ),
                  );
                if (isContinuation && !grid[d]?.[p]?.length) {
                  return (
                    <td
                      key={d}
                      style={{
                        background: "var(--bg2)",
                        opacity: 0.35,
                        border: "1px solid var(--border)",
                      }}
                    />
                  );
                }

                const cellEntries = grid[d]?.[p] ?? [];

                // ── Empty cell ──────────────────────────────────────────
                if (cellEntries.length === 0) {
                  return (
                    <td
                      key={d}
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        minHeight: 52,
                      }}
                    />
                  );
                }

                // ── Occupied cell ───────────────────────────────────────
                return (
                  <td
                    key={d}
                    style={{
                      border: "1px solid var(--border)",
                      padding: 0,
                      verticalAlign: "top",
                    }}
                  >
                    {cellEntries.map((e, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "6px 7px",
                          background: colorMap[e.subject_id] ?? "var(--bg3)",
                          borderLeft: "3px solid rgba(0,0,0,0.12)",
                          height: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        {/* Subject — bold, uppercase */}
                        <div
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#111",
                            letterSpacing: "0.03em",
                            textTransform: "uppercase",
                            lineHeight: 1.2,
                          }}
                        >
                          {e.subject_name}
                        </div>

                        {/* Class (hide in class view) */}
                        {mode !== "class" && e.class_ids.length > 0 && (
                          <div
                            style={{
                              fontSize: 9,
                              color: "#374151",
                              marginTop: 2,
                              fontFamily: "var(--mono)",
                            }}
                          >
                            {e.class_ids
                              .map((id) => nameOf(id, classes))
                              .join(", ")}
                          </div>
                        )}

                        {/* Teacher (hide in teacher view) */}
                        {mode !== "teacher" && e.teacher_ids.length > 0 && (
                          <div
                            style={{
                              fontSize: 9,
                              color: "#6b7280",
                              marginTop: 1,
                              fontFamily: "var(--mono)",
                            }}
                          >
                            {e.teacher_ids
                              .map((id) => nameOf(id, teachers))
                              .join(", ")}
                          </div>
                        )}

                        {/* Room (hide in room view) */}
                        {mode !== "room" && e.room_ids.length > 0 && (
                          <div
                            style={{
                              fontSize: 9,
                              color: "#9ca3af",
                              marginTop: 1,
                              fontFamily: "var(--mono)",
                            }}
                          >
                            {e.room_ids
                              .map((id) => nameOf(id, rooms))
                              .join(", ")}
                          </div>
                        )}

                        {/* Multi-period label */}
                        {e.duration > 1 && (
                          <div
                            style={{
                              fontSize: 9,
                              color: "rgba(0,0,0,0.35)",
                              marginTop: 3,
                              fontStyle: "italic",
                              fontFamily: "var(--mono)",
                            }}
                          >
                            ×{e.duration} periods
                          </div>
                        )}
                      </div>
                    ))}
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
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "12px 16px",
        minWidth: 110,
      }}
    >
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 9,
          color: "var(--text3)",
          letterSpacing: "0.08em",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 22,
          fontWeight: 700,
          color: accent ?? "var(--text)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9,
            color: "var(--text3)",
            marginTop: 3,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ── PDF export ────────────────────────────────────────────────────────────
async function downloadPdf(
  jobId: string,
  entries: TimetableEntry[],
  setExporting: (v: boolean) => void,
) {
  setExporting(true);
  try {
    const token = await getSessionToken();
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
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
  const { lessons, teachers, classes, rooms, settings } = useAppStore();
  const generation = useAppStore((s) => s.generation);

  const [mode, setMode] = useState<ViewMode>("class");
  const [filterId, setFilterId] = useState("");
  const [exporting, setExporting] = useState(false);

  // Resolve grid dimensions from settings (fall back to safe defaults)
  const numDays = settings?.num_days ?? 5;
  const numPeriods = settings?.num_periods ?? 7;
  const breakSlots = settings?.break_periods ?? [];

  // Default filter to first item in the current list
  useEffect(() => {
    if (classes.length > 0 && mode === "class") {
      setFilterId(classes[0].id);
    }
  }, [classes, timetable]);

  const handleMode = (m: ViewMode) => {
    setMode(m);
    const list = m === "class" ? classes : m === "teacher" ? teachers : rooms;
    // Always default to first item — never "all"
    setFilterId(list[0]?.id ?? "");
  };

  const quality = timetable ? qualityLabel(timetable.fitness) : null;
  const filterList =
    mode === "class" ? classes : mode === "teacher" ? teachers : rooms;
  const colorMap = timetable ? buildSubjectColorMap(timetable.entries) : {};

  const totalExpected = lessons.reduce((s, l) => {
    const periods =
      l.sessions?.reduce((a, sess) => a + sess.duration * sess.count, 0) ?? 0;
    return s + periods;
  }, 0);

  // Ensure filterId is always valid for current mode list
  useEffect(() => {
    if (filterList.length > 0 && !filterList.find((x) => x.id === filterId)) {
      setFilterId(filterList[0].id);
    }
  }, [mode, filterList]);

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Generate Timetable</div>
          <div className="page-subtitle">
            {lessons.length} lesson blocks · {totalExpected} total periods ·{" "}
            {numDays}d × {numPeriods}p grid
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {timetable && generation.jobId && (
            <button
              className="btn"
              onClick={() =>
                downloadPdf(generation.jobId!, timetable.entries, setExporting)
              }
              disabled={exporting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                minWidth: 130,
              }}
            >
              {exporting ? (
                <>
                  <span className="spinner" style={{ width: 12, height: 12 }} />{" "}
                  Exporting…
                </>
              ) : (
                <>📄 Export PDF</>
              )}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={generate}
            disabled={isRunning || lessons.length === 0}
            style={{ minWidth: 150 }}
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
      </div>

      <div className="page-body">
        {/* ── Status banner ── */}
        <div
          className={`gen-status ${status}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderRadius: "var(--radius)",
            marginBottom: 16,
          }}
        >
          {isRunning && (
            <span className="spinner" style={{ width: 14, height: 14 }} />
          )}
          {status === "idle" &&
            "⊞ Ready — configure your data and click Generate"}
          {status === "pending" && "⏳ Queuing job…"}
          {status === "running" && "🧬 Algorithm running — polling every 2s…"}
          {status === "done" && "✓ Timetable generated successfully"}
          {status === "failed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 600 }}>✗ Generation failed</span>
              {error && (
                <pre
                  style={{
                    margin: 0,
                    fontSize: 10,
                    fontFamily: "var(--mono)",
                    whiteSpace: "pre-wrap",
                    opacity: 0.85,
                  }}
                >
                  {error}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* ── Stats ── */}
        {timetable && (
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <StatCard
              label="FITNESS SCORE"
              value={timetable.fitness.toLocaleString()}
              sub="lower = better"
              accent={quality!.color}
            />
            <StatCard
              label="QUALITY"
              value={quality!.label}
              accent={quality!.color}
            />
            <StatCard
              label="LESSONS PLACED"
              value={`${timetable.entries.length}`}
              sub={`of ${lessons.length} blocks`}
              accent={
                timetable.entries.length < lessons.length
                  ? "#f87171"
                  : "#22c55e"
              }
            />
            <StatCard
              label="RUNTIME"
              value={
                timetable.generationTime !== null
                  ? `${timetable.generationTime}s`
                  : "—"
              }
              sub="wall clock"
            />
            {timetable.entries.length < lessons.length && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 14px",
                  background: "rgba(251,191,36,0.1)",
                  border: "1px solid rgba(251,191,36,0.3)",
                  borderRadius: "var(--radius)",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--amber)",
                }}
              >
                ⚠ {lessons.length - timetable.entries.length} block(s) unplaced
              </div>
            )}
          </div>
        )}

        {/* ── Grid card ── */}
        {timetable && timetable.entries.length > 0 && (
          <div className="gen-card">
            {/* Mode tabs + entity selector */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
                flexWrap: "wrap",
              }}
            >
              {/* View mode tabs */}
              <div style={{ display: "flex", gap: 3 }}>
                {(["class", "teacher", "room"] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleMode(m)}
                    style={{
                      padding: "4px 13px",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border2)",
                      background: mode === m ? "var(--accent)" : "var(--bg3)",
                      color: mode === m ? "#fff" : "var(--text2)",
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: mode === m ? 600 : 400,
                      transition: "all 0.12s",
                    }}
                  >
                    {m === "class"
                      ? "🎓 Class"
                      : m === "teacher"
                        ? "👤 Teacher"
                        : "🏫 Room"}
                  </button>
                ))}
              </div>

              {/* Entity dropdown — no "All X" option */}
              <select
                className="form-select"
                style={{
                  width: 190,
                  padding: "4px 10px",
                  fontSize: 12,
                  marginLeft: "auto",
                }}
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
              >
                {filterList.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Grid title */}
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--text3)",
                marginBottom: 10,
                letterSpacing: "0.06em",
              }}
            >
              {filterList.find((x) => x.id === filterId)?.name?.toUpperCase() ??
                ""}
              {" — "}
              {ALL_DAY_NAMES.slice(0, numDays).join(" · ")}
            </div>

            {/* Legend */}
            <SubjectLegend entries={timetable.entries} colorMap={colorMap} />

            {/* Grid */}
            <TimetableGrid
              entries={timetable.entries}
              teachers={teachers}
              classes={classes}
              rooms={rooms}
              mode={mode}
              filterId={filterId}
              colorMap={colorMap}
              numDays={numDays}
              numPeriods={numPeriods}
              breakSlots={breakSlots}
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
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  gap: 8,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                {(
                  [
                    ["👤 Teachers", teachers.length],
                    ["📚 Subjects", useAppStore.getState().subjects.length],
                    ["🏫 Rooms", rooms.length],
                    ["🎓 Classes", classes.length],
                    ["📋 Lessons", lessons.length],
                  ] as [string, number][]
                ).map(([label, count]) => (
                  <div
                    key={label}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      background:
                        count > 0 ? "rgba(34,197,94,0.1)" : "var(--bg3)",
                      border: `1px solid ${count > 0 ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      color: count > 0 ? "#22c55e" : "var(--text3)",
                    }}
                  >
                    {label} {count > 0 ? `✓ ${count}` : "✗ 0"}
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
