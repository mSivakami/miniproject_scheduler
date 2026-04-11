import { useEffect, useMemo, useState } from "react";
import { Archive, RotateCcw, Trash2, Clock, Plus, FileDown, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { PageWrapper } from "../components/PageWrapper";
import { useStore, type TimetableEntry, type AppSettings } from "../store/useStore";
import { toast } from "sonner";
import { api, type TimetableDetailOut, type TimetableOut } from "../api";

interface LocalSavedTimetable {
  id: string;
  name: string;
  savedAt: string;
  fitness: number;
  generationTime: number | null;
  entriesCount: number;
  timetableJson: string;
}

interface LegacyLocalSavedTimetable {
  id: string;
  name: string;
  savedAt: string;
  fitness: number;
  generationTime: number | null;
  entries: TimetableEntry[];
  timetableId: string;
}

interface DisplaySavedTimetable {
  id: string;
  name: string;
  savedAt: string;
  fitness: number;
  generationTime: number | null;
  entriesCount: number | null;
  source: "server" | "local";
}

interface GridSettings {
  numberOfDays: string;
  periodsPerDay: string;
  breakAfterPeriod: number;
  breaks: { day: number; period: number }[];
}

interface RestorableTimetable {
  timetable_id: string;
  fitness: number;
  entries: TimetableEntry[];
  generation_time_seconds: number | null;
  grid_settings?: GridSettings;
}

const MAX_SAVED = 5;
const LOCAL_STORAGE_KEY = "autoscheduler_saved_timetables";

function loadLocalSnapshots(): LocalSavedTimetable[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): LocalSavedTimetable[] => {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as LocalSavedTimetable).timetableJson === "string"
      ) {
        return [item as LocalSavedTimetable];
      }

      const legacy = item as LegacyLocalSavedTimetable;
      if (
        legacy &&
        typeof legacy.id === "string" &&
        typeof legacy.name === "string" &&
        typeof legacy.savedAt === "string" &&
        Array.isArray(legacy.entries) &&
        typeof legacy.timetableId === "string"
      ) {
        return [{
          id: legacy.id,
          name: legacy.name,
          savedAt: legacy.savedAt,
          fitness: legacy.fitness,
          generationTime: legacy.generationTime ?? null,
          entriesCount: legacy.entries.length,
          timetableJson: JSON.stringify({
            timetable_id: legacy.timetableId,
            fitness: legacy.fitness,
            entries: legacy.entries,
            generation_time_seconds: legacy.generationTime ?? null,
          }),
        }];
      }

      return [];
    });
  } catch {
    return [];
  }
}

