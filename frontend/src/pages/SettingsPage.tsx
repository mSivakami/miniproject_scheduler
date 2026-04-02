// pages/SettingsPage.tsx
import { useState, useEffect } from "react";
import {
  useAppStore,
  InstitutionSettings,
  BreakSlot,
  DEFAULT_SETTINGS,
} from "../store/useAppStore";
import { saveSettings, resetUserData, fetchBootstrap } from "../services/api";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  onSaved?: () => void;
}

export default function SettingsPage({ onSaved }: Props) {
  const { settings, setSettings, setBootstrap } = useAppStore();

  // Local form state — mirrors DB fields
  const [institutionName, setInstitutionName] = useState(
    settings?.institution_name ?? "",
  );
  const [academicYear, setAcademicYear] = useState(
    settings?.academic_year ?? "",
  );
  const [numDays, setNumDays] = useState(settings?.num_days ?? 5);
  const [numPeriods, setNumPeriods] = useState(settings?.num_periods ?? 7);
  const [breakSlots, setBreakSlots] = useState<Set<string>>(
    new Set((settings?.break_periods ?? []).map((b) => `${b.day}-${b.period}`)),
  );

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetErr, setResetErr] = useState<string | null>(null);

  // Sync from store when settings loads (e.g. after bootstrap)
  useEffect(() => {
    if (settings) {
      setInstitutionName(settings.institution_name);
      setAcademicYear(settings.academic_year);
      setNumDays(settings.num_days);
      setNumPeriods(settings.num_periods);
      setBreakSlots(
        new Set(settings.break_periods.map((b) => `${b.day}-${b.period}`)),
      );
    }
  }, [settings]);

  // When days/periods shrink, remove out-of-bounds break slots
  useEffect(() => {
    setBreakSlots((prev) => {
      const next = new Set<string>();
      prev.forEach((key) => {
        const [d, p] = key.split("-").map(Number);
        if (d < numDays && p < numPeriods) next.add(key);
      });
      return next;
    });
  }, [numDays, numPeriods]);

  const toggleBreak = (day: number, period: number) => {
    const key = `${day}-${period}`;
    setBreakSlots((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!institutionName.trim()) {
      setSaveErr("Institution name is required.");
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);
    try {
      const break_periods: BreakSlot[] = Array.from(breakSlots).map((k) => {
        const [day, period] = k.split("-").map(Number);
        return { day, period };
      });

      const payload: InstitutionSettings = {
        institution_name: institutionName.trim(),
        academic_year: academicYear.trim(),
        num_days: numDays,
        num_periods: numPeriods,
        break_periods,
      };

      const result = await saveSettings(payload);
      setSettings(result);
      setSaveMsg("Settings saved!");
      setTimeout(() => setSaveMsg(null), 3000);
      onSaved?.();
    } catch (e: any) {
      setSaveErr(e.message ?? "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setResetErr(null);
    try {
      await resetUserData();
      // Clear local store and re-bootstrap (will return null settings)
      const fresh = await fetchBootstrap();
      setBootstrap(fresh);
      // Reset local form to defaults
      setInstitutionName("");
      setAcademicYear("");
      setNumDays(5);
      setNumPeriods(7);
      setBreakSlots(new Set());
      setShowResetConfirm(false);
    } catch (e: any) {
      setResetErr(e.message ?? "Reset failed.");
    } finally {
      setResetting(false);
    }
  };

  const periods = Array.from({ length: numPeriods }, (_, i) => i);
  const days = Array.from({ length: numDays }, (_, i) => i);

  return (
    <div className="page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="page-title">
            <span>⚙️</span> Settings
          </div>
          <div className="page-subtitle">
            Configure your institution before adding data — required first step.
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760 }}>
        {/* ── Institution Info ──────────────────────────────────────────── */}
        <section className="settings-card">
          <div className="settings-card-title">🏫 Institution Info</div>

          <div className="form-row-2">
            <div className="form-group">
              <label>
                Institution Name <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input
                className="form-input"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="e.g. St. Mary's Higher Secondary School"
              />
            </div>
            <div className="form-group">
              <label>Academic Year</label>
              <input
                className="form-input"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g. 2024-2025"
              />
            </div>
          </div>
        </section>

        {/* ── Timetable Structure ───────────────────────────────────────── */}
        <section className="settings-card">
          <div className="settings-card-title">📅 Timetable Structure</div>

          <div className="form-row-2">
            <div className="form-group">
              <label>
                Number of Working Days{" "}
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    color: "var(--accent)",
                    fontSize: 11,
                  }}
                >
                  (max 6)
                </span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={numDays}
                  onChange={(e) => setNumDays(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--accent)" }}
                />
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 18,
                    color: "var(--text)",
                    minWidth: 28,
                    textAlign: "center",
                  }}
                >
                  {numDays}
                </span>
              </div>
              <div
                style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}
              >
                {DAY_NAMES.slice(0, numDays).join(", ")}
              </div>
            </div>

            <div className="form-group">
              <label>
                Max Periods per Day{" "}
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    color: "var(--accent)",
                    fontSize: 11,
                  }}
                >
                  (max 11)
                </span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="range"
                  min={1}
                  max={11}
                  value={numPeriods}
                  onChange={(e) => setNumPeriods(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--accent)" }}
                />
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 18,
                    color: "var(--text)",
                    minWidth: 28,
                    textAlign: "center",
                  }}
                >
                  {numPeriods}
                </span>
              </div>
              <div
                style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}
              >
                P1 – P{numPeriods} per day
              </div>
            </div>
          </div>
        </section>

        {/* ── Break Periods Grid ────────────────────────────────────────── */}
        <section className="settings-card">
          <div className="settings-card-title">
            ☕ Break Periods
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--text3)",
                marginLeft: 10,
                fontWeight: 400,
              }}
            >
              Click cells to mark as break — GA will not schedule lessons here
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                borderCollapse: "separate",
                borderSpacing: 4,
                fontSize: 11,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      width: 48,
                      color: "var(--text3)",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      textAlign: "left",
                      paddingBottom: 4,
                    }}
                  />
                  {periods.map((p) => (
                    <th
                      key={p}
                      style={{
                        width: 36,
                        color: "var(--text3)",
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        textAlign: "center",
                        paddingBottom: 4,
                      }}
                    >
                      P{p + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d}>
                    <td
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        color: "var(--text2)",
                        paddingRight: 8,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {DAY_NAMES[d]}
                    </td>
                    {periods.map((p) => {
                      const key = `${d}-${p}`;
                      const isBreak = breakSlots.has(key);
                      return (
                        <td key={p} style={{ textAlign: "center" }}>
                          <button
                            onClick={() => toggleBreak(d, p)}
                            style={{
                              width: 32,
                              height: 28,
                              border: `1px solid ${isBreak ? "var(--amber)" : "var(--border)"}`,
                              borderRadius: "var(--radius)",
                              background: isBreak
                                ? "rgba(245,158,11,0.18)"
                                : "var(--bg3)",
                              color: isBreak ? "var(--amber)" : "var(--text3)",
                              fontSize: 13,
                              cursor: "pointer",
                              transition: "all 0.12s",
                              lineHeight: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            title={
                              isBreak
                                ? "Click to remove break"
                                : "Click to mark as break"
                            }
                          >
                            {isBreak ? "☕" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {breakSlots.size > 0 && (
            <div
              style={{
                marginTop: 10,
                fontSize: 11,
                color: "var(--amber)",
                fontFamily: "var(--mono)",
              }}
            >
              {breakSlots.size} break{breakSlots.size !== 1 ? "s" : ""} marked ·{" "}
              <button
                onClick={() => setBreakSlots(new Set())}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text3)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: "var(--mono)",
                  textDecoration: "underline",
                }}
              >
                clear all
              </button>
            </div>
          )}
        </section>

        {/* ── Save Button ───────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 32,
          }}
        >
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ fontSize: 13, padding: "9px 24px" }}
          >
            {saving ? (
              <>
                <span className="spinner" />
                Saving…
              </>
            ) : (
              <>💾 Save Settings</>
            )}
          </button>

          {saveMsg && (
            <span
              style={{
                color: "var(--green)",
                fontSize: 12,
                fontFamily: "var(--mono)",
              }}
            >
              ✓ {saveMsg}
            </span>
          )}
          {saveErr && (
            <span style={{ color: "var(--red)", fontSize: 12 }}>{saveErr}</span>
          )}
        </div>

        {/* ── Danger Zone ───────────────────────────────────────────────── */}
        <section
          className="settings-card"
          style={{ borderColor: "rgba(239,68,68,0.3)" }}
        >
          <div className="settings-card-title" style={{ color: "var(--red)" }}>
            ⚠️ Danger Zone
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                Reset All Data
              </div>
              <div
                style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6 }}
              >
                Permanently deletes your institution settings, all teachers,
                subjects, rooms, classes, lessons, and generation history. This
                cannot be undone.
              </div>
            </div>

            {!showResetConfirm ? (
              <button
                className="btn"
                onClick={() => setShowResetConfirm(true)}
                style={{
                  flexShrink: 0,
                  border: "1px solid var(--red)",
                  color: "var(--red)",
                  fontSize: 12,
                  padding: "7px 16px",
                }}
              >
                Reset
              </button>
            ) : (
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  alignItems: "flex-end",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--red)",
                    fontFamily: "var(--mono)",
                    textAlign: "right",
                  }}
                >
                  Are you sure? This is irreversible.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn"
                    onClick={() => {
                      setShowResetConfirm(false);
                      setResetErr(null);
                    }}
                    style={{ fontSize: 12, padding: "6px 14px" }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    onClick={handleReset}
                    disabled={resetting}
                    style={{
                      fontSize: 12,
                      padding: "6px 14px",
                      background: "var(--red)",
                      color: "#fff",
                      border: "none",
                    }}
                  >
                    {resetting ? (
                      <>
                        <span className="spinner" />
                        Resetting…
                      </>
                    ) : (
                      "Yes, delete everything"
                    )}
                  </button>
                </div>
                {resetErr && (
                  <div style={{ fontSize: 11, color: "var(--red)" }}>
                    {resetErr}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
