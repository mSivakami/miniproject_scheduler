import { create } from 'zustand';

const API = '';

export const useAuthStore = create((set, get) => ({
  token: localStorage.getItem('token') || '',
  user: null,
  health: null,

  setToken: (token) => {
    localStorage.setItem('token', token);
    set({ token });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: '', user: null });
  },

  checkHealth: async () => {
    try {
      const res = await fetch(`${API}/api/health`);
      const json = await res.json();
      set({ health: json });
    } catch {
      set({ health: { status: 'error', service: 'Unreachable' } });
    }
  },

  fetchMe: async () => {
    const { token } = get();
    if (!token) return null;
    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        set({ user });
        return user;
      } else {
        get().logout();
        return null;
      }
    } catch {
      get().logout();
      return null;
    }
  },

  login: async (username, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }
    const { access_token } = await res.json();
    get().setToken(access_token);
    return get().fetchMe();
  },
}));
