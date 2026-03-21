// hooks/useBootstrap.ts
import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { fetchBootstrap, saveAll } from "../services/api";

export function useBootstrap() {
  const { setBootstrap, setLoading } = useAppStore();

  useEffect(() => {
    // Always fetch fresh from server on mount — never rely on localStorage
    // for server-assigned IDs. localStorage is only for UI state.
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
      // Strip temp IDs from added items — backend assigns real UUIDs
      const payload = {
        teachers: sanitize(changes.teachers),
        subjects: sanitize(changes.subjects),
        rooms: sanitize(changes.rooms),
        classes: sanitize(changes.classes),
        lessons: sanitize(changes.lessons),
      };
      await saveAll(payload);

      // Always re-bootstrap after save so frontend gets real server IDs.
      // This replaces all tmp_ IDs with real UUIDs from the DB.
      const fresh = await fetchBootstrap();
      setBootstrap(fresh);
      clearChanges();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return { save };
}

function sanitize(changes: any) {
  return {
    added: changes.added.map(stripTempId),
    updated: changes.updated,
    // Never send tmp_ IDs as deleted — they were never saved to DB
    deleted: changes.deleted.filter((id: string) => !id.startsWith("tmp_")),
  };
}

function stripTempId(item: any) {
  const { id, ...rest } = item;
  return rest;
}
