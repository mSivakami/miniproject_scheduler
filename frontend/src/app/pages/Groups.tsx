import { useState, useEffect } from "react";
import { Layers, Plus, Trash2, Users, BookOpen, ChevronDown, ChevronUp, Check, CalendarOff, Box, Settings, Copy, PlusCircle, Trash, X } from "lucide-react";
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

const MAX_GROUPS = 6;

export function Groups() {
  const { teachers, classes, classrooms, groups, subjects, lessons, fetchGroups, updateGroup, deleteGroup, settings, addLesson, deleteLesson, saveAll } = useStore();
  const [view, setView] = useState<"list" | "wizard" | "edit">("list");

  // States for Wizard / Edit
  const [draft, setDraft] = useState<DraftGroup>(emptyDraft());
  const [draftLessons, setDraftLessons] = useState<Lesson[]>([]);
  const [wizardStage, setWizardStage] = useState<number>(1);
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
  };

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
    setActiveTab("setup");
    setIsCreateOpen(true);
  };

  const executeSave = async () => {
    if (!draft.name.trim()) return toast.error("Group name is required.");
    try {
      const data = {
        name: formName.trim(),
        selected_teacher_ids: JSON.stringify(selectedTeachers),
        selected_class_ids: JSON.stringify(selectedClasses),
        selected_room_ids: JSON.stringify(selectedRooms),
        selected_subject_ids: JSON.stringify(selectedSubjects),
        teacher_time_off_overrides: JSON.stringify(draftTimeOffs),
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

    setDraftTimeOffs(prev => ({ ...prev, [teacher.id]: mask.toString() }));
    setIsTimeOffDialogOpen(false);
  };

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
                    </div>
                  </CardHeader>
                </Card>
          );
            })}
        </div>
      )}
    </div>

      {/* Tabbed Dialog for Create/Edit */ }
  <Dialog open={isCreateOpen} onOpenChange={(v) => { setIsCreateOpen(v); if (!v) resetForm(); }}>
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto flex flex-col">
      <DialogHeader className="shrink-0">
        <DialogTitle>{editingGroupId ? "Edit Group" : "Create Group"}</DialogTitle>
        <DialogDescription>Configure base settings, overrides, and included lessons inline.</DialogDescription>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col mt-2">
        <TabsList className="grid w-full grid-cols-3 shrink-0">
          <TabsTrigger value="setup">1. Setup Tools</TabsTrigger>
          <TabsTrigger value="timeoff" disabled={selectedTeachers.length === 0}>2. Time-Offs</TabsTrigger>
          <TabsTrigger value="lessons">3. Lessons</TabsTrigger>
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
                        saveAll();
                      }}><SettingsIcon className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="p-1 h-7 text-destructive" onClick={() => { deleteLesson(l.id); saveAll(); }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
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
                    setDraftLessonForm({ subject_id: "", teacher_ids: [], class_ids: [], room_ids: [], sessions: [{ duration: 1, count: 1 }], is_locked: false, locked_day: 0, locked_start_period: 1, locked_duration: 1 });
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
                        <span>{subjects.find(s => s.id === dl.subject_id)?.name || "New Lesson"} (Draft)</span>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => setDraftNewLessons(prev => prev.filter((_, i) => i !== idx))}><Trash className="w-3 h-3" /></Button>
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
