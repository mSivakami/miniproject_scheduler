/**
 * useStore.ts — Zustand store for AutoScheduler
 * 
 * Internal data model keeps the original field names (subject_id, class_ids, sessions)
 * that all existing pages rely on. Translation to backend schema happens only in saveAll().
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, AllDataOut, ApiError, GenerateResponse, MiniGroupOut, MiniGroupCreate } from '../api';
import { runGA } from '../ga/scheduler';
import type { SchedulerConstraints } from '../ga/scheduler';
import { toast } from 'sonner';

// ─── Constraint loader ────────────────────────────────────────────────────

const CONSTRAINTS_KEY = 'autoscheduler_constraints';
const SESSION_BLOCK_ID_RE = /^(.*)__session_(\d+)(?:__(locked|rest))?$/;

interface StoredConstraint {
  id: string;
  enabled: boolean;
  weight: number;
}

function loadStoredConstraintItems(): StoredConstraint[] | null {
  try {
    const raw = localStorage.getItem(CONSTRAINTS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as StoredConstraint[];
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { constraints?: unknown }).constraints)) {
      return (parsed as { constraints: StoredConstraint[] }).constraints;
    }
  } catch { }

  return null;
}

function persistStoredConstraintItems(constraints: StoredConstraint[] | null) {
  if (!constraints) return;
  localStorage.setItem(CONSTRAINTS_KEY, JSON.stringify(constraints));
}

function normalizeBreaks(breaks: Break[], numDays: number, numPeriods: number): Break[] {
  const uniq = new Map<string, Break>();

  for (const item of breaks ?? []) {
    if (item.day < 0 || item.day >= numDays || item.period < 0 || item.period >= numPeriods) continue;
    uniq.set(`${item.day}_${item.period}`, { day: item.day, period: item.period });
  }

  return Array.from(uniq.values()).sort((a, b) => a.day - b.day || a.period - b.period);
}

function deriveDefaultBreaks(numDays: number, numPeriods: number, breakAfterPeriod: number): Break[] {
  if (breakAfterPeriod < 0 || breakAfterPeriod >= numPeriods) return [];
  return Array.from({ length: numDays }, (_, day) => ({ day, period: breakAfterPeriod }));
}

function parseConstraintSettings(
  settingsJson: string | null | undefined,
  numDays: number,
  numPeriods: number,
  breakAfterPeriod: number,
): { breaks: Break[]; constraints: StoredConstraint[] | null } {
  const fallbackBreaks = deriveDefaultBreaks(numDays, numPeriods, breakAfterPeriod);
  if (!settingsJson) return { breaks: fallbackBreaks, constraints: null };

  try {
    const parsed = JSON.parse(settingsJson);
    if (Array.isArray(parsed)) {
      return { breaks: fallbackBreaks, constraints: parsed as StoredConstraint[] };
    }

    if (parsed && typeof parsed === 'object') {
      const payload = parsed as { breaks?: Break[]; constraints?: StoredConstraint[] };
      return {
        breaks: Array.isArray(payload.breaks)
          ? normalizeBreaks(payload.breaks, numDays, numPeriods)
          : fallbackBreaks,
        constraints: Array.isArray(payload.constraints) ? payload.constraints : null,
      };
    }
  } catch { }

  return { breaks: fallbackBreaks, constraints: null };
}

function buildConstraintSettingsPayload(breaks: Break[]): string {
  return JSON.stringify({
    version: 1,
    breaks,
    constraints: loadStoredConstraintItems() ?? [],
  });
}

function getBackendLessonRootId(blockId: string): string {
  const match = blockId.match(SESSION_BLOCK_ID_RE);
  return match ? match[1] : blockId;
}

function buildSessionBlockId(lessonId: string, sessionIndex: number, variant: 'main' | 'locked' | 'rest' = 'main'): string {
  const baseId = getBackendLessonRootId(lessonId);
  if (variant === 'main') return `${baseId}__session_${sessionIndex}`;
  return `${baseId}__session_${sessionIndex}__${variant}`;
}

function clampSessionDuration(duration: number): 1 | 2 | 3 {
  return Math.max(1, Math.min(3, duration)) as 1 | 2 | 3;
}

function availabilityMaskToUnavailableSlots(
  maskValue: string | number,
  numDays: number,
  numPeriods: number,
  breaks: Break[],
): Break[] {
  if (maskValue === -1 || maskValue === '-1') return [];

  let mask: bigint;
  try {
    mask = BigInt(maskValue);
  } catch {
    return [];
  }

  const breakKeys = new Set(normalizeBreaks(breaks, numDays, numPeriods).map(b => `${b.day}_${b.period}`));
  const unavailable: Break[] = [];

  for (let day = 0; day < numDays; day++) {
    for (let period = 0; period < numPeriods; period++) {
      if (breakKeys.has(`${day}_${period}`)) continue;

      const slot = BigInt(day * numPeriods + period);
      const bit = 1n << slot;
      if ((mask & bit) === 0n) unavailable.push({ day, period });
    }
  }

  return unavailable;
}

function unavailableSlotsToAvailabilityMask(
  unavailableSlots: Break[],
  numDays: number,
  numPeriods: number,
  breaks: Break[],
): string {
  const blocked = new Set(normalizeBreaks(unavailableSlots, numDays, numPeriods).map(s => `${s.day}_${s.period}`));
  const breakKeys = new Set(normalizeBreaks(breaks, numDays, numPeriods).map(s => `${s.day}_${s.period}`));
  let mask = 0n;

  for (let day = 0; day < numDays; day++) {
    for (let period = 0; period < numPeriods; period++) {
      const key = `${day}_${period}`;
      if (breakKeys.has(key) || blocked.has(key)) continue;

      const slot = BigInt(day * numPeriods + period);
      mask |= 1n << slot;
    }
  }

  return mask.toString();
}

function validateScheduleGrid(settings: AppSettings, requireUint64: boolean): { numDays: number; numPeriods: number } {
  const numDays = parseInt(settings.numberOfDays) || 0;
  const numPeriods = parseInt(settings.periodsPerDay) || 0;

  if (numDays <= 0 || numPeriods <= 0) {
    throw new Error('School settings are incomplete. Configure working days and periods first.');
  }

  if (requireUint64 && numDays * numPeriods > 64) {
    throw new Error(`This backend supports up to 64 timetable slots total. Current grid is ${numDays} days × ${numPeriods} periods = ${numDays * numPeriods} slots.`);
  }

  return { numDays, numPeriods };
}

function loadConstraints(): Partial<SchedulerConstraints> {
  try {
    const arr = loadStoredConstraintItems();
    if (!arr) return {};
    const get = (id: string) => arr.find(c => c.id === id);
    return {
      noConsecutivePeriods: get('no_consecutive_periods')?.enabled ?? true,
      noConsecutivePeriodsWeight: get('no_consecutive_periods')?.weight ?? 70,
      difficultNotLast: get('difficult_not_last')?.enabled ?? true,
      difficultNotLastWeight: get('difficult_not_last')?.weight ?? 60,
      avoidMorningLab: get('avoid_morning_lab')?.enabled ?? false,
      avoidMorningLabWeight: get('avoid_morning_lab')?.weight ?? 50,
      noSameSubjectTwicePerDay: get('no_subject_twice_same_day')?.enabled ?? true,
      noSameSubjectTwicePerDayWeight: get('no_subject_twice_same_day')?.weight ?? 80,
    };
  } catch { return {}; }
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface Subject {
  id: string;
  name: string;
  short: string;
  is_difficult: boolean;
  is_lab: boolean;
  priority: number;
}

export interface Teacher {
  id: string;
  name: string;
  short: string;
  color: string;
  available_mask: string | number;
  max_per_day: number;
  max_per_week: number;
  unavailable_slots: { day: number; period: number }[];
  timeOff?: boolean[][];
}

export interface Class {
  id: string;
  name: string;
  short: string;
  capacity: number;
}

export interface Classroom {
  id: string;
  name: string;
  short: string;
  is_lab: boolean;
  building: string;
  color: string;
}

// Session shape used by Lessons page
export interface Session {
  duration: 1 | 2 | 3;
  count: number;
}

// Lesson shape used by all pages — keeps original field names
export interface Lesson {
  id: string;
  subject_id: string;
  teacher_ids: string[];
  class_ids: string[];
  room_ids: string[];
  sessions: Session[];
  is_locked: boolean;
  locked_day: number | null;
  locked_start_period: number | null;
  locked_duration: 1 | 2 | 3 | null;
  // extra fields from backend model (optional, used when syncing)
  is_lab?: boolean;
  is_difficult?: boolean;
  subject_name?: string;
  mini_group_id?: string | null;
}

export interface Break {
  day: number;
  period: number;
}

export interface AppSettings {
  schoolName: string;
  academicYear: string;
  periodsPerDay: string;
  numberOfDays: string;
  breakAfterPeriod: number;
  breaks: Break[];
  constraintMask: number;
}

export interface TimetableEntry {
  id: string;
  lesson_id: string;
  day: number;
  start_period: number;
  duration: number;
  subject_id: string;
  subject_name: string;
  teacher_ids: string[];
  class_ids: string[];
  room_ids: string[];
}

export interface ViolationDetail {
  type: string;
  description: string;
  block_id: string;
}

export interface GenerationState {
  status: 'idle' | 'running' | 'done' | 'failed';
  error: string | null;
  jobId: string | null;
  fitness: number | null;
  qualityPct: number | null;
  hardViolations: number | null;
  softViolations: number | null;
  generationTimeSec: number | null;
  lessonsPlaced: number | null;
  totalLessons: number | null;
  preflightOk: boolean | null;
  preflightErrors: string[];
  preflightWarnings: string[];
  violationDetails: ViolationDetail[];
  gaGenerations: number | null;
  gaStatus: string | null;
  isModified?: boolean;
  /** Grid metadata from the generation response — essential for mini groups with different dimensions */
  gridMetadata?: {
    days: number;
    periods: number;
    day_names: string[];
    breaks?: Break[];
  } | null;
  timetable: {
    timetable_id: string;
    fitness: number;
    entries: TimetableEntry[];
    generation_time_seconds: number | null;
    snapshot_id?: string;
    snapshot_name?: string;
  } | null;
}

