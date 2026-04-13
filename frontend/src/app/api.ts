/**
 * api.ts — All HTTP calls to the AutoScheduler FastAPI backend.
 * Routes match backend/main.py exactly.
 */
import { getToken } from './auth/client';

const BASE = 'http://localhost:8000'; //import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(method: string, url: string, status: number, detail: string) {
    super(`${method} ${url} -> ${status}: ${detail}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

// ─── Core fetch wrapper ────────────────────────────────────────────────────

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try { detail = JSON.parse(text).detail ?? text; } catch { }
    throw new ApiError(method, url, res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function api_url(path: string) { return `${BASE}${path}`; }

// ─── Types matching backend schemas ───────────────────────────────────────

export interface InstitutionOut {
  id: string;
  name: string;
  days_per_week: number;
  periods_per_day: number;
  break_after_period: number;
  break_mask: number | string;
  working_slot_mask: number | string;
}

export interface TeacherOut {
  id: string;
  name: string;
  short_name: string | null;
  available_mask: number | string;
  max_per_day: number;
  max_per_week: number;
}

export interface SubjectOut {
  id: string;
  name: string;
  short_name: string | null;
  is_difficult: boolean;
  is_lab: boolean;
  priority: number;
}

export interface RoomOut {
  id: string;
  name: string;
  short_name: string | null;
  is_lab: boolean;
  capacity: number;
}

export interface ClassroomOut {
  id: string;
  name: string;
  short_name: string | null;
  capacity: number;
}

export interface LessonBlockOut {
  id: string;
  duration: number;
  count: number;
  is_locked: boolean;
  locked_day: number | null;
  locked_period: number | null;
  is_lab: boolean;
  is_difficult: boolean;
  subject_name: string | null;
  teacher_ids: string[];
  subject_ids: string[];
  classroom_ids: string[];
  room_ids: string[];
  mini_group_id: string | null;
}

export interface ConstraintSettingsOut {
  settings_json: string;
  constraint_mask: number;
  is_active: boolean;
}

export interface AllDataOut {
  institution: InstitutionOut;
  teachers: TeacherOut[];
  subjects: SubjectOut[];
  rooms: RoomOut[];
  classrooms: ClassroomOut[];
  lesson_blocks: LessonBlockOut[];
  constraint_settings: ConstraintSettingsOut | null;
}

export interface TimetableEntryOut {
  day: number;
  period: number;
  duration: number;
  teacher_ids: string[];
  subject_ids: string[];
  classroom_ids: string[];
  room_ids: string[];
  block_id: string;
  subject_name: string | null;
}

export interface ViolationDetailOut {
  type: string;
  description: string;
  block_id: string;
}

export interface GenerateResponse {
  status: string;
  fitness: number;
  quality_pct: number;
  hard_violations: number;
  soft_violations: number;
  generations: number;
  time_ms: number;
  lessons_placed: number;
  total_lessons: number;
  preflight_ok: boolean;
  preflight_errors: string[];
  preflight_warnings: string[];
  violation_details: ViolationDetailOut[];
  timetable: Record<string, unknown>;
}

export interface TimetableOut {
  id: string;
  name: string;
  fitness_score: number | null;
  hard_violations: number | null;
  soft_violations: number | null;
  created_at: string;
}

export interface MiniGroupCreate {
  id?: string;
  name: string;
  slot_index?: number;
  days_per_week?: number;
  periods_per_day?: number;
  break_after_period?: number;
  teacher_time_off_overrides?: string;
  selected_teacher_ids?: string;
  selected_class_ids?: string;
  selected_room_ids?: string;
  selected_subject_ids?: string;
  constraint_mask?: number;
}

export interface MiniGroupOut extends MiniGroupCreate {
  id: string;
  break_mask: string;
  working_slot_mask: string;
  constraint_mask: number;
  created_at: string;
}

export interface TimetableDetailOut extends TimetableOut {
  timetable_json: string;
}

// ─── API surface ──────────────────────────────────────────────────────────

export const api = {

  // Health check (public)
  health(): Promise<{ status: string }> {
    return request('GET', api_url('/api/health'));
  },

  // Load full data state
  getAllData(miniGroupId?: string): Promise<AllDataOut> {
    const qs = miniGroupId ? `?mini_group_id=${miniGroupId}` : '';
    return request('GET', api_url(`/api/data${qs}`));
  },

  // Save / sync full state
  syncAllData(data: object, miniGroupId?: string): Promise<AllDataOut> {
    const qs = miniGroupId ? `?mini_group_id=${miniGroupId}` : '';
    return request('POST', api_url(`/api/data${qs}`), data);
  },

  // Run GA — synchronous, returns result directly (no polling)
  generate(opts?: {
    max_generations?: number;
    population_size?: number;
    time_limit_seconds?: number;
    seed?: number | null;
    fast_mode?: boolean;
    constraint_mask?: number;
  }): Promise<GenerateResponse> {
    return request('POST', api_url('/api/generate/main'), opts ?? {});
  },

  // Generate for a mini-group
  generateMini(groupId: string, opts?: object): Promise<GenerateResponse> {
    return request('POST', api_url(`/api/generate/mini/${groupId}`), opts ?? {});
  },

  // Mini-Groups CRUD
  listMiniGroups(): Promise<MiniGroupOut[]> {
    return request('GET', api_url('/api/mini-groups'));
  },
  createMiniGroup(data: MiniGroupCreate): Promise<MiniGroupOut> {
    return request('POST', api_url('/api/mini-groups'), data);
  },
  updateMiniGroup(id: string, data: MiniGroupCreate): Promise<MiniGroupOut> {
    return request('PUT', api_url(`/api/mini-groups/${id}`), data);
  },
  deleteMiniGroup(id: string): Promise<void> {
    return request('DELETE', api_url(`/api/mini-groups/${id}`));
  },

  // Saved timetables
  listTimetables(): Promise<TimetableOut[]> {
    return request('GET', api_url('/api/timetables'));
  },
  getTimetable(id: string): Promise<TimetableDetailOut> {
    return request('GET', api_url(`/api/timetables/${id}`));
  },
  saveTimetable(data: { name: string; timetable_json: string; fitness_score?: number; hard_violations?: number; soft_violations?: number }): Promise<TimetableOut> {
    return request('POST', api_url('/api/timetables'), data);
  },
  updateTimetable(id: string, data: { name: string; timetable_json: string; fitness_score?: number; hard_violations?: number; soft_violations?: number }): Promise<TimetableOut> {
    return request('PUT', api_url(`/api/timetables/${id}`), data);
  },
  deleteTimetable(id: string): Promise<void> {
    return request('DELETE', api_url(`/api/timetables/${id}`));
  },
  renameTimetable(id: string, name: string): Promise<void> {
    return request('PUT', api_url(`/api/timetables/${id}/name?name=${encodeURIComponent(name)}`));
  },
};

