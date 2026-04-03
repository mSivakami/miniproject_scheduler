import React, { useEffect, useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast';

function SubjectModal({ subject, onClose, onSave }) {
  const [form, setForm] = useState(
    subject || { name: '', short_name: '', is_difficult: false, is_lab: false, priority: 1 }
  );
  const [saving, setSaving] = useState(false);
  const { toast, toasts } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <ToastContainer toasts={toasts} />
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="modal-title">{subject ? 'Edit Subject' : 'Add Subject'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Subject Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Short Name</label>
                <input className="form-input" placeholder="e.g. MATH" value={form.short_name || ''} onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Priority (1–10)</label>
              <input className="form-input" type="number" min={1} max={10} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: +e.target.value }))} />
            </div>
            <div className="flex gap-2" style={{ margin: '0.75rem 0 1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                <input type="checkbox" checked={form.is_difficult} onChange={e => setForm(f => ({ ...f, is_difficult: e.target.checked }))} />
                Difficult subject
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                <input type="checkbox" checked={form.is_lab} onChange={e => setForm(f => ({ ...f, is_lab: e.target.checked }))} />
                Lab subject
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : subject ? 'Update' : 'Add Subject'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default function SubjectsPage() {
  const { fetchData, saveData, subjects, lessonBlocks, loading } = useDataStore();
  const { toast, toasts } = useToast();
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchData(); }, []);

  let filtered = subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  if (filter === 'lab') filtered = filtered.filter(s => s.is_lab);
  if (filter === 'difficult') filtered = filtered.filter(s => s.is_difficult);

  const handleSave = async (form) => {
    const isEdit = !!form.id;
    const updated = isEdit
      ? subjects.map(s => s.id === form.id ? { ...s, ...form } : s)
      : [...subjects, { ...form, id: crypto.randomUUID() }];
    await saveData({ subjects: updated });
    toast.success(isEdit ? 'Subject updated.' : 'Subject added.');
    await fetchData();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this subject?')) return;
    try {
      await saveData({ subjects: subjects.filter(s => s.id !== id) });
      toast.success('Subject deleted.');
      await fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const blockCount = (sid) => lessonBlocks.filter(lb => lb.subject_ids?.includes(sid)).length;

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">{subjects.length} subjects · {subjects.filter(s => s.is_lab).length} labs · {subjects.filter(s => s.is_difficult).length} difficult</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Subject</button>
      </div>

      <div className="flex items-center gap-2 section">
        <input className="form-input" style={{ maxWidth: 260 }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="tab-bar" style={{ margin: 0 }}>
          {['all', 'lab', 'difficult'].map(f => (
            <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'lab' ? '🧪 Lab' : '⚠️ Difficult'}
            </button>
          ))}
        </div>
      </div>

      {loading && !subjects.length ? (
        <div className="loader-overlay"><div className="spinner"></div><span>Loading…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📚</div><p>No subjects found.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Short</th>
                <th>Priority</th>
                <th>Flags</th>
                <th>Lesson Blocks</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td><span className="badge gray mono">{s.short_name || '—'}</span></td>
                  <td><span className="badge blue">P{s.priority}</span></td>
                  <td>
                    {s.is_lab && <span className="badge green">Lab</span>}
                    {s.is_difficult && <span className="badge red">Difficult</span>}
                    {!s.is_lab && !s.is_difficult && <span className="text-muted text-xs">—</span>}
                  </td>
                  <td><span className={`badge ${blockCount(s.id) > 0 ? 'blue' : 'gray'}`}>{blockCount(s.id)}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(s)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <SubjectModal
          subject={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
