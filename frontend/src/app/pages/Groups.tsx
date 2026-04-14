import React, { useState, useEffect, useMemo } from "react";
import {
  Layers, Plus, Trash2, X, ArrowRight, ArrowLeft, Save, Check,
  Settings as SettingsIcon, Users, School, BookOpen, DoorOpen, Coffee,
  HelpCircle, Info, Pencil, Calendar, Clock
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { PageWrapper } from "../components/PageWrapper";
import { useStore, Break, Lesson, Teacher, Subject, Class, Classroom } from "../store/useStore";
import { toast } from "sonner";
import { api, MiniGroupOut } from "../api";
import { cn } from "../components/ui/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";

const MAX_GROUPS = 3;

interface DraftGroup {
  id?: string;
  name: string;
  days_per_week: number;
  periods_per_day: number;
  breaks: Break[];
  selected_subject_ids: string[];
  selected_teacher_ids: string[];
  selected_room_ids: string[];
  selected_class_ids: string[];
}

const emptyDraft = (): DraftGroup => ({
  name: "", days_per_week: 5, periods_per_day: 7, breaks: [],
  selected_subject_ids: [], selected_teacher_ids: [], selected_room_ids: [], selected_class_ids: []
});

function BreakGrid({ draft, setDraft }: { draft: DraftGroup, setDraft: React.Dispatch<React.SetStateAction<DraftGroup>> }) {
  const numDays = draft.days_per_week || 1;
  const numPeriods = draft.periods_per_day || 1;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].slice(0, numDays);
  const periods = Array.from({ length: numPeriods }, (_, i) => i + 1);

  const toggleBreak = (day: number, period: number) => {
    setDraft(prev => {
      const exists = prev.breaks.some(b => b.day === day && b.period === period);
      return {
        ...prev,
        breaks: exists ? prev.breaks.filter(b => !(b.day === day && b.period === period)) : [...prev.breaks, { day, period }]
      };
    });
  };

  return (
    <div className="overflow-x-auto border rounded-xl mt-2 w-full">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-2 bg-muted/50 text-xs font-medium text-muted-foreground w-14">Day\P</th>
            {periods.map(p => <th key={p} className="border p-2 bg-muted/50 text-xs font-medium text-muted-foreground w-10">{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {days.map((day, dIdx) => (
            <tr key={dIdx}>
              <td className="border bg-muted/30 p-2 text-xs font-medium">{day}</td>
              {periods.map((_, pIdx) => {
                const isBreak = draft.breaks.some(b => b.day === dIdx && b.period === pIdx);
                return (
                  <td key={pIdx} className="border p-0">
                    <button onClick={() => toggleBreak(dIdx, pIdx)}
                      className={cn("w-full h-9 transition-colors", isBreak ? "bg-amber-100 hover:bg-amber-200" : "bg-card hover:bg-muted/50")}>
                      {isBreak && <Coffee className="w-3.5 h-3.5 text-amber-600 mx-auto" />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TwoPanelSelector({ items, selectedIds, onChange, renderItem, filterVariant }: any) {
  const [filter, setFilter] = useState("None");
  const available = items.filter((i: any) => !selectedIds.includes(i.id));
  const selected = items.filter((i: any) => selectedIds.includes(i.id));

  let displayed = available;
  if (filterVariant === "subject" && filter !== "None") {
    if (filter === "Lab Only") displayed = available.filter((i: any) => i.is_lab);
    if (filter === "Non-Lab Only") displayed = available.filter((i: any) => !i.is_lab);
  }

  return (
    <div className="grid grid-cols-2 gap-4 h-full min-h-[300px] flex-1">
      <div className="border rounded flex flex-col hover:border-primary/50 transition-colors">
        <div className="p-3 border-b bg-muted/50 flex justify-between items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-medium text-sm flex items-center gap-1 cursor-help">Available <Info className="w-3.5 h-3.5 text-muted-foreground" /></span>
            </TooltipTrigger>
            <TooltipContent>Click items below to add them to the selection</TooltipContent>
          </Tooltip>
          {filterVariant === "subject" && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="None">No Filter</SelectItem>
                <SelectItem value="Lab Only">Lab Only</SelectItem>
                <SelectItem value="Non-Lab Only">Non-Lab Only</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="p-2 flex-1 overflow-y-auto max-h-[500px] space-y-1">
          {displayed.length === 0 ? <p className="text-xs text-muted-foreground p-2">Empty pool</p> : null}
          {displayed.map((item: any) => (
            <div key={item.id} onClick={() => onChange([...selectedIds, item.id])}
              className="p-2 rounded border cursor-pointer hover:bg-muted/50 text-sm flex justify-between items-center transition-all hover:pl-3">
              {renderItem(item)} <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mx-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="border rounded flex flex-col hover:border-primary/50 transition-colors">
        <div className="p-3 border-b bg-muted/50 font-medium text-sm flex items-center gap-1 cursor-help">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">Selected Subset <Info className="w-3.5 h-3.5 text-muted-foreground" /></div>
            </TooltipTrigger>
            <TooltipContent>Click items below to remove them from the selection</TooltipContent>
          </Tooltip>
        </div>
        <div className="p-2 flex-1 overflow-y-auto max-h-[500px] space-y-1">
          {selected.length === 0 ? <p className="text-xs text-muted-foreground p-2">None selected</p> : null}
          {selected.map((item: any) => (
            <div key={item.id} onClick={() => onChange(selectedIds.filter((id: string) => id !== item.id))}
              className="p-2 rounded border border-primary/20 bg-primary/5 cursor-pointer hover:border-destructive hover:bg-destructive/10 text-sm flex justify-between items-center group transition-all">
              <div className="flex-1 min-w-0">{renderItem(item)}</div>
              <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground ml-2 opacity-0 group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const renderSubject = (s: Subject) => <div className="truncate text-left flex flex-col"><span className="font-medium">{s.name}</span><span className="text-xs text-muted-foreground">{s.short} {s.is_lab ? "• Lab" : ""}</span></div>;
const renderTeacher = (t: Teacher) => <div className="truncate text-left flex flex-col"><span className="font-medium">{t.name}</span><span className="text-xs text-muted-foreground">{t.short}</span></div>;
const renderRoom = (r: Classroom) => <div className="truncate text-left flex flex-col"><span className="font-medium">{r.name}</span><span className="text-xs text-muted-foreground">Type: {r.is_lab ? "Lab" : "Room"}</span></div>;
const renderClass = (c: Class) => <div className="truncate text-left flex flex-col"><span className="font-medium">{c.name}</span><span className="text-xs text-muted-foreground">Capacity: {c.capacity}</span></div>;
const renderLesson = (l: Lesson, subs: Subject[], teachs: Teacher[], rooms: Classroom[], classes: Class[]) => {
  const sub = subs.find(s => s.id === l.subject_id)?.name || "Unknown";
  const trs = teachs.filter(t => l.teacher_ids.includes(t.id)).map(t => t.name).join(", ");
  const cls = classes.filter(c => l.class_ids.includes(c.id)).map(c => c.name).join(", ");
  const rms = rooms.filter(r => l.room_ids.includes(r.id)).map(r => r.name).join(", ");
  const tPw = l.sessions.reduce((a, b) => a + (b.duration * b.count), 0);
  return (
    <div className="flex flex-col text-left">
      <span className="font-medium text-[13px]">{sub} ({tPw} periods/wk)</span>
      <span className="text-[11px] text-muted-foreground truncate">{trs} | {cls} | {rms}</span>
    </div>
  );
};

export function Groups() {
  const { teachers, classes, classrooms, groups, subjects, lessons, fetchGroups, updateGroup, deleteGroup, settings, addLesson, deleteLesson, saveAll, loadScopedData } = useStore();
  const [view, setView] = useState<"list" | "wizard" | "edit">("list");

  // States for Wizard / Edit
  const [draft, setDraft] = useState<DraftGroup>(emptyDraft());
  const [draftLessons, setDraftLessons] = useState<Lesson[]>([]);
  const [wizardStage, setWizardStage] = useState<number>(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Draft explicit new lesson (inline form)
  const [inlineLesson, setInlineLesson] = useState<{ subject_id: string; teacher_ids: string[]; room_ids: string[]; class_ids: string[]; sessions: any[] }>(
    { subject_id: "", teacher_ids: [], room_ids: [], class_ids: [], sessions: [{ duration: 1, count: 1 }] }
  );

  // Track which main lesson IDs have been imported (for the wizard two-panel selector display)
  const [importedMainLessonIds, setImportedMainLessonIds] = useState<string[]>([]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const STAGES = ["Setup", "Subjects", "Teachers", "Rooms", "Classes", "Lessons", "Review"];

  const handleCreate = () => {
    setDraft(emptyDraft());
    setDraftLessons([]);
    setImportedMainLessonIds([]);
    setWizardStage(1);
    setView("wizard");
    // Ensure we are in 'main' scope before starting wizard (since we import from it)
    loadScopedData("main");
  };

  const handleEdit = async (g: MiniGroupOut) => {
    try {
      const overrides = JSON.parse(g.teacher_time_off_overrides || "{}");
      setDraft({
        id: g.id, name: g.name, days_per_week: g.days_per_week || 5, periods_per_day: g.periods_per_day || 7,
        breaks: overrides.breaks || [],
        selected_subject_ids: JSON.parse(g.selected_subject_ids || "[]"),
        selected_teacher_ids: JSON.parse(g.selected_teacher_ids || "[]"),
        selected_room_ids: JSON.parse(g.selected_room_ids || "[]"),
        selected_class_ids: JSON.parse(g.selected_class_ids || "[]")
      });
      // Switch store to this mini-group's lessons context
      await loadScopedData(g.id);
    } catch { setDraft(emptyDraft()); }
    setDraftLessons([]);
    setView("edit");
  };

  const executeSave = async () => {
    if (!draft.name.trim()) return toast.error("Group name is required.");
    try {
      const payload = {
        name: draft.name.trim(),
        days_per_week: draft.days_per_week,
        periods_per_day: draft.periods_per_day,
        break_after_period: 3, // fallback not used directly by our grid
        teacher_time_off_overrides: JSON.stringify({ breaks: draft.breaks }),
        selected_subject_ids: JSON.stringify(draft.selected_subject_ids),
        selected_teacher_ids: JSON.stringify(draft.selected_teacher_ids),
        selected_room_ids: JSON.stringify(draft.selected_room_ids),
        selected_class_ids: JSON.stringify(draft.selected_class_ids)
      };

      let groupId = draft.id;
      if (groupId) {
        await updateGroup(groupId, payload);
        toast.success("Mini Group updated.");
      } else {
        const res = await api.createMiniGroup(payload);
        groupId = res.id;
        toast.success("Mini Group created.");
      }

      // Commit draft lessons — deep copies with mini_group_id set; addLesson auto-generates a new id
      for (const l of draftLessons) {
        const { id: _discardId, ...rest } = l;
        addLesson({ ...rest, mini_group_id: groupId });
      }

      // Save using specific group scope
      await saveAll(groupId);

      // Revert store context back to 'main' lessons before returning to list
      await loadScopedData("main");
      
      setView("list");
      await fetchGroups();
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
  };

  const saveInlineLesson = () => {
    if (!inlineLesson.subject_id || !inlineLesson.teacher_ids.length || !inlineLesson.class_ids.length || !inlineLesson.room_ids.length) {
      return toast.error("Subjects, teachers, classes, and rooms must all be selected for the lesson.");
    }
    const nl: Lesson = {
      id: `local_${Date.now()}`, is_locked: false, locked_day: null, locked_duration: null, locked_start_period: null,
      subject_id: inlineLesson.subject_id, teacher_ids: inlineLesson.teacher_ids, class_ids: inlineLesson.class_ids,
      room_ids: inlineLesson.room_ids, sessions: inlineLesson.sessions, mini_group_id: draft.id
    };
    if (view === "wizard") {
      setDraftLessons(prev => [...prev, nl]);
    } else {
      addLesson(nl);
      saveAll(draft.id).then(() => toast.success("Added directly to group lessons."));
    }
    setInlineLesson({ subject_id: "", teacher_ids: [], room_ids: [], class_ids: [], sessions: [{ duration: 1, count: 1 }] });
  };

  const eligibleMainLessons = useMemo(() => {
    return lessons.filter(l =>
      !l.mini_group_id &&
      draft.selected_subject_ids.includes(l.subject_id) &&
      l.teacher_ids.every(t => draft.selected_teacher_ids.includes(t)) &&
      l.class_ids.every(c => draft.selected_class_ids.includes(c)) &&
      l.room_ids.every(r => draft.selected_room_ids.includes(r))
    );
  }, [lessons, draft]);

  const activeGroupLessons = lessons.filter(l => l.mini_group_id === draft.id);

  // Wizard Dialog State handling
  const canAdvance = () => {
    if (wizardStage === 1 && !draft.name.trim()) return false;
    return true;
  };

  const wizardPanel = () => {
    switch (wizardStage) {
      case 1: return (
        <div className="space-y-4 py-4">
          <div className="bg-muted/20 p-2 rounded-md text-[11px] text-muted-foreground border-l-2 border-primary/50">
            <span className="font-medium text-foreground/80">Schedule Foundation:</span> Begin by outlining the base dimensions of the mini-group's week. These exist entirely independent from the main timetable.
          </div>
          <div className="space-y-1.5"><Label>Group Name</Label><Input value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Remedial Batch" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Tooltip><TooltipTrigger asChild><Label className="cursor-help flex items-center gap-1 w-max">Days in a Week <Info className="w-3 h-3 text-muted-foreground" /></Label></TooltipTrigger><TooltipContent>Total active days in the group's custom schedule</TooltipContent></Tooltip>
              <Select value={draft.days_per_week.toString()} onValueChange={v => setDraft(p => ({ ...p, days_per_week: parseInt(v) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6, 7].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5">
              <Tooltip><TooltipTrigger asChild><Label className="cursor-help flex items-center gap-1 w-max">Periods per Day <Info className="w-3 h-3 text-muted-foreground" /></Label></TooltipTrigger><TooltipContent>Total periods available each day</TooltipContent></Tooltip>
              <Select value={draft.periods_per_day.toString()} onValueChange={v => setDraft(p => ({ ...p, periods_per_day: parseInt(v) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="space-y-1.5 pt-2"><Label>Break Structure</Label><CardDescription className="text-xs">Click cells to designate as breaks for this mini-group's schedule.</CardDescription><BreakGrid draft={draft} setDraft={setDraft} /></div>
        </div>
      );
      case 2: return <div className="py-4"><div className="mb-4 bg-muted/20 p-2 rounded-md text-[11px] text-muted-foreground border-l-2 border-primary/50">Select which subjects (theory or lab) will be taught within this grouping. Use the filter dropdown to easily locate Labs.</div><TwoPanelSelector filterVariant="subject" itemName="Subjects" items={subjects} selectedIds={draft.selected_subject_ids} onChange={(v: string[]) => setDraft(p => ({ ...p, selected_subject_ids: v }))} renderItem={renderSubject} /></div>;
      case 3: return <div className="py-4"><div className="mb-4 bg-muted/20 p-2 rounded-md text-[11px] text-muted-foreground border-l-2 border-primary/50">Select the specific teachers participating in this group. Their max load limits from the main system still loosely apply.</div><TwoPanelSelector itemName="Teachers" items={teachers} selectedIds={draft.selected_teacher_ids} onChange={(v: string[]) => setDraft(p => ({ ...p, selected_teacher_ids: v }))} renderItem={renderTeacher} /></div>;
      case 4: return <div className="py-4"><div className="mb-4 bg-muted/20 p-2 rounded-md text-[11px] text-muted-foreground border-l-2 border-primary/50">Define the spaces available. Ensure you select Labs if your Subjects require them.</div><TwoPanelSelector itemName="Rooms" items={classrooms} selectedIds={draft.selected_room_ids} onChange={(v: string[]) => setDraft(p => ({ ...p, selected_room_ids: v }))} renderItem={renderRoom} /></div>;
      case 5: return <div className="py-4"><div className="mb-4 bg-muted/20 p-2 rounded-md text-[11px] text-muted-foreground border-l-2 border-primary/50">Assign the student classes involved. Only selected classes can be assigned to lessons.</div><TwoPanelSelector itemName="Classes" items={classes} selectedIds={draft.selected_class_ids} onChange={(v: string[]) => setDraft(p => ({ ...p, selected_class_ids: v }))} renderItem={renderClass} /></div>;
      case 6: return (
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Label>Import Compatible Main Lessons</Label>
              <div className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Main List</div>
            </div>
            <CardDescription className="text-xs mb-3">Below are lessons from your main schedule that fit within this group's selected participants. Toggle them to import copies into this group.</CardDescription>
            <TwoPanelSelector itemName="Lessons" items={eligibleMainLessons} selectedIds={importedMainLessonIds} onChange={(ids: string[]) => {
              setImportedMainLessonIds(ids);
              // Deep-copy selected main lessons into draftLessons with new unique IDs
              const copied = eligibleMainLessons
                .filter(l => ids.includes(l.id))
                .map(l => ({
                  ...l,
                  id: `copy_${l.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                  sessions: l.sessions.map(s => ({ ...s })),
                  teacher_ids: [...l.teacher_ids],
                  class_ids: [...l.class_ids],
                  room_ids: [...l.room_ids],
                  mini_group_id: draft.id ?? undefined,
                }));
              // Preserve any manually-added inline draft lessons (those not originating from import)
              const manualDrafts = draftLessons.filter(dl => !dl.id.startsWith('copy_'));
              setDraftLessons([...manualDrafts, ...copied]);
            }} renderItem={(l: Lesson) => renderLesson(l, subjects, teachers, classrooms, classes)} />
          </div>
          <div className="border border-dashed border-primary/40 bg-primary/5 rounded-lg p-6 text-center space-y-2 mt-4">
            <BookOpen className="w-8 h-8 text-primary/50 mx-auto" />
            <p className="font-medium text-foreground text-sm">Need to add completely new lessons?</p>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-md mx-auto">Standalone lessons for this group can be drafted using the <strong>Edit Ribbon</strong> after you finish this wizard. For now, simply select existing ones above!</p>
          </div>
        </div>
      );
      case 7: return (
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 border p-4 rounded bg-muted/10 text-sm">
            <div><span className="font-semibold block">Metadata</span>Name: {draft.name} <br />Schedule: {draft.days_per_week} Days x {draft.periods_per_day} Periods</div>
            <div><span className="font-semibold block">Entity Pools</span>Subs: {draft.selected_subject_ids.length} | Trs: {draft.selected_teacher_ids.length} <br />Rms: {draft.selected_room_ids.length} | Cls: {draft.selected_class_ids.length}</div>
          </div>
          <div className="bg-primary/10 border-l-4 border-primary p-3 text-sm text-primary-foreground rounded-md flex items-center gap-2">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <span><strong>Note:</strong> You can insert completely new lessons for this group directly via the "Edit" menu after creation.</span>
          </div>
          <div>
            <Label>Included Lessons</Label>
            <div className="flex flex-col gap-1.5 mt-2 bg-muted/20 border rounded p-2 max-h-40 overflow-y-auto">
              {draftLessons.length === 0 ? <span className="text-xs text-muted-foreground p-2">No grouped lessons.</span> : null}
              {draftLessons.map(l => (
                <div key={l.id} className="border bg-card p-2 rounded flex justify-between items-center group">
                  {renderLesson(l, subjects, teachers, classrooms, classes)}
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 p-1 h-7 text-destructive" onClick={() => setDraftLessons(p => p.filter(x => x.id !== l.id))}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <PageWrapper>
      {view === "list" && (
        <div className="flex-1 flex flex-col p-8 gap-6 max-w-5xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1"><Layers className="w-5 h-5 text-muted-foreground" /><h1 className="text-xl font-semibold">Mini Groups</h1></div>
              <p className="text-sm text-muted-foreground">Isolate custom timetable data configurations, enabling separate generation loops.</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" disabled={groups.length >= MAX_GROUPS} onClick={handleCreate} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> New Group</Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {groups.length >= MAX_GROUPS ? `Maximum ${MAX_GROUPS} groups reached` : "Create a new mini group with its own schedule, entities, and lessons"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Getting Started Guide */}
          {groups.length === 0 && (
            <div className="border border-dashed border-primary/30 bg-primary/5 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-sm">What are Mini Groups?</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mini Groups let you create <strong>independent scheduling units</strong> with their own grid dimensions, breaks, and lesson data.
                They are useful for remedial batches, elective clusters, lab rotations, or any sub-schedule that doesn't share the main timetable's structure.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="flex items-start gap-2 text-xs">
                  <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div><strong className="block">Own Schedule</strong><span className="text-muted-foreground">Custom days × periods grid</span></div>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <Layers className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div><strong className="block">Isolated Lessons</strong><span className="text-muted-foreground">Separate from main data</span></div>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <BookOpen className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div><strong className="block">Import & Create</strong><span className="text-muted-foreground">Copy main lessons or add new</span></div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">{Array.from({ length: MAX_GROUPS }).map((_, i) => <div key={i} className={`w-10 h-1.5 rounded-full transition-colors ${i < groups.length ? "bg-foreground" : "bg-border"}`} />)}</div>
            <span className="text-xs text-muted-foreground">{groups.length}/{MAX_GROUPS} groups</span>
          </div>

          {groups.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-center">
              <div className="p-4 rounded-full bg-muted"><Layers className="w-6 h-6 text-muted-foreground" /></div>
              <p className="text-sm font-medium">No groups yet</p>
              <p className="text-xs text-muted-foreground max-w-xs">Click "New Group" above to create your first scheduling group.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((group) => {
                const tCount = JSON.parse(group.selected_teacher_ids || "[]").length;
                const sCount = JSON.parse(group.selected_subject_ids || "[]").length;
                const rCount = JSON.parse(group.selected_room_ids || "[]").length;
                const cCount = JSON.parse(group.selected_class_ids || "[]").length;
                const lCount = lessons.filter(l => l.mini_group_id === group.id).length;
                return (
                  <Card key={group.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Layers className="w-5 h-5" /></div>
                          <div><CardTitle className="text-base">{group.name}</CardTitle><CardDescription className="text-xs">{group.days_per_week ?? 5}d × {group.periods_per_day ?? 7}p</CardDescription></div>
                        </div>
                        <div className="flex gap-1">
                          <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(group)}><Pencil className="w-4 h-4 mr-1" /> Edit</Button>
                          </TooltipTrigger><TooltipContent>Modify entities, schedule, and lessons</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteId(group.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </TooltipTrigger><TooltipContent>Delete this group permanently</TooltipContent></Tooltip>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-muted/50">
                          <BookOpen className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Subs</span>
                          <span className="font-semibold ml-auto">{sCount}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-muted/50">
                          <Users className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Teach</span>
                          <span className="font-semibold ml-auto">{tCount}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-muted/50">
                          <DoorOpen className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Rooms</span>
                          <span className="font-semibold ml-auto">{rCount}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-muted/50">
                          <School className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Cls</span>
                          <span className="font-semibold ml-auto">{cCount}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{lCount} lesson{lCount !== 1 ? 's' : ''} configured</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit View - Horizontal Ribbon pattern */}
      {view === "edit" && (
        <div className="flex-1 flex flex-col pt-4 overflow-hidden max-h-screen">
          <div className="px-6 flex items-center justify-between shrink-0 mb-4">
            <div className="flex items-center gap-3"><Layers className="w-5 h-5 text-muted-foreground" /><h1 className="text-xl font-semibold">Editing: {draft.name}</h1></div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                setView("list");
                loadScopedData("main"); // Revert scope
              }}>Cancel</Button>
              <Button onClick={executeSave} size="sm" className="gap-2"><Save className="w-4 h-4" /> Save All Tabs</Button>
            </div>
          </div>
          <Tabs defaultValue="schedule" className="flex-1 flex flex-col overflow-hidden px-6 pb-6">
            <TabsList className="grid w-full grid-cols-6 shrink-0 h-12 bg-muted/80 backdrop-blur-md">
              <TabsTrigger value="schedule" className="h-10 text-[13px]">Schedule</TabsTrigger>
              <TabsTrigger value="subjects" className="h-10 text-[13px]">Subjects</TabsTrigger>
              <TabsTrigger value="teachers" className="h-10 text-[13px]">Teachers</TabsTrigger>
              <TabsTrigger value="rooms" className="h-10 text-[13px]">Rooms</TabsTrigger>
              <TabsTrigger value="classes" className="h-10 text-[13px]">Classes</TabsTrigger>
              <TabsTrigger value="lessons" className="h-10 text-[13px]">Lessons</TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="flex-1 overflow-y-auto pt-6 px-1">
              <div className="max-w-xl space-y-4">
                <div className="space-y-1.5"><Label>Group Name</Label><Input value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Days</Label><Select value={draft.days_per_week.toString()} onValueChange={v => setDraft(p => ({ ...p, days_per_week: parseInt(v) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6, 7].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label>Periods</Label><Select value={draft.periods_per_day.toString()} onValueChange={v => setDraft(p => ({ ...p, periods_per_day: parseInt(v) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="space-y-1.5"><Label>Break Map</Label><BreakGrid draft={draft} setDraft={setDraft} /></div>
              </div>
            </TabsContent>
            <TabsContent value="subjects" className="flex-1 flex flex-col overflow-hidden pt-4"><TwoPanelSelector filterVariant="subject" itemName="Subjects" items={subjects} selectedIds={draft.selected_subject_ids} onChange={(v: string[]) => setDraft(p => ({ ...p, selected_subject_ids: v }))} renderItem={renderSubject} /></TabsContent>
            <TabsContent value="teachers" className="flex-1 flex flex-col overflow-hidden pt-4"><TwoPanelSelector itemName="Teachers" items={teachers} selectedIds={draft.selected_teacher_ids} onChange={(v: string[]) => setDraft(p => ({ ...p, selected_teacher_ids: v }))} renderItem={renderTeacher} /></TabsContent>
            <TabsContent value="rooms" className="flex-1 flex flex-col overflow-hidden pt-4"><TwoPanelSelector itemName="Rooms" items={classrooms} selectedIds={draft.selected_room_ids} onChange={(v: string[]) => setDraft(p => ({ ...p, selected_room_ids: v }))} renderItem={renderRoom} /></TabsContent>
            <TabsContent value="classes" className="flex-1 flex flex-col overflow-hidden pt-4"><TwoPanelSelector itemName="Classes" items={classes} selectedIds={draft.selected_class_ids} onChange={(v: string[]) => setDraft(p => ({ ...p, selected_class_ids: v }))} renderItem={renderClass} /></TabsContent>
            <TabsContent value="lessons" className="flex-1 overflow-hidden pt-4 flex flex-col space-y-4">
              <div className="flex-1 flex overflow-hidden border rounded border-border">
                <div className="w-1/2 flex flex-col border-r bg-muted/10">
                  <div className="p-3 border-b font-medium text-sm">Add New Lesson</div>
                  <div className="p-4 flex-1 space-y-3 overflow-y-auto">
                    <Select value={inlineLesson.subject_id} onValueChange={v => setInlineLesson(p => ({ ...p, subject_id: v }))}><SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger><SelectContent>{subjects.filter(s => draft.selected_subject_ids.includes(s.id)).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
                    <Select value={inlineLesson.teacher_ids[0] || ""} onValueChange={v => setInlineLesson(p => ({ ...p, teacher_ids: [v] }))}><SelectTrigger><SelectValue placeholder="Primary Teacher" /></SelectTrigger><SelectContent>{teachers.filter(t => draft.selected_teacher_ids.includes(t.id)).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
                    <Select value={inlineLesson.class_ids[0] || ""} onValueChange={v => setInlineLesson(p => ({ ...p, class_ids: [v] }))}><SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger><SelectContent>{classes.filter(c => draft.selected_class_ids.includes(c.id)).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                    <Select value={inlineLesson.room_ids[0] || ""} onValueChange={v => setInlineLesson(p => ({ ...p, room_ids: [v] }))}><SelectTrigger><SelectValue placeholder="Room" /></SelectTrigger><SelectContent>{classrooms.filter(r => draft.selected_room_ids.includes(r.id)).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>

                    <div className="flex flex-col gap-2 mt-2">
                      <Label className="text-xs text-muted-foreground mb-1">Sessions Configuration</Label>
                      {inlineLesson.sessions.map((ses, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Select value={ses.duration.toString()} onValueChange={v => { const sm = [...inlineLesson.sessions]; sm[idx].duration = parseInt(v) as any; setInlineLesson(p => ({ ...p, sessions: sm })) }}>
                            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="1">1P</SelectItem><SelectItem value="2">2P</SelectItem><SelectItem value="3">3P</SelectItem></SelectContent>
                          </Select>
                          <span className="text-xs">×</span>
                          <Input type="number" min="1" className="w-16 h-9" value={ses.count} onChange={e => { const sm = [...inlineLesson.sessions]; sm[idx].count = parseInt(e.target.value) || 1; setInlineLesson(p => ({ ...p, sessions: sm })) }} />
                          {inlineLesson.sessions.length > 1 && (
                            <Button variant="ghost" size="sm" className="ml-auto p-1 h-7 text-destructive" onClick={() => setInlineLesson(p => ({ ...p, sessions: p.sessions.filter((_, i) => i !== idx) }))}><Trash2 className="w-4 h-4" /></Button>
                          )}
                        </div>
                      ))}
                      <Button variant="secondary" size="sm" className="text-xs self-start" onClick={() => setInlineLesson(p => ({ ...p, sessions: [...p.sessions, { duration: 1, count: 1 }] }))}>+ Add Session Block</Button>
                    </div>

                    <Button onClick={saveInlineLesson} className="w-full">Inject to Group</Button>
                  </div>
                </div>
                <div className="w-1/2 flex flex-col">
                  <div className="p-3 border-b font-medium text-sm">Saved Group Lessons</div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {activeGroupLessons.length === 0 ? <p className="text-xs text-muted-foreground p-2">No custom group lessons.</p> : null}
                    {activeGroupLessons.map(l => (
                      <div key={l.id} className="border p-2 rounded hover:border-primary group flex justify-between items-center bg-card">
                        {renderLesson(l, subjects, teachers, classrooms, classes)}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="p-1 h-7 text-primary" onClick={() => {
                            setInlineLesson({ subject_id: l.subject_id, teacher_ids: l.teacher_ids, room_ids: l.room_ids, class_ids: l.class_ids, sessions: [...l.sessions] });
                            deleteLesson(l.id);
                            saveAll(draft.id);
                          }}><SettingsIcon className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" className="p-1 h-7 text-destructive" onClick={() => { deleteLesson(l.id); saveAll(draft.id); }}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Creation Wizard Dialog */}
      <Dialog open={view === "wizard"} onOpenChange={open => { if (!open) { setView("list"); loadScopedData("main"); } }}>
        <DialogContent className="sm:max-w-[95vw] md:max-w-[700px] w-[95vw] max-h-[90vh] h-[90vh] flex flex-col overflow-hidden outline-none">
          <DialogHeader className="shrink-0 flex flex-col border-b pb-4">
            <DialogTitle>Create Mini Group</DialogTitle>
            <div className="flex mt-3 bg-muted/50 rounded-lg p-2 justify-between">
              {STAGES.map((s, idx) => (
                <div key={idx} className={cn("text-xs font-medium px-2 py-1 rounded transition-colors flex items-center", wizardStage === idx + 1 ? "bg-primary text-primary-foreground" : wizardStage > idx + 1 ? "text-primary" : "text-muted-foreground")}>
                  {wizardStage > idx + 1 && <Check className="w-3 h-3 mr-1" />} {idx + 1}. {s}
                </div>
              ))}
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1 outline-none relative mt-2">
            {wizardPanel()}
          </div>
          <DialogFooter className="shrink-0 border-t pt-4 flex sm:justify-between items-center w-full">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setView("list")}>Cancel</Button>
            </div>
            <div className="flex gap-2 relative z-10 w-auto justify-end">
              {wizardStage > 1 && <Button variant="outline" onClick={() => setWizardStage(prev => prev - 1)}>Back</Button>}
              {wizardStage < STAGES.length && <Button onClick={() => setWizardStage(prev => prev + 1)} disabled={!canAdvance()}>Next Step</Button>}
              {wizardStage === STAGES.length && <Button onClick={executeSave} className="bg-green-600 hover:bg-green-700">Save Mini Group</Button>}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Prompt */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Group?</DialogTitle><DialogDescription>All metadata and lessons uniquely associated with this group will be destroyed.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button><Button variant="destructive" onClick={async () => { await deleteGroup(deleteId!); setDeleteId(null); }}>Erase</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </PageWrapper>
  );
}
