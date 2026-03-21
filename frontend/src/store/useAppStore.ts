// store/useAppStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// ── Types ────────────────────────────────────────────────────────────────────

export interface UnavailableSlot {
  day: number;
  period: number;
}

export interface Teacher {
  id: string;
  name: string;
  unavailable_slots: UnavailableSlot[];
}
export interface Subject {
  id: string;
  name: string;
  is_difficult: boolean;
  is_lab: boolean;
  priority: number;
}
export interface Room {
  id: string;
  name: string;
  is_lab: boolean;
}
export interface Class {
  id: string;
  name: string;
}

export interface SessionSpec {
  duration: 1 | 2 | 3;
  count: number;
}

export interface Lesson {
  id: string;
  subject_id: string;
  teacher_ids: string[];
  class_ids: string[];
  room_ids: string[];
  sessions: SessionSpec[];
  is_locked: boolean;
  locked_day: number | null;
  locked_start_period: number | null;
  locked_duration: number | null;
  total_periods?: number;
}

export interface TimetableEntry {
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

export interface Changes<T> {
  added: T[];
  updated: Record<string, T>;
  deleted: string[];
}

interface GenerationState {
  jobId: string | null;
  status: "idle" | "pending" | "running" | "done" | "failed";
  error: string | null;
  timetable: {
    id: string;
    fitness: number;
    entries: TimetableEntry[];
    generationTime: number | null;
  } | null;
}

interface AppState {
  teachers: Teacher[];
  subjects: Subject[];
  rooms: Room[];
  classes: Class[];
  lessons: Lesson[];

  changes: {
    teachers: Changes<Omit<Teacher, "id">>;
    subjects: Changes<Omit<Subject, "id">>;
    rooms: Changes<Omit<Room, "id">>;
    classes: Changes<Omit<Class, "id">>;
    lessons: Changes<Omit<Lesson, "id" | "total_periods">>;
  };

  loading: boolean;
  saving: boolean;
  saveError: string | null;
  generation: GenerationState;

  setBootstrap: (data: any) => void;
  setLoading: (v: boolean) => void;
  setSaving: (v: boolean) => void;
  setSaveError: (e: string | null) => void;
  clearChanges: () => void;
  hasChanges: () => boolean;

  addTeacher: (t: Omit<Teacher, "id">) => string;
  updateTeacher: (id: string, t: Partial<Teacher>) => void;
  deleteTeacher: (id: string) => void;