// ─── Defaults & helpers ───────────────────────────────────────────────────

const defaultSettings: AppSettings = {
  schoolName: '',
  academicYear: '2024-2025',
  periodsPerDay: '7',
  numberOfDays: '5',
  breakAfterPeriod: 3,
  breaks: [],
  constraintMask: 274743149567,
};

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16'];
function assignColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

const newId = () => `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// ─── Map backend AllDataOut → frontend types ──────────────────────────────

function mapAllData(data: AllDataOut): {
  subjects: Subject[];
  teachers: Teacher[];
  classes: Class[];
  classrooms: Classroom[];
  lessons: Lesson[];
  settings: AppSettings;
} {
  const inst = data.institution;
  const constraintSettings = parseConstraintSettings(
    data.constraint_settings?.settings_json,
    inst.days_per_week,
    inst.periods_per_day,
    inst.break_after_period,
  );

  persistStoredConstraintItems(constraintSettings.constraints);

  const subjects: Subject[] = data.subjects.map(s => ({
    id: s.id, name: s.name,
    short: s.short_name ?? s.name.slice(0, 3).toUpperCase(),
    is_difficult: s.is_difficult, is_lab: s.is_lab, priority: s.priority,
  }));

  const teachers: Teacher[] = data.teachers.map(t => ({
    id: t.id, name: t.name,
    short: t.short_name ?? t.name.slice(0, 2).toUpperCase(),
    color: assignColor(t.id),
    available_mask: t.available_mask,
    max_per_day: t.max_per_day,
    max_per_week: t.max_per_week,
    unavailable_slots: availabilityMaskToUnavailableSlots(
      t.available_mask,
      inst.days_per_week,
      inst.periods_per_day,
      constraintSettings.breaks,
    ),
  }));

  // backend "classrooms" = student classes; backend "rooms" = physical rooms
  const classes: Class[] = data.classrooms.map(c => ({
    id: c.id, name: c.name,
    short: c.short_name ?? c.name.slice(0, 4).toUpperCase(),
    capacity: c.capacity,
  }));

  const classrooms: Classroom[] = data.rooms.map(r => ({
    id: r.id, name: r.name,
    short: r.short_name ?? r.name.slice(0, 3).toUpperCase(),
    is_lab: r.is_lab, building: '', color: assignColor(r.id),
  }));

  // Group backend lesson blocks back into the frontend lesson model.
  const lessonMap = new Map<string, Lesson>();
  for (const lb of data.lesson_blocks) {
    const lessonId = getBackendLessonRootId(lb.id);
    const existing = lessonMap.get(lessonId);
    const duration = clampSessionDuration(lb.duration);
    const count = Math.max(1, lb.count);

    if (existing) {
      const session = existing.sessions.find(s => s.duration === duration);
      if (session) session.count += count;
      else existing.sessions.push({ duration, count });

      if (lb.is_locked && !existing.is_locked) {
        existing.is_locked = true;
        existing.locked_day = lb.locked_day ?? null;
        existing.locked_start_period = lb.locked_period ?? null;
        existing.locked_duration = duration;
      }

      if (!existing.teacher_ids.length) existing.teacher_ids = lb.teacher_ids;
      if (!existing.class_ids.length) existing.class_ids = lb.classroom_ids;
      if (!existing.room_ids.length) existing.room_ids = lb.room_ids;
      if (!existing.subject_id) existing.subject_id = lb.subject_ids[0] ?? '';
      if (!existing.subject_name) existing.subject_name = lb.subject_name ?? undefined;
      continue;
    }

    lessonMap.set(lessonId, {
      id: lessonId,
      subject_id: lb.subject_ids[0] ?? '',
      teacher_ids: lb.teacher_ids,
      class_ids: lb.classroom_ids,   // backend classroom_ids = student classes
      room_ids: lb.room_ids,
      sessions: [{ duration, count }],
      is_locked: lb.is_locked,
      locked_day: lb.is_locked ? lb.locked_day ?? null : null,
      locked_start_period: lb.is_locked ? lb.locked_period ?? null : null,
      locked_duration: lb.is_locked ? duration : null,
      is_lab: lb.is_lab,
      is_difficult: lb.is_difficult,
      subject_name: lb.subject_name ?? undefined,
      mini_group_id: lb.mini_group_id,
    });
  }

  const lessons = Array.from(lessonMap.values());

  const settings: AppSettings = {
    schoolName: inst.name,
    academicYear: '2024-2025',
    periodsPerDay: String(inst.periods_per_day),
    numberOfDays: String(inst.days_per_week),
    breakAfterPeriod: constraintSettings.breaks[0]?.period ?? inst.break_after_period,
    breaks: constraintSettings.breaks,
    constraintMask: data.constraint_settings?.constraint_mask ?? 0,
  };

  return { subjects, teachers, classes, classrooms, lessons, settings };
}

// ─── Map frontend Lesson → backend LessonBlockCreate ─────────────────────

function lessonsToBackend(lessons: Lesson[], subjects: Subject[]) {
  return lessons.flatMap((lesson) => {
    const sub = subjects.find(s => s.id === lesson.subject_id);
    const sessions = (lesson.sessions.length > 0 ? lesson.sessions : [{ duration: 1, count: 1 }])
      .map(session => ({ duration: clampSessionDuration(session.duration), count: Math.max(1, session.count) }));

    const lockedSessionIndex = lesson.is_locked
      ? Math.max(
        0,
        sessions.findIndex(session => lesson.locked_duration !== null && session.duration === lesson.locked_duration),
      )
      : -1;

    return sessions.flatMap((session, sessionIndex) => {
      const common = {
        teacher_ids: lesson.teacher_ids,
        subject_ids: lesson.subject_id ? [lesson.subject_id] : [],
        classroom_ids: lesson.class_ids,    // frontend class_ids = student classes
        room_ids: lesson.room_ids,
        duration: session.duration,
        is_lab: lesson.is_lab ?? sub?.is_lab ?? false,
        is_difficult: lesson.is_difficult ?? sub?.is_difficult ?? false,
        subject_name: lesson.subject_name ?? sub?.name ?? '',
        mini_group_id: lesson.mini_group_id ?? null,
      };

      const persisted = !lesson.id.startsWith('local_');
      const buildId = (variant: 'main' | 'locked' | 'rest') => (
        persisted ? buildSessionBlockId(lesson.id, sessionIndex, variant) : undefined
      );

      if (
        lesson.is_locked &&
        sessionIndex === lockedSessionIndex &&
        lesson.locked_day !== null &&
        lesson.locked_start_period !== null
      ) {
        const blocks = [{
          ...common,
          id: buildId('locked'),
          count: 1,
          is_locked: true,
          locked_day: lesson.locked_day,
          locked_period: lesson.locked_start_period,
        }];

        if (session.count > 1) {
          blocks.push({
            ...common,
            id: buildId('rest'),
            count: session.count - 1,
            is_locked: false,
            locked_day: 0,
            locked_period: 0,
          });
        }

        return blocks;
      }

      return [{
        ...common,
        id: buildId('main'),
        count: session.count,
        is_locked: false,
        locked_day: 0,
        locked_period: 0,
      }];
    });
  });
}

// ─── AppState interface ───────────────────────────────────────────────────

interface AppState {
  subjects: Subject[];
  teachers: Teacher[];
  classes: Class[];
  classrooms: Classroom[];
  lessons: Lesson[];
  groups: MiniGroupOut[];
  generation: GenerationState;
  settings: AppSettings;
  isFirstTime: boolean;
  hasUnsavedChanges: boolean;
  isBootstrapped: boolean;
  backendAvailable: boolean;

  addSubject: (s: Omit<Subject, 'id'>) => void;
  updateSubject: (id: string, s: Subject) => void;
  deleteSubject: (id: string) => void;
  deleteAllSubjects: () => void;

  addTeacher: (t: Omit<Teacher, 'id'>) => void;
  updateTeacher: (id: string, t: Teacher) => void;
  deleteTeacher: (id: string) => void;
  deleteAllTeachers: () => void;

  addClass: (c: Omit<Class, 'id'>) => void;
  updateClass: (id: string, c: Class) => void;
  deleteClass: (id: string) => void;
  deleteAllClasses: () => void;

  addClassroom: (r: Omit<Classroom, 'id'>) => void;
  updateClassroom: (id: string, r: Classroom) => void;
  deleteClassroom: (id: string) => void;
  deleteAllClassrooms: () => void;

  addLesson: (l: Omit<Lesson, 'id'>) => void;
  updateLesson: (id: string, l: Lesson) => void;
  deleteLesson: (id: string) => void;
  deleteAllLessons: () => void;

  setGroups: (groups: MiniGroupOut[]) => void;
  fetchGroups: () => Promise<void>;
  createGroup: (data: MiniGroupCreate) => Promise<void>;
  updateGroup: (id: string, data: MiniGroupCreate) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;

  startGeneration: (groupId?: string) => Promise<void>;
  resetGeneration: () => void;
  updateTimetableEntry: (entryId: string, updated: TimetableEntry) => void;
  restoreGeneration: (timetable: GenerationState['timetable']) => void;

  updateSettings: (s: AppSettings) => void;
  loadScopedData: (groupId?: string) => Promise<void>;
  saveAll: (miniGroupId?: string) => Promise<void>;
  markAsSaved: () => void;
  resetAllData: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  completeOnboarding: () => void;
  bootstrap: () => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────

const emptyGeneration: GenerationState = {
  status: 'idle', error: null, jobId: null,
  fitness: null, qualityPct: null,
  hardViolations: null, softViolations: null,
  generationTimeSec: null,
  lessonsPlaced: null, totalLessons: null,
  preflightOk: null, preflightErrors: [], preflightWarnings: [],
  violationDetails: [], gaGenerations: null, gaStatus: null,
  isModified: false,
  gridMetadata: null,
  timetable: null,
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      subjects: [], teachers: [], classes: [], classrooms: [], lessons: [], groups: [],
      generation: emptyGeneration,
      settings: defaultSettings,
      isFirstTime: true,
      hasUnsavedChanges: false,
      isBootstrapped: false,
      backendAvailable: false,

      // ── CRUD: Subjects ────────────────────────────────────────────────
      addSubject: (s) => set(st => ({ subjects: [...st.subjects, { ...s, id: newId() }], hasUnsavedChanges: true })),
      updateSubject: (id, s) => set(st => ({ subjects: st.subjects.map(x => x.id === id ? s : x), hasUnsavedChanges: true })),
      deleteSubject: (id) => set(st => ({ subjects: st.subjects.filter(x => x.id !== id), hasUnsavedChanges: true })),
      deleteAllSubjects: () => set({ subjects: [], hasUnsavedChanges: true }),

      // ── CRUD: Teachers ────────────────────────────────────────────────
      addTeacher: (t) => set(st => ({ teachers: [...st.teachers, { ...t, id: newId() }], hasUnsavedChanges: true })),
      updateTeacher: (id, t) => set(st => ({ teachers: st.teachers.map(x => x.id === id ? t : x), hasUnsavedChanges: true })),
      deleteTeacher: (id) => set(st => ({ teachers: st.teachers.filter(x => x.id !== id), hasUnsavedChanges: true })),
      deleteAllTeachers: () => set({ teachers: [], hasUnsavedChanges: true }),

      // ── CRUD: Classes ─────────────────────────────────────────────────
      addClass: (c) => set(st => ({ classes: [...st.classes, { ...c, id: newId() }], hasUnsavedChanges: true })),
      updateClass: (id, c) => set(st => ({ classes: st.classes.map(x => x.id === id ? c : x), hasUnsavedChanges: true })),
      deleteClass: (id) => set(st => ({ classes: st.classes.filter(x => x.id !== id), hasUnsavedChanges: true })),
      deleteAllClasses: () => set({ classes: [], hasUnsavedChanges: true }),

      // ── CRUD: Classrooms (physical rooms) ─────────────────────────────
      addClassroom: (r) => set(st => ({ classrooms: [...st.classrooms, { ...r, id: newId() }], hasUnsavedChanges: true })),
      updateClassroom: (id, r) => set(st => ({ classrooms: st.classrooms.map(x => x.id === id ? r : x), hasUnsavedChanges: true })),
      deleteClassroom: (id) => set(st => ({ classrooms: st.classrooms.filter(x => x.id !== id), hasUnsavedChanges: true })),
      deleteAllClassrooms: () => set({ classrooms: [], hasUnsavedChanges: true }),

      // ── CRUD: Lessons ─────────────────────────────────────────────────
      addLesson: (l) => set(st => ({ lessons: [...st.lessons, { ...l, id: newId() }], hasUnsavedChanges: true })),
      updateLesson: (id, l) => set(st => ({ lessons: st.lessons.map(x => x.id === id ? l : x), hasUnsavedChanges: true })),
      deleteLesson: (id) => set(st => ({ lessons: st.lessons.filter(x => x.id !== id), hasUnsavedChanges: true })),
      deleteAllLessons: () => set({ lessons: [], hasUnsavedChanges: true }),

      // ── CRUD: Groups ──────────────────────────────────────────────────
      setGroups: (groups) => set({ groups }),
      fetchGroups: async () => {
        try {
          const res = await api.listMiniGroups();
          set({ groups: res });
        } catch { }
      },
      createGroup: async (data) => {
        const res = await api.createMiniGroup(data);
        set(st => ({ groups: [...st.groups, res] }));
      },
      updateGroup: async (id, data) => {
        const res = await api.updateMiniGroup(id, data);
        set(st => ({ groups: st.groups.map(g => g.id === id ? res : g) }));
      },
      deleteGroup: async (id) => {
        await api.deleteMiniGroup(id);
        set(st => ({ groups: st.groups.filter(g => g.id !== id) }));
        // also remove lessons associated with this group
        set(st => ({
          lessons: st.lessons.filter(l => l.mini_group_id !== id),
          hasUnsavedChanges: true,
        }));
      },

      // ── Generation ────────────────────────────────────────────────────
      startGeneration: async (groupId?: string) => {
        set({ generation: { ...emptyGeneration, status: 'running' } });
        await new Promise(r => setTimeout(r, 50));

        const s = get();
        try {
          validateScheduleGrid(s.settings, s.backendAvailable);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          set({ generation: { ...emptyGeneration, status: 'failed', error: message } });
          throw err;
        }

        if (!s.backendAvailable) {
          const msg = "Backend is not available for generation.";
          set({ generation: { ...emptyGeneration, status: 'failed', error: msg } });
          return;
        }

        // Check if there are any lessons for the selected scope before generating
        const relevantLessons = groupId
          ? s.lessons.filter(l => l.mini_group_id === groupId)
          : s.lessons.filter(l => !l.mini_group_id);

        if (relevantLessons.length === 0) {
          const scopeLabel = groupId ? "this Mini Group" : "the Main Schedule";
          const msg = `No lessons found for ${scopeLabel}. Please add lessons before generating a timetable.`;
          set({ generation: { ...emptyGeneration, status: 'failed', error: msg } });
          toast.error(msg);
          return;
        }

        try {
          let result: GenerateResponse;
          if (groupId) {
            const group = s.groups.find(g => g.id === groupId);
            result = await api.generateMini(groupId, { constraint_mask: group?.constraint_mask ?? 0 });
          } else {
            result = await api.generate({ constraint_mask: Number(s.settings.constraintMask || 0) });
          }
          const entries = convertBackendTimetable(result, s);
          const ttId = `gen_${Date.now()}`;

          // Extract grid metadata from the timetable response
          const ttData = result.timetable as Record<string, unknown>;
          const responseMeta = ttData?.metadata as { days?: number; periods?: number; day_names?: string[] } | undefined;

          // If generating for a mini group, resolve its breaks from the group store
          let resolvedBreaks: Break[] | undefined;
          if (groupId) {
            const targetGroup = s.groups.find(g => g.id === groupId);
            if (targetGroup) {
              try {
                const overrides = JSON.parse(targetGroup.teacher_time_off_overrides || '{}');
                resolvedBreaks = Array.isArray(overrides.breaks) ? overrides.breaks : [];
              } catch { resolvedBreaks = []; }
            }
          }

          set({
            generation: {
              status: 'done', error: null, jobId: ttId,
              fitness: result.fitness,
              qualityPct: result.quality_pct,
              hardViolations: result.hard_violations,
              softViolations: result.soft_violations,
              generationTimeSec: result.time_ms / 1000,
              lessonsPlaced: result.lessons_placed,
              totalLessons: result.total_lessons,
              preflightOk: result.preflight_ok,
              preflightErrors: result.preflight_errors ?? [],
              preflightWarnings: result.preflight_warnings ?? [],
              violationDetails: (result.violation_details ?? []).map(v => ({
                type: v.type, description: v.description, block_id: v.block_id ?? '',
              })),
              gaGenerations: result.generations,
              gaStatus: result.status,
              isModified: false,
              gridMetadata: responseMeta ? {
                days: responseMeta.days ?? (parseInt(s.settings.numberOfDays) || 5),
                periods: responseMeta.periods ?? (parseInt(s.settings.periodsPerDay) || 7),
                day_names: responseMeta.day_names ?? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].slice(0, parseInt(s.settings.numberOfDays) || 5),
                breaks: resolvedBreaks,
              } : null,
              timetable: {
                timetable_id: ttId, fitness: result.fitness,
                entries, generation_time_seconds: result.time_ms / 1000,
              },
            },
          });
        } catch (err: any) {
          if (err && err.status === 401 || err.status === 403) {
            const message = err.detail || 'You do not have permission to generate timetables.';
            set({ generation: { ...emptyGeneration, status: 'failed', error: message } });
            throw new Error(message);
          }
          const message = err instanceof Error ? err.message : String(err);
          set({ generation: { ...emptyGeneration, status: 'failed', error: message } });
        }
      },

      resetGeneration: () => set({ generation: emptyGeneration }),

      updateTimetableEntry: (entryId, updated) => set(s => {
        if (!s.generation.timetable) return s;
        return {
          generation: {
            ...s.generation,
            isModified: true,
            timetable: {
              ...s.generation.timetable,
              entries: s.generation.timetable.entries.map(e => e.id === entryId ? updated : e),
            },
          },
        };
      }),

      restoreGeneration: (timetable) => set({
        generation: timetable ? {
          status: 'done',
          error: null,
          jobId: timetable.timetable_id,
          fitness: timetable.fitness,
          qualityPct: null,
          hardViolations: null,
          softViolations: null,
          generationTimeSec: timetable.generation_time_seconds,
          lessonsPlaced: null,
          totalLessons: null,
          preflightOk: null,
          preflightErrors: [],
          preflightWarnings: [],
          violationDetails: [],
          gaGenerations: null,
          gaStatus: null,
          isModified: false,
          timetable,
        } : emptyGeneration,
      }),

      updateSettings: (settings) => set({ settings, hasUnsavedChanges: true }),

      // ── Bootstrap ─────────────────────────────────────────────────────
      bootstrap: async () => {
        set({ isBootstrapped: true });

        let up = false;
        try {
          const res = await Promise.race([
            api.health(),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
          ]) as { status: string };
          up = !!res.status;
        } catch { up = false; }

        set({ backendAvailable: up });
        if (!up) return;

        try {
          // Default bootstrap loads 'main' scope
          const data = await api.getAllData('main');
          const mapped = mapAllData(data);
          set({ ...mapped, isBootstrapped: true, backendAvailable: true, hasUnsavedChanges: false });
        } catch (err) {
          console.warn('[bootstrap] data load failed:', err);
          set({ backendAvailable: false });
        }
      },

      loadScopedData: async (groupId) => {
        if (!get().backendAvailable) return;
        try {
          const data = await api.getAllData(groupId || 'main');
          const mapped = mapAllData(data);
          set({ ...mapped, hasUnsavedChanges: false });
        } catch (err) {
          console.error('[loadScopedData] failed:', err);
          toast.error("Failed to load data for this scope.");
        }
      },

      // ── Save all ──────────────────────────────────────────────────────
      saveAll: async (miniGroupId) => {
        const s = get();
        const { numDays, numPeriods } = validateScheduleGrid(s.settings, s.backendAvailable);
        const breaks = normalizeBreaks(s.settings.breaks ?? [], numDays, numPeriods);

        if (!s.backendAvailable) {
          // Local mode — zustand-persist already saved to localStorage
          set({ hasUnsavedChanges: false });
          return;
        }

        const payload = {
          institution: {
            name: s.settings.schoolName || 'My Institution',
            days_per_week: numDays,
            periods_per_day: numPeriods,
            break_after_period: breaks[0]?.period ?? Math.min(s.settings.breakAfterPeriod ?? 3, Math.max(0, numPeriods - 1)),
          },
          teachers: s.teachers.map(t => ({
            id: t.id.startsWith('local_') ? undefined : t.id,
            name: t.name, short_name: t.short,
            available_mask: unavailableSlotsToAvailabilityMask(
              t.unavailable_slots ?? [],
              numDays,
              numPeriods,
              breaks,
            ),
            max_per_day: t.max_per_day ?? 6,
            max_per_week: t.max_per_week ?? 30,
          })),
          subjects: s.subjects.map(sub => ({
            id: sub.id.startsWith('local_') ? undefined : sub.id,
            name: sub.name, short_name: sub.short,
            is_difficult: sub.is_difficult, is_lab: sub.is_lab, priority: sub.priority,
          })),
          // frontend classrooms = physical rooms → backend rooms
          rooms: s.classrooms.map(r => ({
            id: r.id.startsWith('local_') ? undefined : r.id,
            name: r.name, short_name: r.short, is_lab: r.is_lab, available_mask: -1,
          })),
          // frontend classes = student sections → backend classrooms
          classrooms: s.classes.map(c => ({
            id: c.id.startsWith('local_') ? undefined : c.id,
            name: c.name, short_name: c.short, capacity: c.capacity ?? 40,
          })),
          lesson_blocks: lessonsToBackend(
            miniGroupId
              ? s.lessons.filter(l => l.mini_group_id === miniGroupId)
              : s.lessons.filter(l => !l.mini_group_id),
            s.subjects
          ),
          constraint_settings: {
            settings_json: buildConstraintSettingsPayload(breaks),
            constraint_mask: s.settings.constraintMask,
            is_active: true,
          },
        };

        try {
          const data = await api.syncAllData(payload, miniGroupId);
          const mapped = mapAllData(data);
          set({ ...mapped, hasUnsavedChanges: false });
        } catch (err) {
          throw err; // let Layout show the error toast
        }
      },

      markAsSaved: () => set({ hasUnsavedChanges: false }),
      completeOnboarding: () => set({ isFirstTime: false }),

      resetAllData: async () => {
        try {
          await api.resetData();
          set({
            subjects: [], teachers: [], classes: [], classrooms: [], lessons: [], groups: [],
            generation: emptyGeneration,
            settings: defaultSettings,
            hasUnsavedChanges: false, isBootstrapped: false,
            isFirstTime: true,
          });
          toast.success("All data for this account has been truncated.");
        } catch (err) {
          toast.error("Failed to reset data on server.");
          console.error(err);
        }
      },

      deleteAccount: async () => {
        try {
          await api.deleteAccount();
          // Clear EVERYTHING and redirect
          set({
            subjects: [], teachers: [], classes: [], classrooms: [], lessons: [], groups: [],
            generation: emptyGeneration,
            settings: defaultSettings,
            hasUnsavedChanges: false, isBootstrapped: false,
          });
          // The api.deleteAccount() doesn't auto-clear token in localstorage 
          // unless it returns 401, but here it's a 200/delete. 
          // Logout handled by clearing store + redirect.
          window.location.href = '/';
        } catch (err) {
          toast.error("Failed to delete account.");
          console.error(err);
        }
      },
    }),
    {
      name: 'autoscheduler-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        subjects: s.subjects, teachers: s.teachers,
        classes: s.classes, classrooms: s.classrooms, lessons: s.lessons,
        settings: s.settings, isFirstTime: s.isFirstTime,
        hasUnsavedChanges: s.hasUnsavedChanges,
      }),
    },
  ),
);

// ─── Convert backend GenerateResponse → TimetableEntry[] ─────────────────

function convertBackendTimetable(result: GenerateResponse, s: AppState): TimetableEntry[] {
  const ttData = result.timetable as Record<string, unknown>;
  if (!ttData || typeof ttData !== 'object') return [];

  const entries: TimetableEntry[] = [];
  const seen = new Set<string>();
  let idx = 0;

  const buildEntry = (
    blockId: string,
    day: number,
    startPeriod: number,
    duration: number,
    partial?: Record<string, unknown>,
  ) => {
    if (!blockId || typeof day !== 'number' || typeof startPeriod !== 'number') return;

    const lessonId = getBackendLessonRootId(blockId);
    const key = `${blockId}_${day}_${startPeriod}`;
    if (seen.has(key)) return;
    seen.add(key);

    const lesson = s.lessons.find(l => l.id === lessonId);
    const subject = s.subjects.find(sub => sub.id === lesson?.subject_id);

    entries.push({
      id: `entry_${idx++}`,
      lesson_id: lessonId,
      day,
      start_period: startPeriod,
      duration: typeof duration === 'number' && duration > 0 ? duration : 1,
      subject_id: typeof partial?.subject_id === 'string' ? partial.subject_id : (lesson?.subject_id ?? ''),
      subject_name: typeof partial?.subject_name === 'string' ? partial.subject_name : (lesson?.subject_name ?? subject?.name ?? ''),
      teacher_ids: Array.isArray(partial?.teacher_ids) ? partial.teacher_ids as string[] : (lesson?.teacher_ids ?? []),
      class_ids: Array.isArray(partial?.class_ids)
        ? partial.class_ids as string[]
        : Array.isArray(partial?.classroom_ids)
          ? partial.classroom_ids as string[]
          : (lesson?.class_ids ?? []),
      room_ids: Array.isArray(partial?.room_ids) ? partial.room_ids as string[] : (lesson?.room_ids ?? []),
    });
  };

  const classViews = ttData.class_views as Record<string, unknown> | undefined;
  if (classViews && typeof classViews === 'object') {
    for (const view of Object.values(classViews)) {
      const grid = (view as { grid?: unknown })?.grid;
      if (!Array.isArray(grid)) continue;

      grid.forEach((row, day) => {
        if (!Array.isArray(row)) return;

        row.forEach((cell, period) => {
          if (!cell || typeof cell !== 'object') return;

          const item = cell as Record<string, unknown>;
          if (item.is_continuation) return;

          buildEntry(
            typeof item.block_id === 'string' ? item.block_id : '',
            day,
            period,
            typeof item.duration === 'number' ? item.duration : 1,
            item,
          );
        });
      });
    }

    return entries;
  }

  // Backward-compatible fallback for the older flat timetable response shape.
  for (const val of Object.values(ttData)) {
    const item = val as Record<string, unknown>;
    if (!item || typeof item.day !== 'number') continue;

    buildEntry(
      typeof item.block_id === 'string' ? item.block_id : '',
      item.day as number,
      typeof item.period === 'number' ? item.period : 0,
      typeof item.duration === 'number' ? item.duration : 1,
      item,
    );
  }

  return entries;
}

// ─── Exported slot/grid helpers (used by Teachers page) ──────────────────

export const slotsToGrid = (
  slots: { day: number; period: number }[],
  numDays: number,
  numPeriods: number,
): boolean[][] => {
  const grid = Array(numDays).fill(null).map(() => Array(numPeriods).fill(true));
  slots.forEach(({ day, period }) => {
    if (day >= 0 && day < numDays && period >= 0 && period < numPeriods)
      grid[day][period] = false;
  });
  return grid;
};

export const gridToSlots = (
  grid: boolean[][],
): { day: number; period: number }[] => {
  const slots: { day: number; period: number }[] = [];
  grid.forEach((row, d) => row.forEach((avail, p) => { if (!avail) slots.push({ day: d, period: p }); }));
  return slots;
};
