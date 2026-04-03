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

export const useDataStore = create((set, get) => ({
  institution: null,
  teachers: [],
  subjects: [],
  rooms: [],
  classrooms: [],
  lessonBlocks: [],
  constraintSettings: null,
  loading: false,
  error: null,

  // Mini group specific data
  miniGroupData: {},  // { [groupId]: { lessonBlocks, constraintSettings } }

  fetchData: async (miniGroupId = null) => {
    set({ loading: true, error: null });
    try {
      const url = miniGroupId
        ? `${API}/api/data?mini_group_id=${miniGroupId}`
        : `${API}/api/data`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      if (miniGroupId) {
        set(state => ({
          // Always update shared entities from latest fetch
          institution: json.institution,
          teachers: json.teachers,
          subjects: json.subjects,
          rooms: json.rooms,
          classrooms: json.classrooms,
          miniGroupData: {
            ...state.miniGroupData,
            [miniGroupId]: {
              lessonBlocks: json.lesson_blocks,
              constraintSettings: json.constraint_settings,
            },
          },
        }));
      } else {
        set({
          institution: json.institution,
          teachers: json.teachers,
          subjects: json.subjects,
          rooms: json.rooms,
          classrooms: json.classrooms,
          lessonBlocks: json.lesson_blocks,
          constraintSettings: json.constraint_settings,
        });
      }
    } catch (e) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  saveData: async (payload, miniGroupId = null) => {
    const url = miniGroupId
      ? `${API}/api/data?mini_group_id=${miniGroupId}`
      : `${API}/api/data`;
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Save failed');
    }
    const json = await res.json();
    if (miniGroupId) {
      set(state => ({
        institution: json.institution,
        teachers: json.teachers,
        subjects: json.subjects,
        rooms: json.rooms,
        classrooms: json.classrooms,
        miniGroupData: {
          ...state.miniGroupData,
          [miniGroupId]: {
            lessonBlocks: json.lesson_blocks,
            constraintSettings: json.constraint_settings,
          },
        },
      }));
    } else {
      set({
        institution: json.institution,
        teachers: json.teachers,
        subjects: json.subjects,
        rooms: json.rooms,
        classrooms: json.classrooms,
        lessonBlocks: json.lesson_blocks,
        constraintSettings: json.constraint_settings,
      });
    }
    return json;
  },
}));
