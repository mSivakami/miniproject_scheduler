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

export const useMiniGroupStore = create((set) => ({
  groups: [],
  loading: false,
  error: null,

  fetchGroups: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API}/api/mini-groups`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch mini-groups');
      const groups = await res.json();
      set({ groups });
    } catch (e) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  createGroup: async (data) => {
    const res = await fetch(`${API}/api/mini-groups`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Create failed');
    }
    const group = await res.json();
    set(state => ({ groups: [...state.groups, group] }));
    return group;
  },

  updateGroup: async (id, data) => {
    const res = await fetch(`${API}/api/mini-groups/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Update failed');
    }
    const group = await res.json();
    set(state => ({
      groups: state.groups.map(g => g.id === id ? group : g),
    }));
    return group;
  },

  deleteGroup: async (id) => {
    const res = await fetch(`${API}/api/mini-groups/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Delete failed');
    set(state => ({ groups: state.groups.filter(g => g.id !== id) }));
  },
}));
