import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMiniGroupStore } from '../store/miniGroupStore';
import { useTimetableStore } from '../store/timetableStore';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast';
import TimetableGrid from '../components/TimetableGrid';
import { useDataStore } from '../store/dataStore';

const API = '';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${useAuthStore.getState().token}`,
  };
}

const DEFAULT_PARAMS = {
  max_generations: 300,
  population_size: 80,
  time_limit_seconds: 30,
  fast_mode: false,
};

export default function GeneratePage() {
  const [searchParams] = useSearchParams();
  const preselectedGroup = searchParams.get('group');

  const { groups, fetchGroups } = useMiniGroupStore();
  const { saveTimetable } = useTimetableStore();
  const { institution, teachers, rooms, fetchData } = useDataStore();
  const { toast, toasts } = useToast();

  const [mode, setMode] = useState(preselectedGroup ? 'mini' : 'main');
  const [selectedGroup, setSelectedGroup] = useState(preselectedGroup || '');
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [preflightResult, setPreflightResult] = useState(null);
  const [preflighting, setPreflighting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchGroups(); fetchData(); }, []);
  useEffect(() => { if (preselectedGroup) { setSelectedGroup(preselectedGroup); setMode('mini'); } }, [preselectedGroup]);

  // Timer
  useEffect(() => {
    let interval;
    if (running) {
      setElapsed(0);
      interval = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [running]);

  const runPreflight = async () => {
    setPreflighting(true);
    setPreflightResult(null);
    try {
      const res = await fetch(`${API}/api/generate/preflight/main`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      setPreflightResult(data);
    } catch (err) {
      toast.error('Preflight failed: ' + err.message);
    } finally {
      setPreflighting(false);
    }
  };

  const runGenerate = async () => {
    setRunning(true);
    setResult(null);
    try {
      const endpoint = mode === 'main'
        ? `${API}/api/generate/main`
        : `${API}/api/generate/mini/${selectedGroup}`;

      const body = { ...params };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
      toast.success(`Timetable generated! Fitness: ${data.fitness_score?.toFixed?.(4) ?? data.fitness_score}`);
      setSaveName(mode === 'main' ? 'Main Schedule' : `${groups.find(g => g.id === selectedGroup)?.name || 'Mini Group'} Schedule`);
    } catch (err) {
      toast.error('Generation failed: ' + err.message);
    } finally {
      setRunning(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await saveTimetable({
        name: saveName || 'Untitled',
        timetable_json: JSON.stringify(result.timetable || result),
        fitness_score: result.fitness_score,
        hard_violations: result.hard_violations,
        soft_violations: result.soft_violations,
      });
      toast.success('Timetable saved!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const groupForInst = mode === 'mini' ? groups.find(g => g.id === selectedGroup) : null;

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Generate Timetable</h1>
          <p className="page-subtitle">Genetic Algorithm · Blocks until done, ~3–30s depending on complexity</p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="tab-bar section">
        <button className={`tab-btn ${mode === 'main' ? 'active' : ''}`} onClick={() => setMode('main')}>
          🏛️ Main Schedule
        </button>
        <button className={`tab-btn ${mode === 'mini' ? 'active' : ''}`} onClick={() => setMode('mini')} disabled={groups.length === 0}>
          🔀 Mini Group {groups.length === 0 ? '(none)' : ''}
        </button>
      </div>

      <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: config panel */}
        <div>
          {mode === 'mini' && (
            <div className="card section">
              <div className="card-title">Select Mini Group</div>
              <select
                className="form-input"
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
              >
                <option value="">— choose a group —</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} (Slot {g.slot_index}, {g.days_per_week}d×{g.periods_per_day}p)</option>
                ))}
              </select>
            </div>
          )}

          <div className="card section">
            <div className="card-title">GA Parameters</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Max Generations</label>
                <input className="form-input" type="number" min={50} max={2000} value={params.max_generations}
                  onChange={e => setParams(p => ({ ...p, max_generations: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Population Size</label>
                <input className="form-input" type="number" min={20} max={500} value={params.population_size}
                  onChange={e => setParams(p => ({ ...p, population_size: +e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Time Limit (seconds)</label>
                <input className="form-input" type="number" min={5} max={300} value={params.time_limit_seconds}
                  onChange={e => setParams(p => ({ ...p, time_limit_seconds: +e.target.value }))} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={params.fast_mode} onChange={e => setParams(p => ({ ...p, fast_mode: e.target.checked }))} />
              Fast mode (reduces quality for speed)
            </label>
          </div>

          <div className="flex gap-2 section">
            {mode === 'main' && (
              <button className="btn btn-secondary" onClick={runPreflight} disabled={preflighting || running}>
                {preflighting ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }}></span> Checking…</> : '🔍 Preflight Check'}
              </button>
            )}
            <button
              className="btn btn-primary btn-lg"
              onClick={runGenerate}
              disabled={running || (mode === 'mini' && !selectedGroup)}
            >
              {running
                ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span> Generating… {elapsed}s</>
                : '⚡ Run Generator'}
            </button>
          </div>

          {/* Preflight result */}
          {preflightResult && (
            <div className={`alert ${preflightResult.feasible ? 'success' : 'error'} section`}>
              <strong>{preflightResult.feasible ? '✅ Feasible' : '❌ Not Feasible'}</strong>
              {preflightResult.errors?.length > 0 && (
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
                  {preflightResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {preflightResult.warnings?.length > 0 && (
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem', color: 'var(--yellow)' }}>
                  {preflightResult.warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Result summary */}
          {result && (
            <div className="card section">
              <div className="card-title">Generation Result</div>
              <div className="grid-2" style={{ gap: '0.5rem', marginBottom: '1rem' }}>
                <div className="stat-card" style={{ padding: '0.75rem' }}>
                  <div className="stat-label">Fitness</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--green)' }}>
                    {result.fitness_score?.toFixed?.(4) ?? result.fitness_score ?? '—'}
                  </div>
                </div>
                <div className="stat-card" style={{ padding: '0.75rem' }}>
                  <div className="stat-label">Hard Violations</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem', color: result.hard_violations === 0 ? 'var(--green)' : 'var(--red)' }}>
                    {result.hard_violations ?? '—'}
                  </div>
                </div>
                <div className="stat-card" style={{ padding: '0.75rem' }}>
                  <div className="stat-label">Soft Violations</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--yellow)' }}>
                    {result.soft_violations ?? '—'}
                  </div>
                </div>
                <div className="stat-card" style={{ padding: '0.75rem' }}>
                  <div className="stat-label">Generations Run</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem' }}>
                    {result.generations_run ?? '—'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  className="form-input"
                  placeholder="Timetable name…"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-success" onClick={handleSave} disabled={saving || !saveName.trim()}>
                  {saving ? 'Saving…' : '💾 Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: timetable preview */}
        <div>
          {result ? (
            <div className="card">
              <div className="card-title">Preview</div>
              <TimetableGrid
                timetableJson={result.timetable || result}
                institution={groupForInst || institution}
                teachers={teachers}
                rooms={rooms}
              />
            </div>
          ) : (
            <div className="card">
              <div className="empty-state" style={{ padding: '4rem 2rem' }}>
                <div className="empty-icon">📅</div>
                <p>Run the generator to preview the timetable here.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
