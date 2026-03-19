// services/api.ts
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export const fetchBootstrap = () => request<any>("/bootstrap");

// ── Batch save ────────────────────────────────────────────────────────────────

export const saveAll = (body: any) =>
  request<any>("/save-all", { method: "POST", body: JSON.stringify(body) });

// ── Generation ────────────────────────────────────────────────────────────────

export const startGeneration = () =>
  request<{ job_id: string }>("/generate", { method: "POST" });

export const pollStatus = (jobId: string) => request<any>(`/status/${jobId}`);

export const fetchResult = (jobId: string) => request<any>(`/result/${jobId}`);

// ── Utility ───────────────────────────────────────────────────────────────────

export const reloadStore = () =>
  request<any>("/reload-store", { method: "POST" });