  addSubject: (s: Omit<Subject, "id">) => string;
  updateSubject: (id: string, s: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;

  addRoom: (r: Omit<Room, "id">) => string;
  updateRoom: (id: string, r: Partial<Room>) => void;
  deleteRoom: (id: string) => void;

  addClass: (c: Omit<Class, "id">) => string;
  updateClass: (id: string, c: Partial<Class>) => void;
  deleteClass: (id: string) => void;

  addLesson: (l: Omit<Lesson, "id" | "total_periods">) => string;
  updateLesson: (id: string, l: Partial<Lesson>) => void;
  deleteLesson: (id: string) => void;

  setJobId: (id: string) => void;
  setGenStatus: (s: GenerationState["status"], error?: string) => void;
  setTimetable: (tt: GenerationState["timetable"]) => void;
  resetGeneration: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _seq = 0;
const tempId = () => `tmp_${++_seq}_${Date.now()}`;
const emptyChanges = <T>(): Changes<T> => ({
  added: [],
  updated: {},
  deleted: [],
});

export const totalPeriods = (sessions: SessionSpec[]) =>
  sessions.reduce((sum, s) => sum + s.duration * s.count, 0);

export const sessionSummary = (sessions: SessionSpec[]) =>
  sessions.map((s) => `${s.count}×${s.duration}p`).join(" + ");

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    immer((set, get) => ({
      teachers: [],
      subjects: [],
      rooms: [],
      classes: [],
      lessons: [],
      changes: {
        teachers: emptyChanges(),
        subjects: emptyChanges(),
        rooms: emptyChanges(),
        classes: emptyChanges(),
        lessons: emptyChanges(),
      },
      loading: false,
      saving: false,
      saveError: null,
      generation: { jobId: null, status: "idle", error: null, timetable: null },

      setBootstrap: (data) =>
        set((s) => {
          s.teachers = data.teachers ?? [];
          s.subjects = data.subjects ?? [];
          s.rooms = data.rooms ?? [];
          s.classes = data.classes ?? [];
          s.lessons = data.lessons ?? [];
        }),

      setLoading: (v) =>
        set((s) => {
          s.loading = v;
        }),
      setSaving: (v) =>
        set((s) => {
          s.saving = v;
        }),
      setSaveError: (e) =>
        set((s) => {
          s.saveError = e;
        }),

      clearChanges: () =>
        set((s) => {
          s.changes = {
            teachers: emptyChanges(),
            subjects: emptyChanges(),
            rooms: emptyChanges(),
            classes: emptyChanges(),
            lessons: emptyChanges(),
          };
        }),

      hasChanges: () => {
        const c = get().changes;
        return Object.values(c).some(
          (ch: Changes<any>) =>
            ch.added.length > 0 ||
            Object.keys(ch.updated).length > 0 ||
            ch.deleted.length > 0,
        );
      },

      // ── Teachers ─────────────────────────────────────────
      addTeacher: (t) => {
        const id = tempId();
        set((s) => {
          s.teachers.push({ ...t, id });
          s.changes.teachers.added.push(t);
        });
        return id;
      },
      updateTeacher: (id, t) =>
        set((s) => {
          const idx = s.teachers.findIndex((x) => x.id === id);
          if (idx !== -1) {
            Object.assign(s.teachers[idx], t);
            s.changes.teachers.updated[id] = { ...s.teachers[idx] };
          }
        }),
      deleteTeacher: (id) =>
        set((s) => {
          s.teachers = s.teachers.filter((x) => x.id !== id);
          const ai = s.changes.teachers.added.findIndex(
            (x: any) => x.id === id,
          );
          if (ai !== -1) s.changes.teachers.added.splice(ai, 1);
          else {
            delete s.changes.teachers.updated[id];
            s.changes.teachers.deleted.push(id);
          }
        }),

      // ── Subjects ─────────────────────────────────────────
      addSubject: (s_) => {
        const id = tempId();
        set((s) => {
          s.subjects.push({ ...s_, id });
          s.changes.subjects.added.push(s_);
        });
        return id;
      },
      updateSubject: (id, s_) =>
        set((s) => {
          const idx = s.subjects.findIndex((x) => x.id === id);
          if (idx !== -1) {
            Object.assign(s.subjects[idx], s_);
            s.changes.subjects.updated[id] = { ...s.subjects[idx] };
          }
        }),
      deleteSubject: (id) =>
        set((s) => {
          s.subjects = s.subjects.filter((x) => x.id !== id);
          delete s.changes.subjects.updated[id];
          s.changes.subjects.deleted.push(id);
        }),

      // ── Rooms ─────────────────────────────────────────────
      addRoom: (r) => {
        const id = tempId();
        set((s) => {
          s.rooms.push({ ...r, id });
          s.changes.rooms.added.push(r);
        });
        return id;
      },
      updateRoom: (id, r) =>
        set((s) => {
          const idx = s.rooms.findIndex((x) => x.id === id);
          if (idx !== -1) {
            Object.assign(s.rooms[idx], r);
            s.changes.rooms.updated[id] = { ...s.rooms[idx] };
          }
        }),
      deleteRoom: (id) =>
        set((s) => {
          s.rooms = s.rooms.filter((x) => x.id !== id);
          delete s.changes.rooms.updated[id];
          s.changes.rooms.deleted.push(id);
        }),

      // ── Classes ───────────────────────────────────────────
      addClass: (c) => {
        const id = tempId();
        set((s) => {
          s.classes.push({ ...c, id });
          s.changes.classes.added.push(c);
        });
        return id;
      },
      updateClass: (id, c) =>
        set((s) => {
          const idx = s.classes.findIndex((x) => x.id === id);
          if (idx !== -1) {
            Object.assign(s.classes[idx], c);
            s.changes.classes.updated[id] = { ...s.classes[idx] };
          }
        }),
      deleteClass: (id) =>
        set((s) => {
          s.classes = s.classes.filter((x) => x.id !== id);
          delete s.changes.classes.updated[id];
          s.changes.classes.deleted.push(id);
        }),

      // ── Lessons ───────────────────────────────────────────
      addLesson: (l) => {
        const id = tempId();
        set((s) => {
          s.lessons.push({ ...l, id });
          s.changes.lessons.added.push(l);
        });
        return id;
      },
      updateLesson: (id, l) =>
        set((s) => {
          const idx = s.lessons.findIndex((x) => x.id === id);
          if (idx !== -1) {
            Object.assign(s.lessons[idx], l);
            s.changes.lessons.updated[id] = { ...s.lessons[idx] };
          }
        }),
      deleteLesson: (id) =>
        set((s) => {
          s.lessons = s.lessons.filter((x) => x.id !== id);
          delete s.changes.lessons.updated[id];
          s.changes.lessons.deleted.push(id);
        }),

      // ── Generation ────────────────────────────────────────
      setJobId: (id) =>
        set((s) => {
          s.generation.jobId = id;
        }),
      setGenStatus: (st, e) =>
        set((s) => {
          s.generation.status = st;
          s.generation.error = e ?? null;
        }),
      setTimetable: (tt) =>
        set((s) => {
          s.generation.timetable = tt;
        }),
      resetGeneration: () =>
        set((s) => {
          s.generation = {
            jobId: null,
            status: "idle",
            error: null,
            timetable: null,
          };
        }),
    })),
    {
      name: "timetable-app-store",
      storage: createJSONStorage(() => localStorage),
      // Only persist changes (unsaved edits) — NOT the server data.
      // Server data is always fetched fresh on mount via useBootstrap.
      // This prevents stale tmp_ IDs from persisting across sessions.
      partialize: (s) => ({
        // Only persist unsaved edits — everything else resets on reload.
        // Timetable results, generation state, and server data are session-only.
        changes: s.changes,
      }),
    },
  ),
);