function persistLocalSnapshots(items: LocalSavedTimetable[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " - " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function parseRestorableTimetable(rawJson: string): RestorableTimetable {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Saved timetable data is corrupted and could not be parsed.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Saved timetable data is malformed.");
  }

  const timetable = parsed as Partial<RestorableTimetable>;
  if (
    typeof timetable.timetable_id !== "string" ||
    typeof timetable.fitness !== "number" ||
    !Array.isArray(timetable.entries)
  ) {
    throw new Error("Saved timetable data is missing required fields.");
  }

  const gs = (timetable as Record<string, unknown>).grid_settings;
  const grid_settings: GridSettings | undefined =
    gs && typeof gs === "object" &&
    typeof (gs as GridSettings).numberOfDays === "string" &&
    typeof (gs as GridSettings).periodsPerDay === "string"
      ? (gs as GridSettings)
      : undefined;

  return {
    timetable_id: timetable.timetable_id,
    fitness: timetable.fitness,
    entries: timetable.entries,
    generation_time_seconds:
      typeof timetable.generation_time_seconds === "number" ? timetable.generation_time_seconds : null,
    grid_settings,
  };
}

function useLocalSavedTimetables() {
  const [saved, setSaved] = useState<LocalSavedTimetable[]>(() => loadLocalSnapshots());

  const persist = (list: LocalSavedTimetable[]) => {
    setSaved(list);
    persistLocalSnapshots(list);
  };

  const save = (snapshot: Omit<LocalSavedTimetable, "id" | "savedAt">) => {
    const updated = [
      { ...snapshot, id: crypto.randomUUID(), savedAt: new Date().toISOString() },
      ...saved,
    ].slice(0, MAX_SAVED);
    persist(updated);
  };

  const remove = (id: string) => persist(saved.filter(item => item.id !== id));
  const clear = () => persist([]);

  return { saved, save, remove, clear };
}

export function SavedTimetables() {
  const { generation, restoreGeneration, backendAvailable, settings, updateSettings, teachers, classes, classrooms } = useStore();  
  const { saved: localSaved, save: saveLocal, remove: removeLocal, clear: clearLocal } = useLocalSavedTimetables();
  const [serverSaved, setServerSaved] = useState<TimetableOut[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const usingServer = backendAvailable;
  const currentTimetable = generation?.timetable;

  const savedItems = useMemo<DisplaySavedTimetable[]>(() => {
    if (usingServer) {
      return serverSaved.map(tt => ({
        id: tt.id,
        name: tt.name,
        savedAt: tt.created_at,
        fitness: tt.fitness_score ?? 0,
        generationTime: null,
        entriesCount: null,
        source: "server",
      }));
    }

    return localSaved.map(tt => ({
      id: tt.id,
      name: tt.name,
      savedAt: tt.savedAt,
      fitness: tt.fitness,
      generationTime: tt.generationTime,
      entriesCount: tt.entriesCount,
      source: "local",
    }));
  }, [localSaved, serverSaved, usingServer]);

  useEffect(() => {
    if (!usingServer) return;

    let cancelled = false;
    setIsLoading(true);
    api.listTimetables()
      .then(items => {
        if (!cancelled) setServerSaved(items);
      })
      .catch(err => {
        if (!cancelled) {
          console.warn("[saved-timetables] failed to load:", err);
          toast.error("Could not load saved timetables from the server.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [usingServer]);

  const refreshServerSaved = async () => {
    if (!usingServer) return;
    const items = await api.listTimetables();
    setServerSaved(items);
  };

  const loadServerDetail = async (id: string): Promise<TimetableDetailOut> => {
    const detail = await api.getTimetable(id);
    if (!detail.timetable_json) {
      throw new Error("Saved timetable has no timetable payload.");
    }
    return detail;
  };

  const handleSaveSnapshot = async () => {
    if (!currentTimetable) return;

    const snapshotPayload = {
      ...currentTimetable,
      grid_settings: {
        numberOfDays: settings.numberOfDays,
        periodsPerDay: settings.periodsPerDay,
        breakAfterPeriod: settings.breakAfterPeriod,
        breaks: settings.breaks,
      },
    };

    setIsSaving(true);
    try {
      if (usingServer) {
        await api.saveTimetable({
          name: `Snapshot ${savedItems.length + 1}`,
          timetable_json: JSON.stringify(snapshotPayload),
          fitness_score: currentTimetable.fitness,
          hard_violations: generation.hardViolations ?? 0,
          soft_violations: generation.softViolations ?? 0,
        });
        await refreshServerSaved();
      } else {
        saveLocal({
          name: `Snapshot ${savedItems.length + 1}`,
          fitness: currentTimetable.fitness,
          generationTime: currentTimetable.generation_time_seconds,
          entriesCount: currentTimetable.entries.length,
          timetableJson: JSON.stringify(snapshotPayload),
        });
      }
      toast.success("Snapshot saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save snapshot.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = async (item: DisplaySavedTimetable) => {
    try {
      const timetable =
        item.source === "server"
          ? parseRestorableTimetable((await loadServerDetail(item.id)).timetable_json)
          : parseRestorableTimetable(localSaved.find(saved => saved.id === item.id)?.timetableJson ?? "");

      if (timetable.grid_settings) {
        updateSettings({
          ...settings,
          numberOfDays: timetable.grid_settings.numberOfDays,
          periodsPerDay: timetable.grid_settings.periodsPerDay,
          breakAfterPeriod: timetable.grid_settings.breakAfterPeriod,
          breaks: timetable.grid_settings.breaks,
        });
      }

      restoreGeneration(timetable);
      toast.success(`"${item.name}" loaded to timetable view.`);
      setRestoreId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load saved timetable.";
      toast.error(message);
    }
  };

  const handleExport = async (item: DisplaySavedTimetable) => {
    try {
      const rawJson =
        item.source === "server"
          ? (await loadServerDetail(item.id)).timetable_json
          : (localSaved.find(saved => saved.id === item.id)?.timetableJson ?? "");

      const payload = parseRestorableTimetable(rawJson);
      const entries = payload.entries;
      const gs = payload.grid_settings;

      const snapshotNumDays    = parseInt(gs?.numberOfDays  ?? settings.numberOfDays)  || 5;
      const snapshotNumPeriods = parseInt(gs?.periodsPerDay ?? settings.periodsPerDay) || 7;
      const snapshotBreaks     = gs?.breaks ?? settings.breaks ?? [];

      const dayNames = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].slice(0, snapshotNumDays);

      const SUBJECT_PALETTE = [
        "#DBEAFE","#DCFCE7","#FEF9C3","#FFE4C4","#EDE9FE",
        "#CCFBF1","#FCE7F3","#E0F2FE","#E0E7FF","#FEE2E2",
        "#D1FAE5","#FEF3C7","#DDD6FE","#ECFDF5","#FFF1F2",
      ];
      const colorMap = new Map<string, string>();
      let ci = 0;
      for (const e of entries) {
        if (!colorMap.has(e.subject_id)) {
          colorMap.set(e.subject_id, SUBJECT_PALETTE[ci % SUBJECT_PALETTE.length]);
          ci++;
        }
      }

      const breakSet = new Set(snapshotBreaks.map((b: { day: number; period: number }) => `${b.day}_${b.period}`));
      const periodNums = Array.from({ length: snapshotNumPeriods }, (_, i) => i);

      const buildTable = (
        entityId: string,
        entityName: string,
        entityShort: string,
        mode: "teacher" | "class" | "classroom",
        accent: string,
      ): string => {
        const startMap = new Map<string, typeof entries[0]>();
        const spanned  = new Set<string>();

        for (const entry of entries) {
          const belongs =
            mode === "teacher"   ? entry.teacher_ids.includes(entityId)
            : mode === "class"   ? entry.class_ids.includes(entityId)
            :                      entry.room_ids.includes(entityId);
          if (!belongs) continue;
          startMap.set(`${entry.day}_${entry.start_period}`, entry);
          for (let offset = 1; offset < entry.duration; offset++)
            spanned.add(`${entry.day}_${entry.start_period + offset}`);
        }

        const headerCells = periodNums.map(p =>
          `<th style="background:${accent};color:#fff;padding:9px 4px;font-size:9px;font-weight:700;border:1px solid rgba(255,255,255,0.2);">P${p+1}</th>`
        ).join("");

        const rows = Array.from({ length: snapshotNumDays }, (_, dayIndex) => {
          const skips = new Set<number>();
          let cells = `<td style="background:#f1f5f9;font-size:9px;font-weight:700;color:#475569;text-align:center;padding:6px 4px;border:1px solid #e2e8f0;width:54px;">${dayNames[dayIndex]}</td>`;

          for (const periodIndex of periodNums) {
            if (skips.has(periodIndex)) continue;
            const key = `${dayIndex}_${periodIndex}`;
            if (spanned.has(key)) { cells += `<td style="display:none"></td>`; continue; }

            if (breakSet.has(key)) {
              cells += `<td style="background:#fffbeb;border:1px solid #e2e8f0;text-align:center;vertical-align:middle;padding:4px;">
                <span style="color:#92400e;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;">Break</span>
              </td>`;
              continue;
            }

            const entry = startMap.get(key);
            if (!entry) { cells += `<td style="border:1px solid #e2e8f0;background:#fff;"></td>`; continue; }

            const span = Math.min(entry.duration, snapshotNumPeriods - periodIndex);
            for (let s = 1; s < span; s++) skips.add(periodIndex + s);

            const bg = colorMap.get(entry.subject_id) ?? "#f1f5f9";

            let secondary = "";
            let tertiary  = "";
            if (mode === "teacher") {
              secondary = entry.class_ids.map(id => classes.find(c => c.id === id)?.name).filter(Boolean).join(" / ");
              tertiary  = entry.room_ids.map(id => classrooms.find(r => r.id === id)?.short).filter(Boolean).join(", ");
            } else if (mode === "class") {
              secondary = entry.teacher_ids.map(id => teachers.find(t => t.id === id)?.name.split(" ").pop()).filter(Boolean).join(" / ");
              tertiary  = entry.room_ids.map(id => classrooms.find(r => r.id === id)?.short).filter(Boolean).join(", ");
            } else {
              secondary = entry.class_ids.map(id => classes.find(c => c.id === id)?.name).filter(Boolean).join(" / ");
              tertiary  = entry.teacher_ids.map(id => teachers.find(t => t.id === id)?.name.split(" ").pop()).filter(Boolean).join(" / ");
            }

            cells += `
              <td colspan="${span}" style="background:${bg};border:1px solid #e2e8f0;border-left:3px solid ${accent};padding:5px 6px;vertical-align:middle;">
                <div style="font-size:9px;font-weight:800;color:#1e293b;line-height:1.3;">${entry.subject_name}</div>
                ${secondary ? `<div style="font-size:8px;color:#475569;margin-top:1px;">${secondary}</div>` : ""}
                ${tertiary  ? `<div style="font-size:7.5px;color:#64748b;">${tertiary}</div>` : ""}
                ${entry.duration > 1 ? `<div style="font-size:7px;color:#7c3aed;font-weight:700;margin-top:2px;">[${entry.duration} periods]</div>` : ""}
              </td>`;
          }
          return `<tr>${cells}</tr>`;
        }).join("");

        return `
          <div class="entity-block">
            <div class="entity-header" style="border-left:4px solid ${accent};">
              <span class="entity-name">${entityName}</span>
              <span class="entity-badge">${entityShort}</span>
            </div>
            <table>
              <colgroup><col style="width:54px"/>${periodNums.map(() => `<col/>`).join("")}</colgroup>
              <thead><tr>
                <th style="background:${accent};color:#fff;padding:9px 4px;font-size:9px;font-weight:700;border:1px solid rgba(255,255,255,0.2);">Day</th>
                ${headerCells}
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      };

      const sections = [
        { title: "Class Timetables",   mode: "class"      as const, entities: classes,     accent: "#2563eb" },
        { title: "Teacher Timetables", mode: "teacher"    as const, entities: teachers,    accent: "#16a34a" },
        { title: "Room Timetables",    mode: "classroom"  as const, entities: classrooms,  accent: "#7c3aed" },
      ];

      const coverHeader = `
        <div style="padding:0 0 10px 0;border-bottom:2px solid #e2e8f0;margin-bottom:10px;">
          <div style="font-size:16px;font-weight:800;color:#0f172a;">${item.name}</div>
          <div style="font-size:11px;color:#64748b;margin-top:3px;">
            ${snapshotNumDays} days &times; ${snapshotNumPeriods} periods &nbsp;|&nbsp;
            Saved: ${formatDate(item.savedAt)} &nbsp;|&nbsp;
            Fitness: ${item.fitness?.toFixed(3)}
          </div>
        </div>`;

      const sectionsHTML = sections.map(({ title, mode, entities: ents, accent }, idx) => `
        <div class="section">
          ${idx === 0 ? coverHeader : ""}
          <div class="section-title" style="border-left:5px solid ${accent};color:${accent};">${title}</div>
          ${ents.map(e => buildTable(e.id, e.name, e.short, mode, accent)).join("")}
        </div>
      `).join("");

      const printWindow = window.open("", "_blank", "width=1280,height=900");
      if (!printWindow) { toast.error("Popup blocked. Please allow popups and try again."); return; }

      printWindow.document.write(`
        <!DOCTYPE html><html><head>
        <title>${item.name} — Timetable Report</title>
        <style>
          *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
          body { font-family:'Segoe UI', system-ui, sans-serif; background:#fff; color:#1e293b; }
          .section { margin-bottom:0; }
          .section + .section { page-break-before:always; }
          .section-title {
            font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;
            padding:8px 14px; background:#f8fafc; margin-bottom:0; border-radius:0 4px 4px 0;
          }
          .entity-block {
          page-break-inside:avoid;
          padding:8px 0 16px;
          justify-content:center;
          }
          .entity-block + .entity-block { page-break-before:always; }
          .entity-header {
            display:flex; align-items:center; gap:10px;
            padding:6px 12px; background:#f8fafc;
            border:1px solid #e2e8f0; border-bottom:none; border-radius:6px 6px 0 0;
          }
          .entity-name  { font-size:11px; font-weight:800; color:#0f172a; }
          .entity-badge { font-size:8.5px; color:#64748b; background:#e2e8f0;
                          padding:1px 7px; border-radius:9999px; font-weight:600; }
          table { width:100%; border-collapse:collapse; table-layout:fixed;
                  border:1px solid #e2e8f0; border-top:none; border-radius:0 0 6px 6px; overflow:hidden; }
          th, td { border:1px solid #e2e8f0; height:52px; overflow:hidden;
                   vertical-align:middle; text-align:center; padding:0; }
          thead th { height:30px; font-size:8.5px; font-weight:700; color:#fff;
                     letter-spacing:.03em; padding:0 2px; }
          @media print {
            body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            @page { size:A4 landscape; margin:10mm 12mm; }
            .section { page-break-before:always; }
            .section:first-child { page-break-before:avoid; }
            .entity-block { page-break-inside:avoid; }
          }
        </style>
        </head><body>
        ${sectionsHTML}
        </body></html>
      `);

      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 900);
      toast.success("Print dialog opened — choose 'Save as PDF'.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export timetable.";
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (usingServer) {
        await api.deleteTimetable(id);
        await refreshServerSaved();
      } else {
        removeLocal(id);
      }
      toast.success("Deleted.");
      setDeleteId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete saved timetable.";
      toast.error(message);
    }
  };

  const handleClearAll = async () => {
    try {
      if (usingServer) {
        await Promise.all(savedItems.map(item => api.deleteTimetable(item.id)));
        await refreshServerSaved();
      } else {
        clearLocal();
      }
      toast.success("All cleared.");
      setClearOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear saved timetables.";
      toast.error(message);
    }
  };

  const restoreItem = savedItems.find(item => item.id === restoreId) ?? null;

  return (
    <PageWrapper>
      <div className="flex-1 flex flex-col p-8 gap-6 max-w-5xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Archive className="w-5 h-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">Saved Timetables</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {usingServer
                ? "Saved timetable versions stored on the server."
                : `Store up to ${MAX_SAVED} local timetable snapshots in this browser.`}
            </p>
          </div>
          {savedItems.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearOpen(true)}
              className="text-destructive hover:text-destructive gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_SAVED }).map((_, i) => (
              <div
                key={i}
                className={`w-8 h-1.5 rounded-full transition-colors ${
                  i < savedItems.length ? "bg-foreground" : "bg-border"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{savedItems.length}/{MAX_SAVED} slots used</span>
          {usingServer && isLoading && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading server snapshots
            </span>
          )}
        </div>

        {currentTimetable && (
          <Card className="border-dashed">
            <CardContent className="py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Current timetable ready to save</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fitness: {currentTimetable.fitness?.toFixed(4)} - {currentTimetable.entries?.length ?? 0} entries
                </p>
              </div>
              <Button
                size="sm"
                disabled={savedItems.length >= MAX_SAVED || isSaving}
                onClick={handleSaveSnapshot}
                className="gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Save snapshot
              </Button>
            </CardContent>
          </Card>
        )}

        {savedItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="p-4 rounded-full bg-muted">
              <Archive className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No saved timetables yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Generate a timetable on the Timetable page, then save a snapshot here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {savedItems.map((tt, index) => (
              <Card key={tt.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tt.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{formatDate(tt.savedAt)}</span>
                        <Badge variant="secondary" className="text-xs py-0">
                          fitness {tt.fitness?.toFixed(3)}
                        </Badge>
                        {tt.entriesCount !== null && (
                          <span className="text-xs text-muted-foreground">{tt.entriesCount} entries</span>
                        )}
                        {tt.generationTime !== null && (
                          <span className="text-xs text-muted-foreground">{tt.generationTime.toFixed(1)}s</span>
                        )}
                        <Badge variant="outline" className="text-xs py-0 capitalize">
                          {tt.source}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => handleExport(tt)}
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Export
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setRestoreId(tt.id)}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Load
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteId(tt.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete saved timetable?</DialogTitle>
            <DialogDescription>This snapshot will be permanently removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDelete(deleteId!)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!restoreId} onOpenChange={() => setRestoreId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load this timetable?</DialogTitle>
            <DialogDescription>
              This will restore the saved snapshot into the timetable view. Any current unsaved timetable will be replaced.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreId(null)}>Cancel</Button>
            <Button onClick={() => restoreItem && handleRestore(restoreItem)}>Load</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all saved timetables?</DialogTitle>
            <DialogDescription>All {savedItems.length} snapshots will be permanently removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClearAll}>Clear all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
