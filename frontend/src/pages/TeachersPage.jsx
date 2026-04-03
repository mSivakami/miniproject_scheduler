import React, { useEffect, useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast';

function TeacherModal({ teacher, onClose, onSave }) {
  const [form, setForm] = useState(
    teacher || { name: '', short_name: '', max_per_day: 6, max_per_week: 30, available_mask: -1 }
  );
  const [saving, setSaving] = useState(false);
  const { toast, toasts } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} />
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="modal-title">{teacher ? 'Edit Teacher' : 'Add Teacher'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Short Name</label>
                <input className="form-input" value={form.short_name || ''} placeholder="e.g. JD" onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Max / Day</label>
                <input className="form-input" type="number" min={1} max={12} value={form.max_per_day} onChange={e => setForm(f => ({ ...f, max_per_day: +e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Max / Week</label>
              <input className="form-input" type="number" min={1} max={60} value={form.max_per_week} onChange={e => setForm(f => ({ ...f, max_per_week: +e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : teacher ? 'Update' : 'Add Teacher'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default function TeachersPage() {
  const { fetchData, saveData, teachers, subjects, lessonBlocks, loading } = useDataStore();
  const { toast, toasts } = useToast();
  const [modal, setModal] = useState(null); // null | 'add' | teacher object
  const [search, setSearch] = useState('');

  useEffect(() => { fetchData(); }, []);

  const filtered = teachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.short_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (form) => {
    const isEdit = !!form.id;
    const existing = teachers.map(t => t.id === form.id ? { ...t, ...form } : t);
    const updated = isEdit ? existing : [...teachers, { ...form, id: crypto.randomUUID() }];
    await saveData({ teachers: updated });
    toast.success(isEdit ? 'Teacher updated.' : 'Teacher added.');
    await fetchData();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this teacher?')) return;
    try {
      await saveData({ teachers: teachers.filter(t => t.id !== id) });
      toast.success('Teacher deleted.');
      await fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Count how many lesson blocks a teacher is used in
  const teacherBlockCount = (tid) =>
    lessonBlocks.filter(lb => lb.teacher_ids?.includes(tid)).length;

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="page-subtitle">{teachers.length} teacher{teachers.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Teacher</button>
      </div>

      <div className="section">
        <input
          className="form-input"
          style={{ maxWidth: 320 }}
          placeholder="Search teachers…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading && !teachers.length ? (
        <div className="loader-overlay"><div className="spinner"></div><span>Loading…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <p>{search ? 'No teachers match your search.' : 'No teachers yet. Add your first teacher.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Short</th>
                <th>Max / Day</th>
                <th>Max / Week</th>
                <th>Lesson Blocks</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td><span className="badge gray mono">{t.short_name || '—'}</span></td>
                  <td className="mono">{t.max_per_day}</td>
                  <td className="mono">{t.max_per_week}</td>
                  <td>
                    <span className={`badge ${teacherBlockCount(t.id) > 0 ? 'blue' : 'gray'}`}>
                      {teacherBlockCount(t.id)} block{teacherBlockCount(t.id) !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(t)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <TeacherModal
          teacher={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
