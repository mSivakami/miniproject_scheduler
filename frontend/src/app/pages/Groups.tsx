import { useState, useEffect } from "react";
import { Layers, Plus, Trash2, Users, BookOpen, FlaskConical, BookMarked, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { PageWrapper } from "../components/PageWrapper";
import { useStore } from "../store/useStore";
import { toast } from "sonner";

type SubjectCondition = "any" | "lab_only" | "theory_only";

interface GroupSubject {
  subjectId: string;
  condition: SubjectCondition;
}

interface Group {
  id: string;
  name: string;
  teacherIds: string[];
  subjects: GroupSubject[];
  createdAt: string;
}

const MAX_GROUPS = 2;
const STORAGE_KEY = "autoscheduler_groups";

function loadGroups(): Group[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveGroups(groups: Group[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

const conditionLabels: Record<SubjectCondition, string> = {
  any: "Any",
  lab_only: "Lab only",
  theory_only: "Theory only",
};

export function Groups() {
  const { teachers, subjects } = useStore();
  const [groups, setGroups] = useState<Group[]>(loadGroups);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<GroupSubject[]>([]);

  useEffect(() => { saveGroups(groups); }, [groups]);

  const resetForm = () => {
    setFormName("");
    setSelectedTeachers([]);
    setSelectedSubjects([]);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleCreate = () => {
    if (!formName.trim()) { toast.error("Group name is required"); return; }
    if (groups.length >= MAX_GROUPS) { toast.error(`Maximum ${MAX_GROUPS} groups allowed`); return; }

    const newGroup: Group = {
      id: crypto.randomUUID(),
      name: formName.trim(),
      teacherIds: selectedTeachers,
      subjects: selectedSubjects,
      createdAt: new Date().toISOString(),
    };
    setGroups((prev) => [...prev, newGroup]);
    setIsCreateOpen(false);
    toast.success(`Group "${newGroup.name}" created`);
  };

  const handleDelete = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setDeleteId(null);
    toast.success("Group deleted");
  };

  const toggleTeacher = (id: string) => {
    setSelectedTeachers((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const toggleSubject = (id: string) => {
    setSelectedSubjects((prev) =>
      prev.some((s) => s.subjectId === id)
        ? prev.filter((s) => s.subjectId !== id)
        : [...prev, { subjectId: id, condition: "any" }]
    );
  };

  const setSubjectCondition = (subjectId: string, condition: SubjectCondition) => {
    setSelectedSubjects((prev) =>
      prev.map((s) => s.subjectId === subjectId ? { ...s, condition } : s)
    );
  };

  return (
    <PageWrapper>
      <div className="flex-1 flex flex-col p-8 gap-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Layers className="w-5 h-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">Groups</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Define up to {MAX_GROUPS} groups with assigned teachers and subject scheduling conditions.
            </p>
          </div>
          <Button
            size="sm"
            disabled={groups.length >= MAX_GROUPS}
            onClick={openCreate}
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Create group
          </Button>
        </div>

        {/* Slot indicator */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_GROUPS }).map((_, i) => (
              <div key={i} className={`w-10 h-1.5 rounded-full transition-colors ${i < groups.length ? "bg-foreground" : "bg-border"}`} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{groups.length}/{MAX_GROUPS} groups</span>
        </div>

        {/* Groups list */}
        {groups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="p-4 rounded-full bg-muted">
              <Layers className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No groups yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Create a group to specify available teachers, subjects, and special scheduling conditions.
            </p>
            <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5 mt-1">
              <Plus className="w-3.5 h-3.5" />
              Create first group
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => {
              const isExpanded = expandedId === group.id;
              const groupTeachers = teachers.filter((t) => group.teacherIds.includes(t.id));
              const groupSubjects = group.subjects.map((gs) => ({
                subject: subjects.find((s) => s.id === gs.subjectId),
                condition: gs.condition,
              })).filter((x) => x.subject);

              return (
                <Card key={group.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                          <Layers className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{group.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {groupTeachers.length} teacher{groupTeachers.length !== 1 ? "s" : ""} ·{" "}
                            {groupSubjects.length} subject{groupSubjects.length !== 1 ? "s" : ""}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setExpandedId(isExpanded ? null : group.id)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteId(group.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0 border-t border-border space-y-4 mt-2">
                      {/* Teachers */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Teachers</span>
                        </div>
                        {groupTeachers.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No teachers assigned</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {groupTeachers.map((t) => (
                              <Badge key={t.id} variant="secondary" className="text-xs">{t.name}</Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Subjects */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subjects & Conditions</span>
                        </div>
                        {groupSubjects.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No subjects assigned</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {groupSubjects.map(({ subject, condition }) => subject && (
                              <div key={subject.id} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/60 text-sm">
                                <span className="text-sm">{subject.name}</span>
                                <div className="flex items-center gap-1.5">
                                  {condition === "lab_only" && <FlaskConical className="w-3.5 h-3.5 text-blue-500" />}
                                  {condition === "theory_only" && <BookMarked className="w-3.5 h-3.5 text-green-500" />}
                                  <span className="text-xs text-muted-foreground">{conditionLabels[condition]}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Group Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(v) => { setIsCreateOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create group</DialogTitle>
            <DialogDescription>Assign teachers and subjects with scheduling conditions to this group.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="groupName">Group name</Label>
              <Input
                id="groupName"
                placeholder="e.g. Section A, Lab Group 1"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Select Teachers */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Label>Select teachers</Label>
                <span className="text-xs text-muted-foreground ml-1">({selectedTeachers.length} selected)</span>
              </div>
              {teachers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No teachers added yet. Add teachers first.</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {teachers.map((t) => {
                    const sel = selectedTeachers.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleTeacher(t.id)}
                        className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors text-left ${
                          sel
                            ? "border-foreground bg-foreground/5"
                            : "border-border hover:border-foreground/40 hover:bg-muted/50"
                        }`}
                      >
                        <span className="truncate">{t.name}</span>
                        {sel && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Select Subjects + Conditions */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <Label>Subjects & conditions</Label>
                <span className="text-xs text-muted-foreground ml-1">({selectedSubjects.length} selected)</span>
              </div>
              {subjects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No subjects added yet. Add subjects first.</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                  {subjects.map((s) => {
                    const gs = selectedSubjects.find((x) => x.subjectId === s.id);
                    const sel = !!gs;
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md border transition-colors ${
                          sel ? "border-foreground bg-foreground/5" : "border-border"
                        }`}
                      >
                        <button onClick={() => toggleSubject(s.id)} className="flex items-center gap-2 flex-1 text-left text-sm">
                          {sel && <Check className="w-3.5 h-3.5 shrink-0 text-foreground" />}
                          {!sel && <div className="w-3.5 h-3.5 rounded border border-muted-foreground/40 shrink-0" />}
                          <span>{s.name}</span>
                          {s.is_lab && <Badge variant="secondary" className="text-xs py-0">Lab</Badge>}
                        </button>

                        {sel && (
                          <div className="flex items-center gap-1 shrink-0">
                            {(["any", "lab_only", "theory_only"] as SubjectCondition[]).map((cond) => (
                              <button
                                key={cond}
                                onClick={() => setSubjectCondition(s.id, cond)}
                                className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                                  gs.condition === cond
                                    ? "bg-foreground text-background border-foreground"
                                    : "border-border hover:border-foreground/40"
                                }`}
                              >
                                {cond === "any" ? "Any" : cond === "lab_only" ? "Lab" : "Theory"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete group?</DialogTitle>
            <DialogDescription>This group and its configuration will be permanently removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDelete(deleteId!)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
