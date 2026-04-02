// hooks/useBootstrap.ts
import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { fetchBootstrap, saveAll } from "../services/api";

export function useBootstrap() {
  const { setBootstrap, setLoading } = useAppStore();

  useEffect(() => {
    setLoading(true);
    fetchBootstrap()
      .then(setBootstrap)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
}

export function useSave() {
  const { changes, clearChanges, setSaving, setSaveError, setBootstrap } =
    useAppStore();

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // ── PASS 1: Save teachers, subjects, rooms, classes ────────────────
      // Must commit these first so their real DB IDs exist
      // before lessons reference them as foreign keys.
      const pass1 = {
        teachers: sanitize(changes.teachers),
        subjects: sanitize(changes.subjects),
        rooms: sanitize(changes.rooms),
        classes: sanitize(changes.classes),
        lessons: emptyChanges(),
      };

      const hasPass1 = hasAnyChanges(pass1);
      if (hasPass1) {
        await saveAll(pass1);
      }

      // ── Re-bootstrap to replace tmp_ IDs with real DB UUIDs ───────────
      const fresh = await fetchBootstrap();
      setBootstrap(fresh);

      // ── PASS 2: Save lessons with resolved real IDs ────────────────────
      const latestChanges = useAppStore.getState().changes;

      const resolvedLessons = resolveLessonIds(
        latestChanges.lessons,
        fresh.subjects ?? [],
        fresh.teachers ?? [],
        fresh.rooms ?? [],
        fresh.classes ?? [],
      );

      const hasPass2 = hasAnyChanges({ lessons: resolvedLessons });
      if (hasPass2) {
        await saveAll({
          teachers: emptyChanges(),
          subjects: emptyChanges(),
          rooms: emptyChanges(),
          classes: emptyChanges(),
          lessons: resolvedLessons,
        });
      }

      // ── Final bootstrap to get real lesson IDs ─────────────────────────
      const final = await fetchBootstrap();
      setBootstrap(final);
      clearChanges();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return { save };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyChanges() {
  return { added: [], updated: {}, deleted: [] };
}

function hasAnyChanges(payload: Record<string, any>): boolean {
  return Object.values(payload).some(
    (c) =>
      c.added.length > 0 ||
      Object.keys(c.updated).length > 0 ||
      c.deleted.length > 0,
  );
}

function sanitize(changes: any) {
  return {
    added: changes.added.map(stripId),
    updated: changes.updated,
    deleted: changes.deleted.filter((id: string) => !id.startsWith("tmp_")),
  };
}

function stripId(item: any) {
  const { id, ...rest } = item;
  return rest;
}

/**
 * Resolve tmp_ IDs in lesson foreign key fields.
 * After pass 1 + bootstrap, all entities have real UUIDs.
 */
function resolveLessonIds(
  lessonChanges: any,
  freshSubjects: any[],
  freshTeachers: any[],
  freshRooms: any[],
  freshClasses: any[],
) {
  const subjectIds = new Set(freshSubjects.map((x: any) => x.id));
  const teacherIds = new Set(freshTeachers.map((x: any) => x.id));
  const roomIds = new Set(freshRooms.map((x: any) => x.id));
  const classIds = new Set(freshClasses.map((x: any) => x.id));

  const resolveIds = (ids: string[], valid: Set<string>): string[] =>
    ids.filter((id) => !id.startsWith("tmp_") && valid.has(id));

  const added = lessonChanges.added
    .map((l: any) => {
      if (l.subject_id?.startsWith("tmp_")) return null;
      if (!subjectIds.has(l.subject_id)) return null;
      const { id, ...rest } = l;
      return {
        ...rest,
        subject_id: l.subject_id,
        teacher_ids: resolveIds(l.teacher_ids ?? [], teacherIds),
        class_ids: resolveIds(l.class_ids ?? [], classIds),
        room_ids: resolveIds(l.room_ids ?? [], roomIds),
      };
    })
    .filter(Boolean);

  const updated: Record<string, any> = {};
  for (const [id, l] of Object.entries(
    lessonChanges.updated as Record<string, any>,
  )) {
    if (id.startsWith("tmp_")) continue;
    updated[id] = {
      ...l,
      teacher_ids: resolveIds(l.teacher_ids ?? [], teacherIds),
      class_ids: resolveIds(l.class_ids ?? [], classIds),
      room_ids: resolveIds(l.room_ids ?? [], roomIds),
    };
  }

  const deleted = lessonChanges.deleted.filter(
    (id: string) => !id.startsWith("tmp_"),
  );

  return { added, updated, deleted };
}
