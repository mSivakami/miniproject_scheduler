import { create } from 'zustand';
import { useAuthStore } from './authStore';

const API = '';

function authHeaders() {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const useTimetableStore = create((set) => ({
  timetables: [],
  activeTimetable: null,
  loading: false,

  fetchTimetables: async () => {
    set({ loading: true });
    try {
      const res = await fetch(`${API}/api/timetables`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
      const timetables = await res.json();
      set({ timetables });
    } finally {
      set({ loading: false });
    }
  },

  fetchTimetable: async (id) => {
    const res = await fetch(`${API}/api/timetables/${id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Not found');
    const tt = await res.json();
    set({ activeTimetable: tt });
    return tt;
  },

  saveTimetable: async (data) => {
    const res = await fetch(`${API}/api/timetables`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Save failed');
    }
    const tt = await res.json();
    set(state => ({ timetables: [tt, ...state.timetables] }));
    return tt;
  },

  deleteTimetable: async (id) => {
    const res = await fetch(`${API}/api/timetables/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Delete failed');
    set(state => ({
      timetables: state.timetables.filter(t => t.id !== id),
      activeTimetable: state.activeTimetable?.id === id ? null : state.activeTimetable,
    }));
  },

  renameTimetable: async (id, name) => {
    const res = await fetch(`${API}/api/timetables/${id}/name?name=${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Rename failed');
    set(state => ({
      timetables: state.timetables.map(t => t.id === id ? { ...t, name } : t),
    }));
  },
}));
