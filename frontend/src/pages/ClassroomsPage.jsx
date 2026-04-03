import React, { useEffect, useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast';

function ClassroomModal({ classroom, onClose, onSave }) {
  const [form, setForm] = useState(classroom || { name: '', capacity: 40 });
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
          <div className="modal-title">{classroom ? 'Edit Classroom' : 'Add Classroom'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Section Name *</label>
              <input
                className="form-input"
                placeholder="e.g. Sem 2A"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Capacity</label>
              <input
                className="form-input"
                type="number"
                min={1}
                max={500}
                value={form.capacity}
                onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : classroom ? 'Update' : 'Add Classroom'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default function ClassroomsPage() {
  const { fetchData, saveData, classrooms, lessonBlocks, loading } = useDataStore();
  const { toast, toasts } = useToast();
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchData(); }, []);

  const filtered = classrooms.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (form) => {
    const isEdit = !!form.id;
    const updated = isEdit
      ? classrooms.map(c => c.id === form.id ? { ...c, ...form } : c)
      : [...classrooms, { ...form, id: crypto.randomUUID() }];
    await saveData({ classrooms: updated });
    toast.success(isEdit ? 'Classroom updated.' : 'Classroom added.');
    await fetchData();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this classroom? This may affect lesson blocks.')) return;
    try {
      await saveData({ classrooms: classrooms.filter(c => c.id !== id) });
      toast.success('Classroom deleted.');
      await fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const blockCount = (cid) => lessonBlocks.filter(lb => lb.classroom_ids?.includes(cid)).length;

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Classrooms</h1>
          <p className="page-subtitle">Student sections / classes — {classrooms.length} configured</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Classroom</button>
      </div>

      <div className="alert info section">
        <strong>Note:</strong> "Classrooms" here means student sections/classes (e.g., Sem 2A), <em>not</em> physical rooms. Use <strong>Rooms</strong> for physical spaces.
      </div>

      <div className="section">
        <input
          className="form-input"
          style={{ maxWidth: 320 }}
          placeholder="Search classrooms…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading && !classrooms.length ? (
        <div className="loader-overlay"><div className="spinner"></div><span>Loading…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏫</div>
          <p>{search ? 'No classrooms match your search.' : 'No classrooms yet.'}</p>
        </div>
      ) : (
        <div className="grid-auto">
          {filtered.map(c => (
            <div key={c.id} className="item-card">
              <div className="flex items-center justify-between mb-1">
                <div className="item-name">{c.name}</div>
                <div className="flex gap-1">
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(c)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>✕</button>
                </div>
              </div>
              <div className="flex gap-1 mt-1">
                <span className="badge gray">Cap: {c.capacity}</span>
                <span className={`badge ${blockCount(c.id) > 0 ? 'blue' : 'gray'}`}>
                  {blockCount(c.id)} block{blockCount(c.id) !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="item-meta mt-1">ID: <span className="mono">{c.id?.slice(0, 8)}…</span></div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ClassroomModal
          classroom={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
