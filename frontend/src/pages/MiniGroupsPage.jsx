import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMiniGroupStore } from '../store/miniGroupStore';
import { useDataStore } from '../store/dataStore';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast';

function GroupModal({ group, onClose, onSave }) {
  const [form, setForm] = useState(
    group || { name: '', slot_index: 0, days_per_week: 5, periods_per_day: 7, break_after_period: 3 }
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
          <div className="modal-title">{group ? 'Edit Mini Group' : 'Create Mini Group'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Group Name *</label>
                <input className="form-input" placeholder="e.g. Group A" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Slot Index</label>
                <input className="form-input" type="number" min={0} value={form.slot_index} onChange={e => setForm(f => ({ ...f, slot_index: +e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Days / Week</label>
                <input className="form-input" type="number" min={1} max={7} value={form.days_per_week} onChange={e => setForm(f => ({ ...f, days_per_week: +e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Periods / Day</label>
                <input className="form-input" type="number" min={1} max={12} value={form.periods_per_day} onChange={e => setForm(f => ({ ...f, periods_per_day: +e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Break After Period</label>
              <input className="form-input" type="number" min={1} value={form.break_after_period} onChange={e => setForm(f => ({ ...f, break_after_period: +e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : group ? 'Update' : 'Create Group'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function MiniGroupBlocksModal({ group, onClose }) {
  const { fetchData, saveData, teachers, subjects, classrooms, rooms, miniGroupData } = useDataStore();
  const [lessonBlocks, setLessonBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast, toasts } = useToast();
  const [modal2, setModal2] = useState(null);

  useEffect(() => {
    fetchData(group.id).then(() => setLoading(false));
  }, [group.id]);

  useEffect(() => {
    const gd = miniGroupData[group.id];
    if (gd) setLessonBlocks(gd.lessonBlocks || []);
  }, [miniGroupData, group.id]);

  const handleSave = async (form) => {
    const isEdit = !!form.id;
    const updated = isEdit
      ? lessonBlocks.map(lb => lb.id === form.id ? { ...lb, ...form } : lb)
      : [...lessonBlocks, { ...form, id: crypto.randomUUID() }];
    await saveData({ lesson_blocks: updated }, group.id);
    toast.success(isEdit ? 'Block updated.' : 'Block added.');
    setModal2(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this lesson block?')) return;
    try {
      await saveData({ lesson_blocks: lessonBlocks.filter(lb => lb.id !== id) }, group.id);
      toast.success('Block deleted.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleArr = (form, setForm, field, id) => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(id) ? f[field].filter(x => x !== id) : [...f[field], id],
    }));
  };

  const nameOf = (ids, list) => ids?.slice(0, 2).map(id => list.find(x => x.id === id)?.name || id.slice(0, 6)).join(', ') + (ids?.length > 2 ? ` +${ids.length - 2}` : '');

  return (
    <>
      <ToastContainer toasts={toasts} />
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 700 }}>
          <div className="flex items-center justify-between mb-2">
            <div className="modal-title" style={{ marginBottom: 0 }}>
              📦 {group.name} — Lesson Blocks
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setModal2('add')}>+ Add Block</button>
          </div>
          <div className="text-xs text-muted mono mb-2">
            {group.days_per_week}d · {group.periods_per_day}p · break after P{group.break_after_period}
          </div>

          {loading ? (
            <div className="loader-overlay"><div className="spinner"></div><span>Loading blocks…</span></div>
          ) : lessonBlocks.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-icon">🧩</div>
              <p>No lesson blocks for this mini group yet.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Dur</th>
                    <th>×/Wk</th>
                    <th>Teachers</th>
                    <th>Classrooms</th>
                    <th></th>
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
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal2(lb)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(lb.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="modal-footer">
            <Link to={`/generate?group=${group.id}`}>
              <button className="btn btn-success" onClick={onClose}>⚡ Generate Timetable</button>
            </Link>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {modal2 && (() => {
        const isEdit = modal2 !== 'add';
        const blank = {
          subject_name: '', duration: 1, count: 1,
          is_lab: false, is_difficult: false, is_locked: false,
          locked_day: 0, locked_period: 0,
          teacher_ids: [], subject_ids: [], classroom_ids: [], room_ids: [],
        };
        const [blockForm, setBlockForm] = React.useState(isEdit ? modal2 : blank);
        const [saving, setSaving] = React.useState(false);

        const handleBlockSubmit = async (e) => {
          e.preventDefault();
          setSaving(true);
          try { await handleSave(blockForm); }
          catch (err) { toast.error(err.message); }
          finally { setSaving(false); }
        };

        const tglArr = (field, id) => setBlockForm(f => ({
          ...f, [field]: f[field].includes(id) ? f[field].filter(x => x !== id) : [...f[field], id],
        }));

        return (
          <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && setModal2(null)}>
            <div className="modal" style={{ maxWidth: 580 }}>
              <div className="modal-title">{isEdit ? 'Edit Block' : 'Add Block'} — {group.name}</div>
              <form onSubmit={handleBlockSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Subject Label *</label>
                    <input className="form-input" value={blockForm.subject_name} onChange={e => setBlockForm(f => ({ ...f, subject_name: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duration</label>
                    <input className="form-input" type="number" min={1} max={4} value={blockForm.duration} onChange={e => setBlockForm(f => ({ ...f, duration: +e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Count / Week</label>
                  <input className="form-input" type="number" min={1} max={10} value={blockForm.count} onChange={e => setBlockForm(f => ({ ...f, count: +e.target.value }))} />
                </div>
                <div className="flex gap-2" style={{ margin: '0.5rem 0 0.75rem' }}>
                  {[['is_lab', 'Lab'], ['is_difficult', 'Difficult'], ['is_locked', 'Locked']].map(([key, lbl]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-2)' }}>
                      <input type="checkbox" checked={blockForm[key]} onChange={e => setBlockForm(f => ({ ...f, [key]: e.target.checked }))} />
                      {lbl}
                    </label>
                  ))}
                </div>
                <div className="form-group">
                  <label className="form-label">Teachers</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {teachers.map(t => (
                      <label key={t.id} onClick={() => tglArr('teacher_ids', t.id)} style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem', borderRadius: 4, cursor: 'pointer',
                        background: blockForm.teacher_ids.includes(t.id) ? 'var(--accent-dim)' : 'var(--surface-2)',
                        border: `1px solid ${blockForm.teacher_ids.includes(t.id) ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                        color: blockForm.teacher_ids.includes(t.id) ? 'var(--accent)' : 'var(--text-2)',
                      }}>{t.name}</label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Classrooms</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {classrooms.map(c => (
                      <label key={c.id} onClick={() => tglArr('classroom_ids', c.id)} style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem', borderRadius: 4, cursor: 'pointer',
                        background: blockForm.classroom_ids.includes(c.id) ? 'var(--purple-dim)' : 'var(--surface-2)',
                        border: `1px solid ${blockForm.classroom_ids.includes(c.id) ? 'rgba(168,85,247,0.3)' : 'var(--border)'}`,
                        color: blockForm.classroom_ids.includes(c.id) ? 'var(--purple)' : 'var(--text-2)',
                      }}>{c.name}</label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Rooms</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {rooms.map(r => (
                      <label key={r.id} onClick={() => tglArr('room_ids', r.id)} style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem', borderRadius: 4, cursor: 'pointer',
                        background: blockForm.room_ids.includes(r.id) ? 'var(--cyan-dim)' : 'var(--surface-2)',
                        border: `1px solid ${blockForm.room_ids.includes(r.id) ? 'rgba(6,182,212,0.3)' : 'var(--border)'}`,
                        color: blockForm.room_ids.includes(r.id) ? 'var(--cyan)' : 'var(--text-2)',
                      }}>{r.name}</label>
                    ))}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setModal2(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : isEdit ? 'Update' : 'Add Block'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </>
  );
}

export default function MiniGroupsPage() {
  const { fetchGroups, createGroup, updateGroup, deleteGroup, groups, loading } = useMiniGroupStore();
  const { toast, toasts } = useToast();
  const [modal, setModal] = useState(null);
  const [blocksModal, setBlocksModal] = useState(null);

  useEffect(() => { fetchGroups(); }, []);

  const handleSave = async (form) => {
    if (form.id) {
      await updateGroup(form.id, form);
      toast.success('Group updated.');
    } else {
      await createGroup(form);
      toast.success('Mini group created.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this mini group and all its lesson blocks?')) return;
    try {
      await deleteGroup(id);
      toast.success('Mini group deleted.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Mini Groups</h1>
          <p className="page-subtitle">Alternate timetable slots — max 2 per institution</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setModal('add')}
          disabled={groups.length >= 2}
          title={groups.length >= 2 ? 'Max 2 mini groups allowed' : ''}
        >
          + Create Group
        </button>
      </div>

      <div className="alert info section">
        Mini Groups let you define an alternate schedule configuration (different days/periods) with their own set of lesson blocks. Each group can generate its own independent timetable.
      </div>

      {loading ? (
        <div className="loader-overlay"><div className="spinner"></div><span>Loading…</span></div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔀</div>
          <p>No mini groups yet. Create one to configure an alternate schedule.</p>
        </div>
      ) : (
        <div className="grid-2">
          {groups.map(g => (
            <div key={g.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{g.name}</div>
                  <div className="text-xs text-muted mono mt-1">ID: {g.id?.slice(0, 8)}…</div>
                </div>
                <span className="badge purple">Slot {g.slot_index}</span>
              </div>

              <div className="divider" />

              <div className="grid-2" style={{ gap: '0.5rem', marginTop: '0.75rem' }}>
                <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                  <div className="stat-label">Days / Week</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem' }}>{g.days_per_week}</div>
                </div>
                <div className="stat-card" style={{ padding: '0.75rem 1rem' }}>
                  <div className="stat-label">Periods / Day</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem' }}>{g.periods_per_day}</div>
                </div>
              </div>
              <div className="text-xs text-muted mt-1">
                Break after period {g.break_after_period}
              </div>

              <div className="flex gap-1 mt-2">
                <button className="btn btn-secondary btn-sm" onClick={() => setBlocksModal(g)}>📦 Lesson Blocks</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setModal(g)}>Edit</button>
                <Link to={`/generate?group=${g.id}`}>
                  <button className="btn btn-success btn-sm">⚡ Generate</button>
                </Link>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(g.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <GroupModal
          group={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {blocksModal && (
        <MiniGroupBlocksModal
          group={blocksModal}
          onClose={() => setBlocksModal(null)}
        />
      )}
    </div>
  );
}
