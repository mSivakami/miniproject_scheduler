import React, { useEffect, useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast';

function BlockModal({ block, teachers, subjects, classrooms, rooms, onClose, onSave }) {
  const blank = {
    subject_name: '', duration: 1, count: 1,
    is_lab: false, is_difficult: false, is_locked: false,
    locked_day: 0, locked_period: 0,
    teacher_ids: [], subject_ids: [], classroom_ids: [], room_ids: [],
  };
  const [form, setForm] = useState(block || blank);
  const [saving, setSaving] = useState(false);
  const { toast, toasts } = useToast();

  const toggleArr = (field, id) => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(id) ? f[field].filter(x => x !== id) : [...f[field], id],
    }));
  };

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
        <div className="modal" style={{ maxWidth: 620 }}>
          <div className="modal-title">{block ? 'Edit Lesson Block' : 'Add Lesson Block'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Subject Label *</label>
                <input className="form-input" placeholder="Display name" value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (periods)</label>
                <input className="form-input" type="number" min={1} max={4} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: +e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Count (per week)</label>
                <input className="form-input" type="number" min={1} max={10} value={form.count} onChange={e => setForm(f => ({ ...f, count: +e.target.value }))} />
              </div>
            </div>

            {/* Flags */}
            <div className="flex gap-2" style={{ margin: '0.5rem 0 1rem', flexWrap: 'wrap' }}>
              {[['is_lab', 'Lab block'], ['is_difficult', 'Difficult'], ['is_locked', 'Locked slot']].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-2)' }}>
                  <input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>

            {form.is_locked && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Locked Day (0-indexed)</label>
                  <input className="form-input" type="number" min={0} value={form.locked_day} onChange={e => setForm(f => ({ ...f, locked_day: +e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Locked Period (0-indexed)</label>
                  <input className="form-input" type="number" min={0} value={form.locked_period} onChange={e => setForm(f => ({ ...f, locked_period: +e.target.value }))} />
                </div>
              </div>
            )}

            <div className="divider" />

            {/* Teachers */}
            <div className="form-group">
              <label className="form-label">Teachers</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: 100, overflowY: 'auto' }}>
                {teachers.map(t => (
                  <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.78rem',
                    padding: '0.2rem 0.5rem', borderRadius: 4,
                    background: form.teacher_ids.includes(t.id) ? 'var(--accent-dim)' : 'var(--surface-2)',
                    border: `1px solid ${form.teacher_ids.includes(t.id) ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                    color: form.teacher_ids.includes(t.id) ? 'var(--accent)' : 'var(--text-2)',
                  }}>
                    <input type="checkbox" style={{ display: 'none' }} checked={form.teacher_ids.includes(t.id)} onChange={() => toggleArr('teacher_ids', t.id)} />
                    {t.name}
                  </label>
                ))}
              </div>
            </div>

            {/* Subjects */}
            <div className="form-group">
              <label className="form-label">Subjects</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: 80, overflowY: 'auto' }}>
                {subjects.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.78rem',
                    padding: '0.2rem 0.5rem', borderRadius: 4,
                    background: form.subject_ids.includes(s.id) ? 'var(--green-dim)' : 'var(--surface-2)',
                    border: `1px solid ${form.subject_ids.includes(s.id) ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                    color: form.subject_ids.includes(s.id) ? 'var(--green)' : 'var(--text-2)',
                  }}>
                    <input type="checkbox" style={{ display: 'none' }} checked={form.subject_ids.includes(s.id)} onChange={() => toggleArr('subject_ids', s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>

            {/* Classrooms */}
            <div className="form-group">
              <label className="form-label">Classrooms (sections)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {classrooms.map(c => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.78rem',
                    padding: '0.2rem 0.5rem', borderRadius: 4,
                    background: form.classroom_ids.includes(c.id) ? 'var(--purple-dim)' : 'var(--surface-2)',
                    border: `1px solid ${form.classroom_ids.includes(c.id) ? 'rgba(168,85,247,0.3)' : 'var(--border)'}`,
                    color: form.classroom_ids.includes(c.id) ? 'var(--purple)' : 'var(--text-2)',
                  }}>
                    <input type="checkbox" style={{ display: 'none' }} checked={form.classroom_ids.includes(c.id)} onChange={() => toggleArr('classroom_ids', c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>

            {/* Rooms */}
            <div className="form-group">
              <label className="form-label">Rooms (physical)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {rooms.map(r => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.78rem',
                    padding: '0.2rem 0.5rem', borderRadius: 4,
                    background: form.room_ids.includes(r.id) ? 'var(--cyan-dim)' : 'var(--surface-2)',
                    border: `1px solid ${form.room_ids.includes(r.id) ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
                    color: form.room_ids.includes(r.id) ? 'var(--cyan)' : 'var(--text-2)',
                  }}>
                    <input type="checkbox" style={{ display: 'none' }} checked={form.room_ids.includes(r.id)} onChange={() => toggleArr('room_ids', r.id)} />
                    {r.name}{r.is_lab ? ' 🧪' : ''}
                  </label>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : block ? 'Update Block' : 'Add Block'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default function LessonBlocksPage() {
  const { fetchData, saveData, lessonBlocks, teachers, subjects, classrooms, rooms, loading } = useDataStore();
  const { toast, toasts } = useToast();
  const [modal, setModal] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (form) => {
    const isEdit = !!form.id;
    const updated = isEdit
      ? lessonBlocks.map(lb => lb.id === form.id ? { ...lb, ...form } : lb)
      : [...lessonBlocks, { ...form, id: crypto.randomUUID() }];
    await saveData({ lesson_blocks: updated });
    toast.success(isEdit ? 'Block updated.' : 'Block added.');
    await fetchData();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this lesson block?')) return;
    try {
      await saveData({ lesson_blocks: lessonBlocks.filter(lb => lb.id !== id) });
      toast.success('Block deleted.');
      await fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const nameOf = (ids, list) => ids?.slice(0, 2).map(id => list.find(x => x.id === id)?.name || id.slice(0, 6)).join(', ') + (ids?.length > 2 ? ` +${ids.length - 2}` : '');

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Lesson Blocks</h1>
          <p className="page-subtitle">Main schedule — {lessonBlocks.length} blocks configured</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Block</button>
      </div>

      <div className="alert info section">
        Lesson blocks define what gets scheduled: each block links teachers, subjects, classrooms, and rooms with a frequency (count/week) and duration.
      </div>

      {loading && !lessonBlocks.length ? (
        <div className="loader-overlay"><div className="spinner"></div><span>Loading…</span></div>
      ) : lessonBlocks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧩</div>
          <p>No lesson blocks yet. Add your first block to start configuring the schedule.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Duration</th>
                <th>Count/Week</th>
                <th>Teachers</th>
                <th>Classrooms</th>
                <th>Rooms</th>
                <th>Flags</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {lessonBlocks.map(lb => (
                <tr key={lb.id}>
                  <td style={{ fontWeight: 600 }}>{lb.subject_name || '—'}</td>
                  <td><span className="badge blue mono">{lb.duration}p</span></td>
                  <td><span className="badge gray mono">×{lb.count}</span></td>
                  <td className="text-sm text-muted">{lb.teacher_ids?.length ? nameOf(lb.teacher_ids, teachers) : '—'}</td>
                  <td className="text-sm text-muted">{lb.classroom_ids?.length ? nameOf(lb.classroom_ids, classrooms) : '—'}</td>
                  <td className="text-sm text-muted">{lb.room_ids?.length ? nameOf(lb.room_ids, rooms) : '—'}</td>
                  <td>
                    {lb.is_lab && <span className="badge green">Lab</span>}
                    {lb.is_difficult && <span className="badge red">Diff</span>}
                    {lb.is_locked && <span className="badge yellow">🔒</span>}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(lb)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(lb.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <BlockModal
          block={modal === 'add' ? null : modal}
          teachers={teachers}
          subjects={subjects}
          classrooms={classrooms}
          rooms={rooms}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
