/**
 * auth/client.ts
 * Thin JWT auth client for the AutoScheduler backend.
 * Stores the token in localStorage. No Neon dependency.
 */

const TOKEN_KEY = 'autoscheduler_token';
const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000');

export interface AuthUser {
  id: string;
  username: string;
  role: 'account';
}

interface AuthStatusResponse {
  setup_required: boolean;
}

// ─── Token helpers ────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Returns the JWT token for attaching to API requests, or null. */
export async function getToken(): Promise<string | null> {
  return getStoredToken();
}

// ─── Auth API calls ───────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  token_type: string;
  username: string;
  role: 'account';
}

export async function apiSetup(username: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${BASE}/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Setup failed' }));
    throw new Error(err.detail ?? 'Setup failed');
  }
  return res.json();
}

export async function apiRegister(username: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail ?? 'Registration failed');
  }
  return res.json();
}

export async function apiAuthStatus(): Promise<AuthStatusResponse> {
  const res = await fetch(`${BASE}/auth/status`);
  if (!res.ok) {
    throw new Error('Unable to determine authentication status');
  }
  return res.json();
}

export async function apiLogin(username: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail ?? 'Login failed');
  }
  return res.json();
}

export async function apiMe(): Promise<AuthUser> {
  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Session expired');
  return res.json();
}

export function signOut() {
  clearStoredToken();
}
