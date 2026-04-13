import { useState, useEffect, useMemo } from "react";
import { Layers, Plus, Trash2, Users, BookOpen, ChevronDown, ChevronUp, Check, CalendarOff, Box, Settings, Copy, PlusCircle, Trash, X, Info, Sliders, Save, RefreshCcw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { PageWrapper } from "../components/PageWrapper";
import { useStore, Teacher, slotsToGrid, gridToSlots } from "../store/useStore";
import { toast } from "sonner";
import { MiniGroupOut, api } from "../api";
import { cn } from "../components/ui/utils";
import { Slider } from "../components/ui/slider";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";

const MAX_GROUPS = 6;

const SOFT_CONSTRAINTS = [
  { id: "S1", name: "Teacher daily load", desc: "Penalize excess periods per day for teachers" },
  { id: "S2", name: "Difficult last period", desc: "Avoid major subjects in the final slot" },
  { id: "S3", name: "Repeat subject/day", desc: "Penalize same subject appearing twice for a class" },
  { id: "S4", name: "Class schedule gaps", desc: "Penalize free periods between active lessons" },
  { id: "S5", name: "Max consecutive", desc: "Respect max consecutive periods for teachers" },
  { id: "S6", name: "Subject distribution", desc: "Evening spread of subjects across weekdays" },
  { id: "S7", name: "Avoid Friday Labs", desc: "Penalize lab sessions assigned to Friday" },
  { id: "S8", name: "Consec. distinct blocks", desc: "Avoid back-to-back different subject blocks" },
  { id: "S9", name: "Pack lessons early", desc: "Prefer earlier days (Mon-Thu) over Friday/Sat" },
  { id: "S10", name: "Max 1 lab/day", desc: "Ensure classes don't have multiple labs in one day" },
  { id: "S11", name: "First period empty", desc: "Penalize gaps in the first period for classes" },
  { id: "lab", name: "Avoid morning lab", desc: "Prefer labs outside the first two periods" },
];

const INTENSITY_WEIGHTS = [
    [0.3, 0.2, 0.2, 0.5, 0.2, 0.3, 0.1, 0.3, 0.2, 0.5,  0.8, 0.2], // minimal
    [1.0, 0.8, 0.7, 2.0, 0.5, 1.2, 0.3, 1.0, 0.8, 2.0,  3.0, 0.5], // medium
    [2.0, 1.5, 1.5, 4.0, 1.0, 2.5, 0.7, 2.0, 1.5, 4.0,  6.0, 1.0], // hard
    [4.0, 3.0, 3.0, 8.0, 2.0, 5.0, 1.5, 4.0, 3.0, 8.0, 12.0, 2.0], // very strict
];

const PRESETS = {
  default: { mask: "366503872447", name: "Balanced Default" },
  strict: { mask: "1099511627775", name: "Maximum Strictness" },
  hardOnly: { mask: "0", name: "Hard Constraints Only" },
};

export function Groups() {
  const { teachers, classes, classrooms, groups, subjects, fetchGroups, updateGroup, deleteGroup, settings, lessons, addLesson } = useStore();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("setup");

  // Form state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  
  // Custom TimeOffsets
  const [draftTimeOffs, setDraftTimeOffs] = useState<Record<string, string>>({});
  const [isTimeOffDialogOpen, setIsTimeOffDialogOpen] = useState(false);
  const [selectedGroupTeacher, setSelectedGroupTeacher] = useState<Teacher | null>(null);
  const [timeOffGrid, setTimeOffGrid] = useState<boolean[][]>([]);

  // Lessons
  const [draftCopiedLessons, setDraftCopiedLessons] = useState<Set<string>>(new Set());
  const [draftNewLessons, setDraftNewLessons] = useState<any[]>([]);

  // Constraints State
  const [constraintEnables, setConstraintEnables] = useState<boolean[]>(new Array(12).fill(true));
  const [constraintIntensities, setConstraintIntensities] = useState<number[]>(new Array(12).fill(1)); // 0-3
  const [mcp, setMcp] = useState(3);
  const [ldg, setLdg] = useState(1);
  const [manualMaskInput, setManualMaskInput] = useState("");

  // Draft New Lesson inline form
  const [isDraftLessonOpen, setIsDraftLessonOpen] = useState(false);
  const [draftLessonForm, setDraftLessonForm] = useState({
     subject_id: "", teacher_ids: [] as string[], class_ids: [] as string[], room_ids: [] as string[],
     sessions: [{ duration: 1 as 1 | 2 | 3, count: 1 }], is_locked: false, locked_day: 0, locked_start_period: 1, locked_duration: 1
  });

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const numberOfDays = parseInt(settings.numberOfDays);
  const periodsPerDay = parseInt(settings.periodsPerDay);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].slice(0, numberOfDays);
  const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);

  const resetForm = () => {
    setEditingGroupId(null); setFormName(""); setSelectedTeachers([]); setSelectedClasses([]); setSelectedRooms([]); setSelectedSubjects([]);
    setDraftTimeOffs({}); setDraftCopiedLessons(new Set()); setDraftNewLessons([]); setActiveTab("setup");
  };

  const openCreate = () => { resetForm(); setIsCreateOpen(true); };

  const openEdit = (group: MiniGroupOut) => {
    setEditingGroupId(group.id);
    setFormName(group.name);
    try { setSelectedTeachers(JSON.parse(group.selected_teacher_ids || "[]")); } catch { setSelectedTeachers([]); }
    try { setSelectedClasses(JSON.parse(group.selected_class_ids || "[]")); } catch { setSelectedClasses([]); }
    try { setSelectedRooms(JSON.parse(group.selected_room_ids || "[]")); } catch { setSelectedRooms([]); }
    try { setSelectedSubjects(JSON.parse(group.selected_subject_ids || "[]")); } catch { setSelectedSubjects([]); }
    try { setDraftTimeOffs(JSON.parse(group.teacher_time_off_overrides || "{}")); } catch { setDraftTimeOffs({}); }
    
    setDraftCopiedLessons(new Set());
    setDraftNewLessons([]);
    decodeToState(group.constraint_mask?.toString() || "0");
    setActiveTab("setup");
    setIsCreateOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("Group name is required"); return; }
    
    try {
      const mask = calculateMask();
      const data = {
        name: formName.trim(),
        selected_teacher_ids: JSON.stringify(selectedTeachers),
        selected_class_ids: JSON.stringify(selectedClasses),
        selected_room_ids: JSON.stringify(selectedRooms),
        selected_subject_ids: JSON.stringify(selectedSubjects),
        teacher_time_off_overrides: JSON.stringify(draftTimeOffs),
        constraint_mask: Number(mask),
      };

      let groupId = editingGroupId;

      if (editingGroupId) {
        await updateGroup(editingGroupId, data);
        toast.success(`Group "${data.name}" updated`);
      } else {
        if (groups.length >= MAX_GROUPS) { toast.error(`Maximum ${MAX_GROUPS} groups allowed`); return; }
        const res = await api.createMiniGroup(data);
        groupId = res.id;
        toast.success(`Group "${data.name}" created`);
      }

      // Handle drafted lessons (new and copied)
      if (groupId) {
         const toCopy = lessons.filter(l => draftCopiedLessons.has(l.id));
         for (const l of toCopy) {
            addLesson({ ...l, mini_group_id: groupId });
         }
         if (toCopy.length > 0) toast.success(`Copied ${toCopy.length} lesson(s) to group`);

         for (const form of draftNewLessons) {
            addLesson({
              subject_id: form.subject_id,
              teacher_ids: form.teacher_ids,
              class_ids: form.class_ids,
              room_ids: form.room_ids,
              sessions: form.sessions,
              is_locked: form.is_locked,
              locked_day: form.is_locked ? form.locked_day : null,
              locked_start_period: form.is_locked ? form.locked_start_period - 1 : null,
              locked_duration: form.is_locked ? form.locked_duration : null,
              mini_group_id: groupId
            });
         }
         if (draftNewLessons.length > 0) toast.success(`Created ${draftNewLessons.length} new group-specific lesson(s)`);
         await fetchGroups(); // sync just in case
      }

      setIsCreateOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save group");
    }
  };

  const handleDelete = async (id: string) => {
    try { await deleteGroup(id); setDeleteId(null); toast.success("Group deleted"); } catch (e: any) { toast.error("Failed to delete"); }
  };

  const toggleSelection = (id: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  // --- Time Off UI Logic ---
  const handleOpenTimeOff = (teacher: Teacher) => {
    setSelectedGroupTeacher(teacher);
    const maskValue = draftTimeOffs[teacher.id] !== undefined ? draftTimeOffs[teacher.id] : teacher.available_mask;
    
    const unavailable_slots: { day: number; period: number }[] = [];
    if (maskValue !== -1 && maskValue !== "-1") {
      let maskBig: bigint;
      try { maskBig = BigInt(maskValue); } catch { maskBig = 0n; }
      const breakKeys = new Set(settings.breaks.map(b => `${b.day}_${b.period}`));
      for (let day = 0; day < numberOfDays; day++) {
        for (let period = 0; period < periodsPerDay; period++) {
          if (breakKeys.has(`${day}_${period}`)) continue;
          const slot = BigInt(day * periodsPerDay + period);
          if ((maskBig & (1n << slot)) === 0n) unavailable_slots.push({ day, period });
        }
      }
    }
    
    setTimeOffGrid(slotsToGrid(unavailable_slots, numberOfDays, periodsPerDay));
    setIsTimeOffDialogOpen(true);
  };

  const handleSaveDraftTimeOff = () => {
    if (!selectedGroupTeacher) return;
    const teacher = selectedGroupTeacher;
    const unavailableSlots = gridToSlots(timeOffGrid);
    const blocked = new Set(unavailableSlots.map(s => `${s.day}_${s.period}`));
    const breakKeys = new Set(settings.breaks.map(s => `${s.day}_${s.period}`));
    
    let mask = 0n;
    for (let day = 0; day < numberOfDays; day++) {
      for (let period = 0; period < periodsPerDay; period++) {
        const key = `${day}_${period}`;
        if (breakKeys.has(key) || blocked.has(key)) continue;
        const slot = BigInt(day * periodsPerDay + period);
        mask |= 1n << slot;
      }
    }

  // --- Mask Logic ---
  const calculateMask = () => {
    let mask = 0n;
    // Flags 0-11
    for (let i = 0; i < 12; i++) {
        if (constraintEnables[i]) mask |= (1n << BigInt(i));
    }
    // Intensities 12-35
    for (let i = 0; i < 12; i++) {
        const level = BigInt(constraintIntensities[i] & 3);
        mask |= (level << BigInt(12 + i * 2));
    }
    // Tuning 36-39
    mask |= (BigInt(mcp & 3) << 36n);
    mask |= (BigInt(ldg & 3) << 38n);
    return mask;
  };

  const decodeToState = (maskStr: string) => {
    let mask: bigint;
    try { mask = BigInt(maskStr); } catch { mask = 0n; }
    
    const enables = new Array(12).fill(false);
    for (let i = 0; i < 12; i++) {
        if ((mask & (1n << BigInt(i))) !== 0n) enables[i] = true;
    }
    setConstraintEnables(enables);

    const levels = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
        levels[i] = Number((mask >> BigInt(12 + i * 2)) & 3n);
    }
    setConstraintIntensities(levels);

    setMcp(Number((mask >> 36n) & 3n));
    setLdg(Number((mask >> 38n) & 3n));
    setManualMaskInput(maskStr);
  };

  const currentMask = useMemo(() => calculateMask(), [constraintEnables, constraintIntensities, mcp, ldg]);
  const maskHex = useMemo(() => "0x" + currentMask.toString(16).toUpperCase(), [currentMask]);
  const maskBin = useMemo(() => currentMask.toString(2).padStart(40, '0').match(/.{1,4}/g)?.join(' ') || "", [currentMask]);

  // --- Draft Lesson Form Logic ---
  const handleAddDraftLesson = () => {
    if (draftLessonForm.subject_id && draftLessonForm.teacher_ids.length > 0 && draftLessonForm.class_ids.length > 0 && draftLessonForm.room_ids.length > 0) {
      setDraftNewLessons(prev => [...prev, draftLessonForm]);
      setIsDraftLessonOpen(false);
    } else {
      toast.error("Please fill all required lesson fields (Subject, Teachers, Classes, Rooms)!");
    }
  };

  return (
    <PageWrapper>
      <div className="flex-1 flex flex-col p-8 gap-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
             <div className="flex items-center gap-2.5 mb-1"><Layers className="w-5 h-5 text-muted-foreground" /><h1 className="text-xl font-semibold">Groups</h1></div>
             <p className="text-sm text-muted-foreground">Define isolated scheduling groups (e.g. Extra Classes). Up to {MAX_GROUPS} groups allowed.</p>
          </div>
          <Button size="sm" disabled={groups.length >= MAX_GROUPS} onClick={openCreate} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create group</Button>
        </div>

        {/* Slot indicator */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">{Array.from({ length: MAX_GROUPS }).map((_, i) => <div key={i} className={`w-10 h-1.5 rounded-full transition-colors ${i < groups.length ? "bg-foreground" : "bg-border"}`} />)}</div>
          <span className="text-xs text-muted-foreground">{groups.length}/{MAX_GROUPS} groups</span>
        </div>

        {/* Groups List */}
        {groups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="p-4 rounded-full bg-muted"><Layers className="w-6 h-6 text-muted-foreground" /></div>
            <p className="text-sm font-medium">No groups yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">Create a group to isolate teachers, spaces, and timetables.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => {
               let tIds: string[] = []; try { tIds = JSON.parse(group.selected_teacher_ids || "[]"); } catch {}
               const groupLessons = lessons.filter(l => l.mini_group_id === group.id);
               return (
                <Card key={group.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0"><Layers className="w-4 h-4 text-muted-foreground" /></div>
                         <div className="min-w-0">
                           <CardTitle className="text-base truncate pr-2">{group.name}</CardTitle>
                           <CardDescription className="text-xs">{tIds.length} teachers · {groupLessons.length} lessons</CardDescription>
                         </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                         <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(group)}><Settings className="w-4 h-4" /></Button>
                         <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(group.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
               );
            })}
          </div>
        )}
      </div>

      {/* Tabbed Dialog for Create/Edit */}
      <Dialog open={isCreateOpen} onOpenChange={(v) => { setIsCreateOpen(v); if (!v) resetForm(); }}>
         <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle>{editingGroupId ? "Edit Group" : "Create Group"}</DialogTitle>
              <DialogDescription>Configure base settings, overrides, and included lessons inline.</DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col mt-2">
               <TabsList className="grid w-full grid-cols-4 shrink-0">
                  <TabsTrigger value="setup">1. Setup Tools</TabsTrigger>
                  <TabsTrigger value="timeoff" disabled={selectedTeachers.length === 0}>2. Time-Offs</TabsTrigger>
                  <TabsTrigger value="lessons">3. Lessons</TabsTrigger>
                  <TabsTrigger value="constraints">4. Constraints</TabsTrigger>
               </TabsList>

               {/* TAB 1: SETUP */}
               <TabsContent value="setup" className="flex-1 overflow-y-auto pr-2 mt-4 space-y-5">
                  <div className="space-y-1.5">
                    <Label>Group Name</Label>
                    <Input placeholder="e.g. Evening Batch" value={formName} onChange={(e) => setFormName(e.target.value)} />
                  </div>
                  
                  <div className="space-y-4">
                     {[{ label: "Included Subjects", items: subjects, sel: selectedSubjects, setSel: setSelectedSubjects },
                       { label: "Included Teachers", items: teachers, sel: selectedTeachers, setSel: setSelectedTeachers },
                       { label: "Included Classes", items: classes, sel: selectedClasses, setSel: setSelectedClasses },
                       { label: "Included Rooms", items: classrooms, sel: selectedRooms, setSel: setSelectedRooms }].map((sec, i) => (
                        <div key={i} className="space-y-1.5">
                           <div className="flex items-center justify-between"><Label>{sec.label}</Label><span className="text-xs text-muted-foreground">{sec.sel.length} selected</span></div>
                           <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto border p-1 rounded-md bg-muted/20">
                              {sec.items.length === 0 ? <p className="col-span-2 text-xs p-2">None available</p> : null}
                              {sec.items.map((it) => {
                                 const isSelected = sec.sel.includes(it.id);
                                 return (
                                   <button key={it.id} onClick={() => toggleSelection(it.id, sec.setSel)}
                                      className={`flex items-center justify-between px-3 py-1.5 rounded-md border text-sm text-left ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                                      <span className="truncate">{it.name}</span>
                                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                                   </button>
                                 );
                              })}
                           </div>
                        </div>
                     ))}
                  </div>
               </TabsContent>

               {/* TAB 2: TIME OFF */}
               <TabsContent value="timeoff" className="flex-1 overflow-y-auto pr-2 mt-4 space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-950 pb-3 p-3 rounded text-sm text-amber-700 dark:text-amber-200">
                     Override time-offs for teachers explicitly for this group. It will not affect their main schedule.
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     {teachers.filter(t => selectedTeachers.includes(t.id)).map(t => {
                        const hasOverride = draftTimeOffs[t.id] !== undefined;
                        return (
                           <div key={t.id} className="flex flex-col gap-1.5 py-2 px-3 rounded-md border bg-card">
                              <span className="font-medium text-sm truncate">{t.name}</span>
                              <div className="flex justify-between items-center mt-1">
                                 <span className="text-xs text-muted-foreground">{hasOverride ? "Custom set" : "Using main config"}</span>
                                 <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2" onClick={() => handleOpenTimeOff(t)}>
                                    <CalendarOff className="w-3 h-3" /> Set Time-Off
                                 </Button>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </TabsContent>

               {/* TAB 3: LESSONS */}
               <TabsContent value="lessons" className="flex-1 overflow-y-auto pr-2 mt-4 space-y-6">
                  {/* Copy existing */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Duplicate Included Main Lessons</h3>
                    <div className="border rounded bg-muted/10 p-2 max-h-40 overflow-y-auto space-y-1">
                       {lessons.filter(l => !l.mini_group_id).length === 0 ? <p className="text-xs text-muted-foreground p-2">No main lessons to copy</p> : null}
                       {lessons.filter(l => !l.mini_group_id).map(l => {
                          const isSel = draftCopiedLessons.has(l.id);
                          return (
                             <button key={l.id} className={`w-full flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors text-left ${isSel ? 'border-primary bg-primary/5' : ''}`}
                               onClick={() => {
                                 const next = new Set(draftCopiedLessons);
                                 next.has(l.id) ? next.delete(l.id) : next.add(l.id);
                                 setDraftCopiedLessons(next);
                               }}>
                               <span className="text-sm">{l.subject_name || 'Unnamed lesson'}</span>
                               {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
                             </button>
                          );
                       })}
                    </div>
                  </div>

                  {/* Create New Lesson inline */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                       <h3 className="text-sm font-semibold">Custom Group Lessons</h3>
                       <Button size="sm" variant="secondary" className="h-7 text-xs gap-1 px-2" onClick={() => {
                          setDraftLessonForm({ subject_id:"", teacher_ids:[], class_ids:[], room_ids:[], sessions:[{duration:1, count:1}], is_locked:false, locked_day:0, locked_start_period:1, locked_duration:1 });
                          setIsDraftLessonOpen(true);
                       }}>
                          <PlusCircle className="w-3.5 h-3.5" /> Draft New Lesson
                       </Button>
                    </div>
                    {/* Showing local drafts */}
                    {draftNewLessons.length > 0 && (
                       <div className="space-y-1.5 mb-2">
                          <p className="text-xs text-muted-foreground">To be created on save:</p>
                          {draftNewLessons.map((dl, idx) => (
                             <div key={idx} className="flex justify-between items-center text-sm p-2 border border-primary/20 bg-primary/5 rounded">
                                <span>{subjects.find(s=>s.id === dl.subject_id)?.name || "New Lesson"} (Draft)</span>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => setDraftNewLessons(prev => prev.filter((_, i) => i !== idx))}><Trash className="w-3 h-3"/></Button>
                             </div>
                          ))}
                       </div>
                    )}
                    {/* Showing Existing Group Lessons (when editing) */}
                    {editingGroupId && (
                       <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">Already saved in group:</p>
                          {lessons.filter(l => l.mini_group_id === editingGroupId).length === 0 ? <p className="text-xs px-1">None yet</p> : null}
                          {lessons.filter(l => l.mini_group_id === editingGroupId).map(l => (
                             <div key={l.id} className="text-sm p-2 border bg-card rounded flex justify-between">
                               <span>{l.subject_name || 'Unnamed'}</span>
                               <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Saved</span>
                             </div>
                          ))}
                       </div>
                    )}
                  </div>
                </TabsContent>

               {/* TAB 4: CONSTRAINTS (Mask Encoder) */}
               <TabsContent value="constraints" className="flex-1 overflow-y-auto pr-2 mt-4 flex flex-col gap-6">
                  <div className="flex gap-6 items-start">
                      {/* Left side: Soft Constraints List */}
                      <div className="flex-1 space-y-4">
                          <div className="flex items-center justify-between mb-2">
                             <h4 className="text-sm font-semibold flex items-center gap-2"><Sliders className="w-4 h-4" /> Soft Constraints List</h4>
                             <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Genetic Algorithm Integrated</Badge>
                          </div>
                          
                          <div className="space-y-4 pr-1">
                              {SOFT_CONSTRAINTS.map((sc, idx) => {
                                  const intensity = constraintIntensities[idx];
                                  const weight = INTENSITY_WEIGHTS[intensity][idx];
                                  const isOn = constraintEnables[idx];
                                  
                                  return (
                                    <div key={sc.id} className={cn("p-3 border rounded-lg bg-card/50 transition-all", !isOn && "opacity-40 grayscale-[0.5]")}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-muted-foreground mr-2">{sc.id}</span>
                                                <span className="text-sm font-semibold">{sc.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={cn("text-xs font-mono font-bold", isOn ? "text-emerald-500" : "text-muted-foreground")}>{isOn ? "ACTIVE" : "OFF"}</span>
                                                <Switch checked={isOn} onCheckedChange={(v) => {
                                                    const next = [...constraintEnables];
                                                    next[idx] = v;
                                                    setConstraintEnables(next);
                                                }} />
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <Slider 
                                                        disabled={!isOn}
                                                        value={[intensity]} 
                                                        min={0} max={3} step={1} 
                                                        onValueChange={([v]) => {
                                                            const next = [...constraintIntensities];
                                                            next[idx] = v;
                                                            setConstraintIntensities(next);
                                                        }}
                                                        className={cn("transition-colors", isOn && "data-[disabled]:opacity-100")}
                                                    />
                                                </div>
                                                <div className="w-20 text-right">
                                                    <Badge variant="secondary" className={cn("text-[10px] uppercase", 
                                                        intensity === 0 ? "bg-blue-500/10 text-blue-500" :
                                                        intensity === 1 ? "bg-emerald-500/10 text-emerald-500" :
                                                        intensity === 2 ? "bg-orange-500/10 text-orange-500" : "bg-red-500/10 text-red-500"
                                                    )}>
                                                        {["Minimal", "Medium", "Hard", "Strict"][intensity]}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                                <p className="max-w-[180px] leading-tight italic">{sc.desc}</p>
                                                <div className="flex items-center gap-1">
                                                    <span>Weight value:</span>
                                                    <span className="font-mono text-foreground font-bold">{weight.toFixed(1)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                  )
                              })}
                          </div>
                      </div>

                      {/* Right side: Sidebar (Tuning & Presets) */}
                      <div className="w-64 space-y-5 sticky top-0 shrink-0">
                          <div className="p-4 border rounded-xl bg-muted/30 space-y-4">
                              <h5 className="text-xs font-bold uppercase tracking-widest opacity-70">Global Tuning</h5>
                              <div className="space-y-3">
                                  <div className="space-y-1">
                                      <Label className="text-[10px] font-bold">Max Consecutive Periods (S5)</Label>
                                      <Select value={mcp.toString()} onValueChange={(v) => setMcp(parseInt(v))}>
                                          <SelectTrigger className="h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                              {[2,3,4,5].map(v => <SelectItem key={v} value={v.toString()}>{v} Periods</SelectItem>)}
                                          </SelectContent>
                                      </Select>
                                  </div>
                                  <div className="space-y-1">
                                      <Label className="text-[10px] font-bold">Last Day Gap (S9)</Label>
                                      <Select value={ldg.toString()} onValueChange={(v) => setLdg(parseInt(v))}>
                                          <SelectTrigger className="h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                              {[0,1,2,3].map(v => <SelectItem key={v} value={v.toString()}>{v} Day(s)</SelectItem>)}
                                          </SelectContent>
                                      </Select>
                                  </div>
                              </div>
                          </div>

                          <div className="p-4 border border-emerald-500/20 rounded-xl bg-emerald-500/[0.03] space-y-4">
                              <h5 className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex justify-between items-center">
                                  Mask Encoder <Box className="w-3 h-3" />
                              </h5>
                              <div className="space-y-2">
                                  <div className="space-y-1">
                                      <Label className="text-[10px] font-bold opacity-70">Encoded Integer</Label>
                                      <div className="p-2 border rounded bg-background font-mono text-sm break-all font-bold shadow-sm">{currentMask.toString()}</div>
                                  </div>
                                  <div className="flex gap-2">
                                      <div className="flex-1 space-y-1">
                                          <Label className="text-[10px] font-bold opacity-70">Hex Code</Label>
                                          <div className="px-2 py-1 border rounded bg-background font-mono text-[10px] truncate opacity-80">{maskHex}</div>
                                      </div>
                                  </div>
                                  <div className="space-y-1">
                                      <Label className="text-[10px] font-bold opacity-70">Binary String</Label>
                                      <div className="px-2 py-1 border rounded bg-background font-mono text-[9px] break-all leading-tight opacity-60 tracking-tighter">{maskBin}</div>
                                  </div>
                              </div>
                          </div>

                          <div className="space-y-2">
                              <h5 className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1">Intensity Presets</h5>
                              <div className="grid grid-cols-1 gap-1.5">
                                  {Object.entries(PRESETS).map(([key, p]) => (
                                      <Button key={key} variant="outline" size="sm" className="h-8 text-[10px] font-bold justify-start gap-2 hover:bg-primary/5 hover:border-primary/30" onClick={() => decodeToState(p.mask)}>
                                          <PlusCircle className="w-3 h-3 text-primary" /> {p.name}
                                      </Button>
                                  ))}
                              </div>
                          </div>

                          <div className="space-y-1.5 pt-2 border-t">
                              <Label className="text-[10px] font-bold opacity-70 ml-1">Manual Decoder Input</Label>
                              <div className="flex gap-1.5">
                                  <Input value={manualMaskInput} onChange={(e) => setManualMaskInput(e.target.value)} placeholder="Paste mask..." className="h-7 text-xs font-mono" />
                                  <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => decodeToState(manualMaskInput)}><RefreshCcw className="w-3 h-3"/></Button>
                              </div>
                              <p className="text-[9px] text-muted-foreground italic px-1">Paste a mask integer to reverse-engineer settings</p>
                          </div>
                      </div>
                  </div>

                  {/* Hardcoded Weight Table */}
                  <div className="pt-6 border-t">
                      <h5 className="text-xs font-bold uppercase tracking-widest mb-3 opacity-70 flex items-center gap-2"><Info className="w-3.5 h-3.5" /> Hardcoded Intensity Weight Reference Table</h5>
                      <div className="border rounded-xl overflow-hidden shadow-sm">
                          <Table className="text-[10px]">
                              <TableHeader className="bg-muted/80 font-bold uppercase">
                                  <TableRow>
                                      <TableHead className="h-8 w-24">Constraint</TableHead>
                                      <TableHead className="h-8">Minimal (00)</TableHead>
                                      <TableHead className="h-8">Medium (01)</TableHead>
                                      <TableHead className="h-8">Hard (10)</TableHead>
                                      <TableHead className="h-8">Strict (11)</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {SOFT_CONSTRAINTS.map((sc, idx) => (
                                      <TableRow key={sc.id} className="hover:bg-muted/30 font-medium">
                                          <TableCell className="py-1.5 font-bold">{sc.id} {sc.name}</TableCell>
                                          {INTENSITY_WEIGHTS.map((level, lIdx) => (
                                              <TableCell key={lIdx} className="py-1.5 font-mono opacity-80">{level[idx].toFixed(1)}</TableCell>
                                          ))}
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                      </div>
                  </div>
               </TabsContent>
            </Tabs>

            <DialogFooter className="mt-4 pt-4 border-t shrink-0">
               <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
               <Button onClick={handleSave}>Save Group Setup</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
      
      {/* Time-Off Grid Dialog */}
      <Dialog open={isTimeOffDialogOpen} onOpenChange={setIsTimeOffDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedGroupTeacher?.name}'s Availability Override</DialogTitle>
            <DialogDescription>Click cells to mark when unavailable. Red = Unavailable, Green = Available</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto border rounded-xl mt-2">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-muted/50 text-xs font-semibold w-24">Day \\ P</th>
                  {periods.map(p => <th key={p} className="border p-2 bg-muted/50 text-xs font-semibold w-12">{p}</th>)}
                </tr>
              </thead>
              <tbody>
                {days.map((day, dIdx) => (
                  <tr key={dIdx}>
                    <td className="border p-2 text-xs font-medium text-center">{day}</td>
                    {periods.map((_, pIdx) => (
                      <td key={pIdx} className="border p-0">
                        <button onClick={() => setTimeOffGrid(prev => prev.map((r, i) => r.map((c, j) => i===dIdx && j===pIdx ? !c : c)))}
                          className={`w-full h-12 transition-all hover:scale-105 ${timeOffGrid[dIdx]?.[pIdx] ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsTimeOffDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDraftTimeOff}>Confirm Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Draft a Nested Lesson Form */}
      <Dialog open={isDraftLessonOpen} onOpenChange={setIsDraftLessonOpen}>
         <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
               <DialogTitle>Draft New Lesson for Group</DialogTitle>
               <DialogDescription>This lesson will only be generated inside the Group context.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
               <div>
                  <Label className="text-xs">Subject</Label>
                  <Select value={draftLessonForm.subject_id} onValueChange={(v) => setDraftLessonForm(prev => ({...prev, subject_id: v}))}>
                     <SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger>
                     <SelectContent>
                        {subjects.filter(s => selectedSubjects.includes(s.id)).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                     </SelectContent>
                  </Select>
               </div>
               {[{lbl: "Teachers (Group Scope)", arr: teachers, fld: "teacher_ids", sel: draftLessonForm.teacher_ids},
                 {lbl: "Classes (Group Scope)", arr: classes, fld: "class_ids", sel: draftLessonForm.class_ids},
                 {lbl: "Rooms (Group Scope)", arr: classrooms, fld: "room_ids", sel: draftLessonForm.room_ids}].map(sec => (
                  <div key={sec.fld}>
                     <Label className="text-xs">{sec.lbl}</Label>
                     <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto border p-1 rounded-md">
                        {sec.arr.filter(a => sec.fld === "teacher_ids" ? selectedTeachers.includes(a.id) : sec.fld === "class_ids" ? selectedClasses.includes(a.id) : selectedRooms.includes(a.id)).map(it => {
                           const clkd = sec.sel.includes(it.id);
                           return (
                              <button key={it.id} onClick={() => setDraftLessonForm(prev => ({ ...prev, [sec.fld]: clkd ? (prev as any)[sec.fld].filter((x:any)=>x!==it.id) : [...(prev as any)[sec.fld], it.id] }))}
                                className={`flex items-center text-xs p-1 border rounded ${clkd ? 'bg-primary/10 border-primary' : 'bg-transparent border-transparent hover:bg-muted'}`}>
                                 <Checkbox className="mr-2" checked={clkd} onCheckedChange={()=>{}} /> {it.name}
                              </button>
                           )
                        })}
                     </div>
                  </div>
               ))}
               <div>
                  <Label className="text-xs">Sessions Configurations</Label>
                  {draftLessonForm.sessions.map((ses, idx) => (
                     <div key={idx} className="flex gap-2 items-center mt-1 border p-2 rounded bg-muted/20">
                        <Select value={ses.duration.toString()} onValueChange={v => { const sm=[...draftLessonForm.sessions]; sm[idx].duration = parseInt(v) as any; setDraftLessonForm(p=>({...p, sessions:sm})) }}>
                           <SelectTrigger className="w-24"><SelectValue/></SelectTrigger>
                           <SelectContent>
                              <SelectItem value="1">1P</SelectItem><SelectItem value="2">2P</SelectItem><SelectItem value="3">3P</SelectItem>
                           </SelectContent>
                        </Select>
                        <span className="text-xs">×</span>
                        <Input type="number" min="1" className="w-16 h-10" value={ses.count} onChange={e => { const sm=[...draftLessonForm.sessions]; sm[idx].count = parseInt(e.target.value)||1; setDraftLessonForm(p=>({...p, sessions:sm})) }} />
                        {draftLessonForm.sessions.length > 1 && (
                           <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDraftLessonForm(p=>({...p, sessions: p.sessions.filter((_, i) => i !== idx)}))}><X className="w-4 h-4"/></Button>
                        )}
                     </div>
                  ))}
                  <Button variant="secondary" size="sm" className="mt-2 w-full text-xs" onClick={() => setDraftLessonForm(p=>({...p, sessions: [...p.sessions, {duration:1,count:1}]}))}>+ Add Session Configuration</Button>
               </div>
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setIsDraftLessonOpen(false)}>Discard</Button>
               <Button onClick={handleAddDraftLesson}>Save to Draft Lessons</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
      
      {/* Delete Group */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete group?</DialogTitle><DialogDescription>This group and its configuration will be permanently removed.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button><Button variant="destructive" onClick={() => handleDelete(deleteId!)}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </PageWrapper>
  );
}
