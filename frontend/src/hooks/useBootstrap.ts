// hooks/useBootstrap.ts
import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { fetchBootstrap, saveAll } from "../services/api";

export function useBootstrap() {
  const { setBootstrap, setLoading, bootstrapped } = useAppStore();

  useEffect(() => {
    // Skip if already loaded from localStorage
    if (bootstrapped) return;
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

      // Re-bootstrap so frontend gets real IDs assigned by the server
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
    deleted: changes.deleted.filter((id: string) => !id.startsWith("tmp_")),
  };
}

function stripTempId(item: any) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...rest } = item;
  return rest;
}
