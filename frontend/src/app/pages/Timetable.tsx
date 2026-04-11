import { useEffect, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button } from "../components/ui/button";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  DoorOpen,
  FileDown,
  GripVertical,
  RotateCcw,
  School,
  Sparkles,
  Users,
} from "lucide-react";
import type { Subject, Teacher, Class, Classroom } from "../store/useStore";
import { PageWrapper } from "../components/PageWrapper";
import { useStore, TimetableEntry } from "../store/useStore";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";


const DRAG_TYPE = "TIMETABLE_ENTRY";

interface DragPayload {
  entry: TimetableEntry;
  fromDay: number;
  fromPeriod: number;
}

const PALETTE = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#84cc16", "#f97316"];

function entryColor(entry: TimetableEntry, subjects: Subject[]): string {
  const subject = subjects.find(s => s.id === entry.subject_id);
  if (subject?.is_difficult) return "#ef4444";
  if (subject?.is_lab) return "#8b5cf6";

  let hash = 0;
  for (let i = 0; i < entry.subject_id.length; i++) {
    hash = (hash * 31 + entry.subject_id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

function EntryCard({
  entry,
  subjects,
  teachers,
  classes,
  classrooms,
  viewMode,
  day,
  period,
  onSwap,
  canEdit,
}: {
  entry: TimetableEntry;
  subjects: Subject[];
  teachers: Teacher[];
  classes: Class[];
  classrooms: Classroom[];
  viewMode: string;
  day: number;
  period: number;
  onSwap: (dragged: TimetableEntry, target: TimetableEntry) => void;
  canEdit: boolean;
}) {
  const color = entryColor(entry, subjects);
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag<DragPayload, void, { isDragging: boolean }>(() => ({
    type: DRAG_TYPE,
    item: { entry, fromDay: day, fromPeriod: period },
    canDrag: canEdit,
    collect: monitor => ({ isDragging: !!monitor.isDragging() }),
  }), [canEdit, entry, day, period]);

  const [{ isOver }, drop] = useDrop<DragPayload, void, { isOver: boolean }>(() => ({
    accept: DRAG_TYPE,
    canDrop: () => canEdit,
    drop: payload => {
      if (payload.entry.id !== entry.id) onSwap(payload.entry, entry);
    },
    collect: monitor => ({ isOver: !!monitor.isOver() }),
  }), [canEdit, entry, onSwap]);

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`w-full h-full rounded-md p-2 select-none transition-all group ${
        isDragging ? "opacity-40 scale-95" : ""
      } ${isOver ? "ring-2 ring-inset" : ""} ${canEdit ? "cursor-move" : "cursor-default"}`}
      style={{
        backgroundColor: `${color}15`,
        borderLeft: `3px solid ${color}`,
        ...(isOver ? { outline: `2px solid ${color}` } : {}),
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold leading-tight truncate" style={{ color }}>
            {entry.subject_name}
          </p>
          {viewMode === "teacher" && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {entry.class_ids.map(id => classes.find(c => c.id === id)?.short).filter(Boolean).join(", ")}
            </p>
          )}
          {viewMode === "class" && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {entry.teacher_ids.map(id => teachers.find(t => t.id === id)?.short).filter(Boolean).join(", ")}
            </p>
          )}
          {viewMode === "classroom" && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {entry.class_ids.map(id => classes.find(c => c.id === id)?.short).filter(Boolean).join(", ")}
            </p>
          )}
          {viewMode !== "classroom" && entry.room_ids.length > 0 && (
            <p className="text-[10px] text-muted-foreground truncate">
              {entry.room_ids.map(id => classrooms.find(r => r.id === id)?.short).filter(Boolean).join(", ")}
            </p>
          )}
          {entry.duration > 1 && (
            <span
              className="inline-block mt-0.5 text-[9px] font-medium px-1 py-px rounded"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {entry.duration}p
            </span>
          )}
        </div>
        <GripVertical className="w-3 h-3 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

function EmptyCell({
  day,
  period,
  onDrop,
  canEdit,
}: {
  day: number;
  period: number;
  onDrop: (entry: TimetableEntry, day: number, period: number) => void;
  canEdit: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isOver }, drop] = useDrop<DragPayload, void, { isOver: boolean }>(() => ({
    accept: DRAG_TYPE,
    canDrop: () => canEdit,
    drop: payload => onDrop(payload.entry, day, period),
    collect: monitor => ({ isOver: !!monitor.isOver() }),
  }), [canEdit, day, period, onDrop]);
  drop(ref);

  return (
    <div
      ref={ref}
      className={`w-full h-full rounded-md border-2 border-dashed transition-colors min-h-[52px] ${
        isOver && canEdit ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-border/40 bg-muted/10"
      }`}
    />
  );
}

function EntityGrid({
  entityId,
  viewMode,
  numDays,
  numPeriods,
  dayNames,
  entries,
  subjects,
  teachers,
  classes,
  classrooms,
  breaks,
  onSwap,
  onMove,
  canEdit,
}: {
  entityId: string;
  viewMode: string;
  numDays: number;
  numPeriods: number;
  dayNames: string[];
  entries: TimetableEntry[];
  subjects: Subject[];
  teachers: Teacher[];
  classes: Class[];
  classrooms: Classroom[];
  breaks: { day: number; period: number }[];
  onSwap: (a: TimetableEntry, b: TimetableEntry) => void;
  onMove: (entry: TimetableEntry, day: number, period: number) => void;
  canEdit: boolean;
}) {
  const startMap = new Map<string, TimetableEntry>();
  const spanned = new Set<string>();

  for (const entry of entries) {
    const belongs =
      viewMode === "teacher" ? entry.teacher_ids.includes(entityId)
        : viewMode === "class" ? entry.class_ids.includes(entityId)
          : entry.room_ids.includes(entityId);

    if (!belongs) continue;

    startMap.set(`${entry.day}_${entry.start_period}`, entry);
    for (let offset = 1; offset < entry.duration; offset++) {
      spanned.add(`${entry.day}_${entry.start_period + offset}`);
    }
  }

  const periodNums = Array.from({ length: numPeriods }, (_, index) => index);

  return (
    <table className="w-full border-collapse table-fixed text-xs">
      <colgroup>
        <col style={{ width: "52px" }} />
        {periodNums.map(period => <col key={period} />)}
      </colgroup>
      <thead>
        <tr>
          <th className="border border-border bg-muted/60 p-1.5 text-[10px] font-medium text-muted-foreground text-center" />
          {periodNums.map(period => (
            <th
              key={period}
              className="border border-border bg-muted/60 p-1.5 text-[10px] font-medium text-muted-foreground text-center"
            >
              P{period + 1}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: numDays }, (_, dayIndex) => (
          <tr key={dayIndex}>
            <td className="border border-border bg-muted/40 p-1.5 text-[10px] font-medium text-muted-foreground text-center align-middle">
              {dayNames[dayIndex]?.slice(0, 3)}
            </td>

            {periodNums.map(periodIndex => {
              const key = `${dayIndex}_${periodIndex}`;
              if (spanned.has(key)) return null;

              const isBreakCell = breaks.some(b => b.day === dayIndex && b.period === periodIndex);
              const entry = startMap.get(key);

              if (isBreakCell) {
                return (
                  <td
                    key={periodIndex}
                    className="border border-border bg-amber-50 dark:bg-amber-900/20 p-1 text-center align-middle"
                  >
                    <div className="min-h-[52px] flex items-center justify-center">
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        Break
                      </span>
                    </div>
                  </td>
                );
              }

              if (entry) {
                const colSpan = Math.min(entry.duration, numPeriods - periodIndex);
                return (
                  <td key={periodIndex} colSpan={colSpan} className="border border-border p-1 align-top">
                    <div style={{ minHeight: 52 }}>
                      <EntryCard
                        entry={entry}
                        subjects={subjects}
                        teachers={teachers}
                        classes={classes}
                        classrooms={classrooms}
                        viewMode={viewMode}
                        day={dayIndex}
                        period={periodIndex}
                        onSwap={onSwap}
                        canEdit={canEdit}
                      />
                    </div>
                  </td>
                );
              }

              return (
                <td key={periodIndex} className="border border-border p-1 align-top">
                  <EmptyCell day={dayIndex} period={periodIndex} onDrop={onMove} canEdit={canEdit} />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TimetableView() {
  const {
    teachers,
    classes,
    classrooms,
    subjects,
    lessons,
    generation,
    settings,
    startGeneration,
    resetGeneration,
    hasUnsavedChanges,
    backendAvailable,
    saveAll,
    updateTimetableEntry,
  } = useStore();

  const [viewMode, setViewMode] = useState<"teacher" | "class" | "classroom">("teacher");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState("all");

  const numDays = parseInt(settings.numberOfDays) || 5;
  const numPeriods = parseInt(settings.periodsPerDay) || 7;
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].slice(0, numDays);
  const localEntries = generation.timetable?.entries ?? [];
  const breakKeys = new Set((settings.breaks ?? []).map(b => `${b.day}_${b.period}`));

  useEffect(() => {
    if (generation.status === "running") {
      setIsGenerating(true);
      return;
    }

    setIsGenerating(false);
    if (generation.status === "done") {
      toast.success(
        `Generated. Fitness: ${generation.timetable?.fitness?.toFixed(0)}. ` +
        `Time: ${generation.timetable?.generation_time_seconds?.toFixed(2)}s.`,
      );
    } else if (generation.status === "failed") {
      toast.error(generation.error || "Generation failed.");
    }
  }, [generation.status, generation.error, generation.timetable]);

  const handleGenerate = async () => {
    if (!teachers.length || !classes.length || !subjects.length) {
      toast.error("Please add teachers, classes, and subjects first.");
      return;
    }
    if (!lessons.length) {
      toast.error("Please add lessons first.");
      return;
    }

    setIsGenerating(true);
    try {
      if (backendAvailable && hasUnsavedChanges) {
        toast.info("Saving latest changes before generation...");
        await saveAll();
      }
      await startGeneration();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed.";
      toast.error(message);
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    resetGeneration();
    toast.success("Timetable cleared.");
  };

  const timetablePrintRef = useRef<HTMLDivElement>(null);

  const SUBJECT_PALETTE = [
    "#DBEAFE","#DCFCE7","#FEF9C3","#FFE4C4","#EDE9FE",
    "#CCFBF1","#FCE7F3","#E0F2FE","#E0E7FF","#FEE2E2",
    "#D1FAE5","#FEF3C7","#DDD6FE","#ECFDF5","#FFF1F2",
    "#E0F2FE","#FEFCE8","#F3E8FF","#ECFDF5","#FFF7ED",
  ];

  const getSubjectColorMap = (): Map<string, string> => {
    const map = new Map<string, string>();
    let i = 0;
    for (const entry of localEntries) {
      if (!map.has(entry.subject_id)) {
        map.set(entry.subject_id, SUBJECT_PALETTE[i % SUBJECT_PALETTE.length]);
        i++;
      }
    }
    return map;
  };

  const buildEntityTable = (
    entity: Teacher | Class | Classroom,
    mode: "teacher" | "class" | "classroom",
    colorMap: Map<string, string>,
    accent: string,
  ): string => {
    const periodNums = Array.from({ length: numPeriods }, (_, i) => i);
    const breakSet = new Set((settings.breaks ?? []).map((b) => `${b.day}_${b.period}`));

    const startMap = new Map<string, TimetableEntry>();
    const spanned  = new Set<string>();

    for (const entry of localEntries) {
      const belongs =
        mode === "teacher" ? entry.teacher_ids.includes(entity.id)
        : mode === "class"  ? entry.class_ids.includes(entity.id)
        :                     entry.room_ids.includes(entity.id);
      if (!belongs) continue;
      startMap.set(`${entry.day}_${entry.start_period}`, entry);
      for (let offset = 1; offset < entry.duration; offset++)
        spanned.add(`${entry.day}_${entry.start_period + offset}`);
    }

    const headerCells = periodNums.map(p =>
      `<th style="background:${accent};color:#fff;padding:9px 4px;font-size:9px;font-weight:700;border:1px solid rgba(255,255,255,0.2);">P${p+1}</th>`
    ).join("");

    const rows = Array.from({ length: numDays }, (_, dayIndex) => {
      const skips = new Set<number>();
      let cells = `<td style="background:#f1f5f9;font-size:9px;font-weight:700;color:#475569;text-align:center;padding:6px 4px;border:1px solid #e2e8f0;width:54px;">${dayNames[dayIndex]}</td>`;

      for (const periodIndex of periodNums) {
        if (skips.has(periodIndex)) continue;
        const key = `${dayIndex}_${periodIndex}`;
        if (spanned.has(key)) { cells += `<td style="display:none"></td>`; continue; }

        if (breakSet.has(key)) {
          cells += `<td style="background:#fffbeb;border:1px solid #e2e8f0;text-align:center;vertical-align:middle;padding:4px;">
            <span style="color:#92400e;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;">🔔 Break</span>
          </td>`;
          continue;
        }

        const entry = startMap.get(key);
        if (!entry) { cells += `<td style="border:1px solid #e2e8f0;background:#fff;"></td>`; continue; }

        const span    = Math.min(entry.duration, numPeriods - periodIndex);
        for (let s = 1; s < span; s++) skips.add(periodIndex + s);

        const bg      = colorMap.get(entry.subject_id) ?? "#f1f5f9";
        const border  = accent;

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
          <td colspan="${span}" style="background:${bg};border:1px solid #e2e8f0;border-left:3px solid ${border};padding:5px 6px;vertical-align:middle;">
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
          <span class="entity-name">${entity.name}</span>
          <span class="entity-badge">${entity.short}</span>
        </div>
        <table>
          <colgroup><col style="width:54px"/>${periodNums.map(()=>`<col/>`).join("")}</colgroup>
          <thead><tr>
            <th style="background:${accent};color:#fff;padding:9px 4px;font-size:9px;font-weight:700;border:1px solid rgba(255,255,255,0.2);">Day</th>
            ${headerCells}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  const handleExportPDF = () => {
    if (!generation.timetable) return;

    const colorMap = getSubjectColorMap();
    const exportDate = new Date().toLocaleDateString("en-IN", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

    const sections = [
      { title: "Class Timetables",   mode: "class"      as const, entities: classes,     accent: "#2563eb" },
      { title: "Teacher Timetables", mode: "teacher"    as const, entities: teachers,    accent: "#16a34a" },
      { title: "Room Timetables",    mode: "classroom"  as const, entities: classrooms,  accent: "#7c3aed" },
    ];

    const sectionsHTML = sections.map(({ title, mode, entities: ents, accent }) => `
      <div class="section">
        <div class="section-title" style="border-left:5px solid ${accent};color:${accent};">
          ${title}
        </div>
        ${ents.map(e => buildEntityTable(e, mode, colorMap, accent)).join("")}
      </div>
    `).join("");

    // Cover stats
    const totalPeriods = localEntries.reduce((s, e) => s + e.duration, 0);
    const stats = [
      { label: "Classes",      value: classes.length },
      { label: "Teachers",     value: teachers.length },
      { label: "Rooms",        value: classrooms.length },
      { label: "Total Periods",value: totalPeriods },
    ];

    const statsHTML = stats.map(s => `
      <div class="stat-card">
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`).join("");

    const printWindow = window.open("", "_blank", "width=1280,height=900");
    if (!printWindow) { toast.error("Popup blocked. Please allow popups and try again."); return; }

    printWindow.document.write(`
      <!DOCTYPE html><html><head>
      <title>Timetable Report</title>
      <style>
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:'Segoe UI', system-ui, sans-serif; background:#fff; color:#1e293b; }

        /* ── Section ── */
        .section { margin-bottom: 0; }
        .section + .section { page-break-before:always; }
        .section-title {
          font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;
          padding:8px 14px; background:#f8fafc; border-left:5px solid currentColor;
          margin-bottom:0; border-radius:0 4px 4px 0;
          text-align:left;
        }

        /* ── Entity block ── */
        .entity-block {
          page-break-inside:avoid;
          display:flex;
          flex-direction:column;
          justify-content:center;
          min-height:180mm;
          padding:24mm 0 16mm;
        }
        .entity-block + .entity-block { page-break-before:always; }
        .entity-header {
          display:flex; align-items:center; gap:10px;
          padding:6px 12px; background:#f8fafc;
          border:1px solid #e2e8f0; border-bottom:none;
          border-radius:6px 6px 0 0;
        }
        .entity-name  { font-size:11px; font-weight:800; color:#0f172a; }
        .entity-badge { font-size:8.5px; color:#64748b; background:#e2e8f0;
                        padding:1px 7px; border-radius:9999px; font-weight:600; }

        /* ── Table core — fixed layout, equal columns ── */
        table {
          width:100%; border-collapse:collapse; table-layout:fixed;
          border:1px solid #e2e8f0; border-top:none;
          border-radius:0 0 6px 6px; overflow:hidden;
        }
        colgroup col.day-col { width:52px; }

        /* Every cell same fixed height, no content stretching rows */
        th, td {
          border:1px solid #e2e8f0;
          height:52px;
          overflow:hidden;
          vertical-align:middle;
          text-align:center;
          padding:0;
        }

        /* Header row */
        thead th {
          height:30px;
          font-size:8.5px; font-weight:700;
          color:#fff; letter-spacing:.03em;
          padding:0 2px;
        }
        thead th.day-col { background:#334155 !important; }

        /* Day label column */
        tbody td.day-cell {
          background:#f1f5f9; font-size:8.5px; font-weight:700;
          color:#475569; text-align:center; padding:0 2px;
        }

        /* Break cell */
        tbody td.break-cell {
          background:#fffbeb !important;
          font-size:8px; font-weight:800; color:#92400e;
          text-transform:uppercase; letter-spacing:.06em;
        }

        /* Empty cell */
        tbody td.empty-cell { background:#fff; }

        /* Subject cell wrapper — fills the fixed-height td */
        .cell-inner {
          display:flex; flex-direction:column; justify-content:center;
          align-items:flex-start; gap:1px;
          height:52px; padding:4px 6px;
          border-left:3px solid transparent;
          overflow:hidden;
        }
        .cell-subject { font-size:9px; font-weight:800; color:#1e293b;
                        line-height:1.25; white-space:nowrap; overflow:hidden;
                        text-overflow:ellipsis; max-width:100%; }
        .cell-secondary { font-size:7.5px; color:#475569; white-space:nowrap;
                          overflow:hidden; text-overflow:ellipsis; max-width:100%; }
        .cell-tertiary  { font-size:7px; color:#64748b; white-space:nowrap;
                          overflow:hidden; text-overflow:ellipsis; max-width:100%; }
        .cell-duration  { font-size:7px; font-weight:700; color:#7c3aed; margin-top:1px; }

        /* Alternating row tint — only on empty/day cells, not subject cells */
        tbody tr:nth-child(even) td.empty-cell { background:#f8fafc; }
        tbody tr:nth-child(even) td.day-cell   { background:#eef2f7; }

        /* ── Print ── */
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
  };

  const isLockedEntry = (entry: TimetableEntry) => lessons.find(l => l.id === entry.lesson_id)?.is_locked ?? false;

  const overlapsRange = (entry: TimetableEntry, day: number, startPeriod: number, duration: number) => {
    if (entry.day !== day) return false;
    const targetEnd = startPeriod + duration;
    const entryEnd = entry.start_period + entry.duration;
    return entry.start_period < targetEnd && entryEnd > startPeriod;
  };

  const sharesResources = (a: TimetableEntry, b: TimetableEntry) => (
    a.teacher_ids.some(id => b.teacher_ids.includes(id)) ||
    a.class_ids.some(id => b.class_ids.includes(id)) ||
    a.room_ids.some(id => b.room_ids.includes(id))
  );

  const spansBreak = (day: number, startPeriod: number, duration: number) => {
    for (let offset = 0; offset < duration; offset++) {
      if (breakKeys.has(`${day}_${startPeriod + offset}`)) return true;
    }
    return false;
  };

  const findBlockingEntry = (
    entry: TimetableEntry,
    day: number,
    startPeriod: number,
    duration: number,
    ignoredIds: string[] = [],
  ) => localEntries.find(candidate =>
    !ignoredIds.includes(candidate.id) &&
    sharesResources(entry, candidate) &&
    overlapsRange(candidate, day, startPeriod, duration),
  );

  const handleSwap = (dragged: TimetableEntry, target: TimetableEntry) => {
    if (dragged.id === target.id) return;
    if (isLockedEntry(dragged) || isLockedEntry(target)) {
      toast.error("Locked lessons cannot be moved or swapped.");
      return;
    }

    if (target.start_period + dragged.duration > numPeriods || dragged.start_period + target.duration > numPeriods) {
      toast.error("Those lessons do not fit in each other's slots.");
      return;
    }

    if (
      spansBreak(target.day, target.start_period, dragged.duration) ||
      spansBreak(dragged.day, dragged.start_period, target.duration)
    ) {
      toast.error("A lesson cannot be moved across a break slot.");
      return;
    }

    const draggedBlocker = findBlockingEntry(dragged, target.day, target.start_period, dragged.duration, [dragged.id, target.id]);
    const targetBlocker = findBlockingEntry(target, dragged.day, dragged.start_period, target.duration, [dragged.id, target.id]);
    if (draggedBlocker || targetBlocker) {
      toast.error(`Can't swap because it would conflict with ${draggedBlocker?.subject_name ?? targetBlocker?.subject_name}.`);
      return;
    }

    updateTimetableEntry(dragged.id, { ...dragged, day: target.day, start_period: target.start_period });
    updateTimetableEntry(target.id, { ...target, day: dragged.day, start_period: dragged.start_period });
    toast.success(`Swapped "${dragged.subject_name}" with "${target.subject_name}".`);
  };

  const handleMove = (entry: TimetableEntry, toDay: number, toPeriod: number) => {
    if (entry.day === toDay && entry.start_period === toPeriod) return;
    if (isLockedEntry(entry)) {
      toast.error("Locked lessons cannot be moved or swapped.");
      return;
    }

    if (toPeriod + entry.duration > numPeriods) {
      toast.error(
        `"${entry.subject_name}" (${entry.duration}p) does not fit there. ` +
        `P${toPeriod + 1} only has ${numPeriods - toPeriod} periods left in the day.`,
      );
      return;
    }

    if (spansBreak(toDay, toPeriod, entry.duration)) {
      toast.error(`"${entry.subject_name}" can't be placed across a break slot.`);
      return;
    }

    const blocked = findBlockingEntry(entry, toDay, toPeriod, entry.duration, [entry.id]);
    if (blocked) {
      toast.error(
        `"${entry.subject_name}" can't move there because "${blocked.subject_name}" ` +
        "already uses one of the same teachers, classes, or rooms at that time.",
      );
      return;
    }

    updateTimetableEntry(entry.id, { ...entry, day: toDay, start_period: toPeriod });
    toast.success(`Moved "${entry.subject_name}" to ${dayNames[toDay]?.slice(0, 3)} P${toPeriod + 1}.`);
  };

  const entities: (Teacher | Class | Classroom)[] =
    viewMode === "teacher" ? teachers : viewMode === "class" ? classes : classrooms;

  const filtered = selectedEntityId === "all"
    ? entities
    : entities.filter(entity => entity.id === selectedEntityId);

  useEffect(() => {
    setSelectedEntityId("all");
  }, [viewMode]);

  return (
    <PageWrapper>
      <div className="flex-1 flex flex-col p-8 gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-lg bg-muted">
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </div>
          <div>
              <h1 className="text-xl font-semibold">Timetable Generation</h1>
              <p className="text-sm text-muted-foreground">Generate and view schedules</p>
            </div>
          </div>
          <div className="flex gap-2">
            {generation.timetable && (
              <>
                <Button onClick={handleExportPDF} variant="outline" size="sm" className="gap-1.5">
                  <FileDown className="w-4 h-4" /> Export PDF
                </Button>
                <Button onClick={handleReset} variant="outline" size="sm" className="gap-1.5">
                  <RotateCcw className="w-4 h-4" /> Reset
                </Button>
              </>
            )}
            <Button onClick={handleGenerate} disabled={isGenerating} size="sm" className="gap-1.5">
              <Sparkles className="w-4 h-4" />
              {isGenerating ? "Generating..." : "Generate Timetable"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Users, label: "Teachers", count: teachers.length },
            { icon: School, label: "Classes", count: classes.length },
            { icon: DoorOpen, label: "Rooms", count: classrooms.length },
            { icon: BookOpen, label: "Subjects", count: subjects.length },
          ].map(({ icon: Icon, label, count }) => (
            <Card key={label}>
              <CardHeader className="pb-1 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-semibold">{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {generation.status !== "idle" && (
          <div className={`px-4 py-2.5 rounded-lg border text-sm ${
            generation.status === "done"
              ? "border-green-200 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200"
              : generation.status === "failed"
                ? "border-red-200 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200"
                : "border-blue-200 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200"
          }`}>
            {generation.status === "running" && "Generating timetable..."}
            {generation.status === "done" && `Done. Fitness ${generation.timetable?.fitness?.toFixed(0)}. ${generation.timetable?.generation_time_seconds?.toFixed(2)}s. ${localEntries.length} scheduled entries.`}
            {generation.status === "failed" && generation.error}
          </div>
        )}

        {localEntries.length > 0 ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-base">Generated Timetable</CardTitle>
                  <CardDescription className="text-xs mt-0.5 flex items-center gap-1">
                    <GripVertical className="w-3 h-3" />
                    Drag onto another lesson to swap. Drag to an empty cell to move.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        All {viewMode === "teacher" ? "Teachers" : viewMode === "class" ? "Classes" : "Rooms"}
                      </SelectItem>
                      {entities.map(entity => (
                        <SelectItem key={entity.id} value={entity.id}>
                          {entity.name} ({entity.short})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Tabs value={viewMode} onValueChange={value => setViewMode(value as typeof viewMode)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="teacher" className="text-xs px-3">Teachers</TabsTrigger>
                      <TabsTrigger value="class" className="text-xs px-3">Classes</TabsTrigger>
                      <TabsTrigger value="classroom" className="text-xs px-3">Rooms</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No {viewMode}s available.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {filtered.map(entity => (
                    <div key={entity.id} className="rounded-lg border border-border overflow-hidden">
                      <div className="px-4 py-2 border-b border-border bg-muted/40 flex items-center gap-2">
                        <span className="text-sm font-semibold">{entity.name}</span>
                        <span className="text-xs text-muted-foreground">({entity.short})</span>
                      </div>
                      <div className="overflow-x-auto p-2">
                        <EntityGrid
                          entityId={entity.id}
                          viewMode={viewMode}
                          numDays={numDays}
                          numPeriods={numPeriods}
                          dayNames={dayNames}
                          entries={localEntries}
                          subjects={subjects}
                          teachers={teachers}
                          classes={classes}
                          classrooms={classrooms}
                          breaks={settings.breaks ?? []}
                          onSwap={handleSwap}
                          onMove={handleMove}
                          canEdit={true}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Calendar className="w-12 h-12 text-muted-foreground/30" />
              <p className="text-base font-medium">No timetable generated yet</p>
              <p className="text-sm text-muted-foreground">Click "Generate Timetable" to create a schedule.</p>
              {(!teachers.length || !classes.length || !subjects.length) && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mt-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    Add teachers, classes, and subjects first.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}

export function Timetable() {
  return (
    <DndProvider backend={HTML5Backend}>
      <TimetableView />
    </DndProvider>
  );
}
