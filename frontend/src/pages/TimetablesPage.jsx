import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTimetableStore } from '../store/timetableStore';
import { useDataStore } from '../store/dataStore';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast';
import TimetableGrid from '../components/TimetableGrid';

export function TimetablesListPage() {
  const { fetchTimetables, deleteTimetable, renameTimetable, timetables, loading } = useTimetableStore();
  const { toast, toasts } = useToast();
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState('');

  useEffect(() => { fetchTimetables(); }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deleteTimetable(id);
      toast.success('Timetable deleted.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRename = async (id) => {
    if (!renameVal.trim()) return;
    try {
      await renameTimetable(id, renameVal.trim());
      setRenaming(null);
      toast.success('Renamed.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Saved Timetables</h1>
          <p className="page-subtitle">{timetables.length}/5 saved · Click to view full schedule</p>
        </div>
        <Link to="/generate">
          <button className="btn btn-primary">⚡ Generate New</button>
        </Link>
      </div>

      {loading ? (
        <div className="loader-overlay"><div className="spinner"></div><span>Loading…</span></div>
      ) : timetables.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <p>No saved timetables. Generate one first.</p>
          <Link to="/generate"><button className="btn btn-primary mt-2">Go to Generator</button></Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Fitness</th>
                <th>Hard Violations</th>
                <th>Soft Violations</th>
                <th>Created</th>
                <th style={{ width: 160 }}></th>
              </tr>
            </thead>
            <tbody>
              {timetables.map(tt => (
                <tr key={tt.id}>
                  <td>
                    {renaming === tt.id ? (
                      <div className="flex gap-1">
                        <input
                          className="form-input"
                          style={{ maxWidth: 200 }}
                          value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(tt.id); if (e.key === 'Escape') setRenaming(null); }}
                          autoFocus
                        />
                        <button className="btn btn-success btn-sm" onClick={() => handleRename(tt.id)}>✓</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setRenaming(null)}>✕</button>
                      </div>
                    ) : (
                      <span style={{ fontWeight: 500 }}>{tt.name}</span>
                    )}
                  </td>
                  <td><span className="badge green">{tt.fitness_score?.toFixed?.(4) ?? '—'}</span></td>
                  <td>
                    <span className={`badge ${tt.hard_violations === 0 ? 'green' : 'red'}`}>
                      {tt.hard_violations ?? '—'}
                    </span>
                  </td>
                  <td><span className="badge yellow">{tt.soft_violations ?? '—'}</span></td>
                  <td className="text-muted mono" style={{ fontSize: '0.72rem' }}>
                    {new Date(tt.created_at).toLocaleString()}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Link to={`/timetables/${tt.id}`}>
                        <button className="btn btn-secondary btn-sm">View</button>
                      </Link>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setRenaming(tt.id); setRenameVal(tt.name); }}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(tt.id, tt.name)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function TimetableViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchTimetable, activeTimetable } = useTimetableStore();
  const { institution, teachers, rooms, fetchData } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('grid'); // grid | raw

  useEffect(() => {
    fetchData();
    fetchTimetable(id).then(() => setLoading(false)).catch(e => { setError(e.message); setLoading(false); });
  }, [id]);

  const tt = activeTimetable;

  if (loading) return <div className="loader-overlay"><div className="spinner" style={{ width: 28, height: 28 }}></div><span>Loading timetable…</span></div>;
  if (error) return <div className="alert error">{error}</div>;
  if (!tt) return <div className="alert error">Timetable not found.</div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-1" onClick={() => navigate('/timetables')}>← Back</button>
          <h1 className="page-title">{tt.name}</h1>
          <p className="page-subtitle">
            Fitness: {tt.fitness_score?.toFixed?.(4) ?? '—'} ·
            Hard: {tt.hard_violations ?? '—'} ·
            Soft: {tt.soft_violations ?? '—'} ·
            {new Date(tt.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`badge ${tt.hard_violations === 0 ? 'green' : 'red'}`} style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}>
            {tt.hard_violations === 0 ? '✅ No Hard Violations' : `❌ ${tt.hard_violations} Hard`}
          </span>
        </div>
      </div>

      <div className="tab-bar section">
        <button className={`tab-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>📅 Grid View</button>
        <button className={`tab-btn ${view === 'raw' ? 'active' : ''}`} onClick={() => setView('raw')}>{ } Raw JSON</button>
      </div>

      {view === 'grid' ? (
        <div className="card">
          <TimetableGrid
            timetableJson={tt.timetable_json}
            institution={institution}
            teachers={teachers}
            rooms={rooms}
          />
        </div>
      ) : (
        <div className="card">
          <div className="card-title">Raw JSON</div>
          <div className="generate-result">
            {JSON.stringify(
              typeof tt.timetable_json === 'string' ? JSON.parse(tt.timetable_json) : tt.timetable_json,
              null, 2
            )}
          </div>
        </div>
      )}
    </div>
  );
}
