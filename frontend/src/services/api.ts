// services/api.ts
import { getSessionToken } from "../auth";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getSessionToken();

  if (!token) {
    window.location.href = "/auth/sign-in";
    throw new Error("Not authenticated — redirecting to sign-in");
  }

  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
    ...init,
  });

  if (res.status === 401) {
    window.location.href = "/auth/sign-in";
    throw new Error("Session expired — please sign in again");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  return res.json();
}


export const fetchBootstrap = () => request<any>("/bootstrap");
export const saveAll = (body: any) =>
  request<any>("/save-all", { method: "POST", body: JSON.stringify(body) });
export const startGeneration = () =>
  request<{ job_id: string }>("/generate", { method: "POST" });
export const pollStatus = (id: string) => request<any>(`/status/${id}`);
export const fetchResult = (id: string) => request<any>(`/result/${id}`);
export const reloadStore = () =>
  request<any>("/reload-store", { method: "POST" });

export const exportPdf = async (jobId: string, entries: any[]) => {
  const token = await getSessionToken();
  const res = await fetch(`${BASE}/export-pdf/${jobId}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) throw new Error("PDF export failed");
  return res.blob();
};