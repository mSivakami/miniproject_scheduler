import React, { useEffect, useState } from 'react';
import { useDataStore } from '../store/dataStore';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast';

function RoomModal({ room, onClose, onSave }) {
  const [form, setForm] = useState(room || { name: '', is_lab: false, available_mask: -1 });
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
          <div className="modal-title">{room ? 'Edit Room' : 'Add Room'}</div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Room Name *</label>
              <input className="form-input" placeholder="e.g. Lab 101" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="flex gap-2" style={{ margin: '0.75rem 0 1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                <input type="checkbox" checked={form.is_lab} onChange={e => setForm(f => ({ ...f, is_lab: e.target.checked }))} />
                This is a lab room
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : room ? 'Update' : 'Add Room'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default function RoomsPage() {
  const { fetchData, saveData, rooms, lessonBlocks, loading } = useDataStore();
  const { toast, toasts } = useToast();
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchData(); }, []);

  const filtered = rooms.filter(r => filter === 'all' || (filter === 'lab' ? r.is_lab : !r.is_lab));

  const handleSave = async (form) => {
    const isEdit = !!form.id;
    const updated = isEdit
      ? rooms.map(r => r.id === form.id ? { ...r, ...form } : r)
      : [...rooms, { ...form, id: crypto.randomUUID() }];
    await saveData({ rooms: updated });
    toast.success(isEdit ? 'Room updated.' : 'Room added.');
    await fetchData();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this room?')) return;
    try {
      await saveData({ rooms: rooms.filter(r => r.id !== id) });
      toast.success('Room deleted.');
      await fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const blockCount = (rid) => lessonBlocks.filter(lb => lb.room_ids?.includes(rid)).length;

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Rooms</h1>
          <p className="page-subtitle">Physical rooms & labs — {rooms.length} configured · {rooms.filter(r => r.is_lab).length} labs</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Room</button>
      </div>

      <div className="tab-bar section">
        {['all', 'regular', 'lab'].map(f => (
          <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? `All (${rooms.length})` : f === 'lab' ? `🧪 Labs (${rooms.filter(r => r.is_lab).length})` : `Regular (${rooms.filter(r => !r.is_lab).length})`}
          </button>
        ))}
      </div>

      {loading && !rooms.length ? (
        <div className="loader-overlay"><div className="spinner"></div><span>Loading…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🏢</div><p>No rooms found.</p></div>
      ) : (
        <div className="grid-auto">
          {filtered.map(r => (
            <div key={r.id} className="item-card">
              <div className="flex items-center justify-between mb-1">
                <div className="item-name">{r.name}</div>
                <div className="flex gap-1">
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal(r)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>✕</button>
                </div>
              </div>
              <div className="flex gap-1 mt-1">
                {r.is_lab
                  ? <span className="badge green">Lab Room</span>
                  : <span className="badge gray">Regular</span>
                }
                <span className={`badge ${blockCount(r.id) > 0 ? 'blue' : 'gray'}`}>
                  {blockCount(r.id)} block{blockCount(r.id) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <RoomModal
          room={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
