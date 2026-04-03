import React, { useEffect, useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast';

export default function SettingsPage() {
  const { fetchData, saveData, institution, loading } = useDataStore();
  const { toast, toasts } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    if (institution) {
      setForm({
        name: institution.name,
        days_per_week: institution.days_per_week,
        periods_per_day: institution.periods_per_day,
        break_after_period: institution.break_after_period,
      });
    }
  }, [institution]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveData({ institution: form });
      toast.success('Settings saved.');
      await fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalSlots = form
    ? form.days_per_week * (form.periods_per_day - 1) // minus 1 for break
    : 0;

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Institution schedule configuration</p>
        </div>
      </div>

      {loading && !institution ? (
        <div className="loader-overlay"><div className="spinner"></div><span>Loading…</span></div>
      ) : !form ? null : (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div>
            <div className="card section">
              <div className="card-title">Institution</div>
              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label">Institution Name</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="divider" />

                <div className="card-title" style={{ marginBottom: '0.75rem' }}>Schedule Grid</div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Days per Week</label>
                    <input
                      className="form-input"
                      type="number"
                      min={1} max={7}
                      value={form.days_per_week}
                      onChange={e => setForm(f => ({ ...f, days_per_week: +e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Periods per Day</label>
                    <input
                      className="form-input"
                      type="number"
                      min={1} max={15}
                      value={form.periods_per_day}
                      onChange={e => setForm(f => ({ ...f, periods_per_day: +e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Break After Period</label>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={form.periods_per_day - 1}
                    value={form.break_after_period}
                    onChange={e => setForm(f => ({ ...f, break_after_period: +e.target.value }))}
                  />
                  <div className="text-xs text-muted mt-1">Break is inserted after period {form.break_after_period}</div>
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Settings'}
                </button>
              </form>
            </div>
          </div>

          {/* Preview panel */}
          <div>
            <div className="card section">
              <div className="card-title">Schedule Preview</div>
              <div className="grid-2" style={{ gap: '0.5rem', marginBottom: '1rem' }}>
                <div className="stat-card" style={{ padding: '0.75rem' }}>
                  <div className="stat-label">Total Slots</div>
                  <div className="stat-value" style={{ fontSize: '1.6rem' }}>{form.days_per_week * form.periods_per_day}</div>
                  <div className="stat-sub">incl. break period</div>
                </div>
                <div className="stat-card" style={{ padding: '0.75rem' }}>
                  <div className="stat-label">Teaching Slots</div>
                  <div className="stat-value" style={{ fontSize: '1.6rem' }}>{form.days_per_week * (form.periods_per_day - 1)}</div>
                  <div className="stat-sub">excl. break</div>
                </div>
              </div>

              {/* Grid visual */}
              <div className="card-title" style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>Visual Grid</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `40px repeat(${form.days_per_week}, 1fr)`,
                gap: '2px',
                fontSize: '0.62rem',
              }}>
                <div></div>
                {['M','T','W','T','F','S','S'].slice(0, form.days_per_week).map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', color: 'var(--text-3)', fontWeight: 600, padding: '2px' }}>{d}</div>
                ))}
                {Array.from({ length: form.periods_per_day }, (_, pIdx) => (
                  <React.Fragment key={pIdx}>
                    <div style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>P{pIdx+1}</div>
                    {Array.from({ length: form.days_per_week }, (_, d) => (
                      <div key={d} style={{
                        height: 18,
                        borderRadius: 3,
                        background: pIdx === form.break_after_period
                          ? 'rgba(100,116,139,0.08)'
                          : 'var(--accent-dim)',
                        border: `1px solid ${pIdx === form.break_after_period ? 'var(--border)' : 'rgba(59,130,246,0.2)'}`,
                      }} />
                    ))}
                    {pIdx === form.break_after_period - 1 && (
                      <>
                        <div style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem' }}>BRK</div>
                        {Array.from({ length: form.days_per_week }, (_, d) => (
                          <div key={d} style={{
                            height: 12,
                            borderRadius: 2,
                            background: 'var(--surface-2)',
                            border: '1px dashed var(--border)',
                          }} />
                        ))}
                      </>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Technical Info</div>
              <div className="text-sm text-muted">
                <div className="flex justify-between mb-1"><span>Break Mask</span><span className="mono text-accent">{institution?.break_mask}</span></div>
                <div className="flex justify-between"><span>Working Slot Mask</span><span className="mono text-accent">{institution?.working_slot_mask}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
