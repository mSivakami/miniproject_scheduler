import { useState } from "react";
import React from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Plus, Pencil, Trash2, BookMarked, Search, Trash, X, Lock } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { PageWrapper } from "../components/PageWrapper";
import { useStore, Session, Lesson } from "../store/useStore";
import type { Subject, Teacher, Class, Classroom } from "../store/useStore";
import { toast } from "sonner";

export function Lessons() {
  const { 
    lessons, 
    subjects, 
    teachers, 
    classes, 
    classrooms,
    settings,
    addLesson, 
    updateLesson, 
    deleteLesson, 
    deleteAllLessons 
  } = useStore();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [newLesson, setNewLesson] = useState({ 
    subject_id: "", 
    teacher_ids: [] as string[], 
    class_ids: [] as string[], 
    room_ids: [] as string[], 
    sessions: [{ duration: 1 as 1 | 2 | 3, count: 1 }],
    is_locked: false,
    locked_day: null as number | null,
    locked_start_period: null as number | null,
    locked_duration: null as 1 | 2 | 3 | null,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const numberOfDays = parseInt(settings.numberOfDays);
  const periodsPerDay = parseInt(settings.periodsPerDay);
  
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const filteredLessons = lessons.filter(lesson => {
    const subject = subjects.find(s => s.id === lesson.subject_id);
    const searchLower = searchQuery.toLowerCase();
    return subject?.name?.toLowerCase().includes(searchLower) ?? true;
  });

  const getSessionDistribution = (sessions: Session[]) => {
    // Format: "3x[1p], 1x[2p]"
    return sessions
      .map(s => `${s.count}x[${s.duration}p]`)
      .join(", ");
  };

  const calculateTotalPeriods = (sessions: Session[]) => {
    return sessions.reduce((sum, s) => sum + (s.duration * s.count), 0);
  };

  const addSession = (isEdit: boolean = false) => {
    if (isEdit && editingLesson) {
      setEditingLesson({
        ...editingLesson,
        sessions: [...editingLesson.sessions, { duration: 1, count: 1 }]
      });
    } else {
      setNewLesson({
        ...newLesson,
        sessions: [...newLesson.sessions, { duration: 1, count: 1 }]
      });
    }
  };

  const removeSession = (index: number, isEdit: boolean = false) => {
    if (isEdit && editingLesson) {
      if (editingLesson.sessions.length > 1) {
        setEditingLesson({
          ...editingLesson,
          sessions: editingLesson.sessions.filter((_, i) => i !== index)
        });
      }
    } else {
      if (newLesson.sessions.length > 1) {
        setNewLesson({
          ...newLesson,
          sessions: newLesson.sessions.filter((_, i) => i !== index)
        });
      }
    }
  };

  const updateSession = (index: number, field: 'duration' | 'count', value: number, isEdit: boolean = false) => {
    if (isEdit && editingLesson) {
      const updated = [...editingLesson.sessions];
      updated[index] = { ...updated[index], [field]: value };
      setEditingLesson({ ...editingLesson, sessions: updated });
    } else {
      const updated = [...newLesson.sessions];
      updated[index] = { ...updated[index], [field]: value };
      setNewLesson({ ...newLesson, sessions: updated });
    }
  };

  const handleAddLesson = () => {
    if (
      newLesson.subject_id &&
      newLesson.teacher_ids.length > 0 &&
      newLesson.class_ids.length > 0 &&
      newLesson.room_ids.length > 0
    ) {
      if (newLesson.is_locked && newLesson.locked_day !== null && newLesson.locked_start_period !== null && newLesson.locked_duration !== null) {
        const startPeriod0 = newLesson.locked_start_period - 1; // convert to 0-indexed
        const breaks = settings.breaks ?? [];
        const hitsBreak = breaks.some(
          b => b.day === newLesson.locked_day &&
               b.period >= startPeriod0 &&
               b.period < startPeriod0 + newLesson.locked_duration!
        );
        if (hitsBreak) {
          toast.error("Can't place a locked lesson during a break slot. Please choose a different time or duration.");
          return;
        }
      }
      addLesson({
        subject_id: newLesson.subject_id,
        teacher_ids: newLesson.teacher_ids,
        class_ids: newLesson.class_ids,
        room_ids: newLesson.room_ids,
        sessions: newLesson.sessions,
        is_locked: newLesson.is_locked,
        locked_day: newLesson.is_locked ? newLesson.locked_day : null,
        locked_start_period: newLesson.is_locked && newLesson.locked_start_period !== null ? newLesson.locked_start_period - 1 : null, // Convert to 0-indexed
        locked_duration: newLesson.is_locked ? newLesson.locked_duration : null,
      });
      setNewLesson({ 
        subject_id: "", 
        teacher_ids: [], 
        class_ids: [], 
        room_ids: [], 
        sessions: [{ duration: 1, count: 1 }],
        is_locked: false,
        locked_day: null,
        locked_start_period: null,
        locked_duration: null,
      });
      setIsAddDialogOpen(false);
      toast.success("Lesson added successfully!");
    } else {
      toast.error("Please fill all required fields!");
    }
  };

  const handleEditLesson = (lesson: Lesson) => {
    setEditingLesson({
      ...lesson,
      locked_start_period: lesson.locked_start_period !== null ? lesson.locked_start_period + 1 : null, // Convert to 1-indexed for UI
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingLesson) {
      if (editingLesson.is_locked && editingLesson.locked_day !== null && editingLesson.locked_start_period !== null && editingLesson.locked_duration !== null) {
        const startPeriod0 = editingLesson.locked_start_period - 1; // convert to 0-indexed
        const breaks = settings.breaks ?? [];
        const hitsBreak = breaks.some(
          b => b.day === editingLesson.locked_day &&
               b.period >= startPeriod0 &&
               b.period < startPeriod0 + editingLesson.locked_duration!
        );
        if (hitsBreak) {
          toast.error("Can't place a locked lesson during a break slot. Please choose a different time or duration.");
          return;
        }
      }
      updateLesson(editingLesson.id, {
        ...editingLesson,
        locked_start_period: editingLesson.is_locked && editingLesson.locked_start_period !== null ? editingLesson.locked_start_period - 1 : null, // Convert to 0-indexed
      });
      setIsEditDialogOpen(false);
      setEditingLesson(null);
      toast.success("Lesson updated successfully!");
    }
  };

  const handleDeleteLesson = (id: string) => {
    deleteLesson(id);
    toast.success("Lesson deleted!");
  };

  const handleDeleteSelected = () => {
    selectedIds.forEach(id => deleteLesson(id));
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} lesson(s) deleted!`);
  };

  const handleDeleteAll = () => {
    deleteAllLessons();
    setIsDeleteAllDialogOpen(false);
    toast.success("All lessons deleted!");
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLessons.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLessons.map(l => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleTeacher = (teacherId: string, isEdit: boolean = false) => {
    if (isEdit && editingLesson) {
      const current = editingLesson.teacher_ids;
      const updated = current.includes(teacherId)
        ? current.filter(id => id !== teacherId)
        : [...current, teacherId];
      setEditingLesson({ ...editingLesson, teacher_ids: updated });
    } else {
      const current = newLesson.teacher_ids;
      const updated = current.includes(teacherId)
        ? current.filter(id => id !== teacherId)
        : [...current, teacherId];
      setNewLesson({ ...newLesson, teacher_ids: updated });
    }
  };

  const toggleClass = (classId: string, isEdit: boolean = false) => {
    if (isEdit && editingLesson) {
      const current = editingLesson.class_ids;
      const updated = current.includes(classId)
        ? current.filter(id => id !== classId)
        : [...current, classId];
      setEditingLesson({ ...editingLesson, class_ids: updated });
    } else {
      const current = newLesson.class_ids;
      const updated = current.includes(classId)
        ? current.filter(id => id !== classId)
        : [...current, classId];
      setNewLesson({ ...newLesson, class_ids: updated });
    }
  };

  const toggleRoom = (roomId: string, isEdit: boolean = false) => {
    if (isEdit && editingLesson) {
      const current = editingLesson.room_ids;
      const updated = current.includes(roomId)
        ? current.filter(id => id !== roomId)
        : [...current, roomId];
      setEditingLesson({ ...editingLesson, room_ids: updated });
    } else {
      const current = newLesson.room_ids;
      const updated = current.includes(roomId)
        ? current.filter(id => id !== roomId)
        : [...current, roomId];
      setNewLesson({ ...newLesson, room_ids: updated });
    }
  };

  const getNames = (ids: string[], items: (Subject | Teacher | Class | Classroom)[]) => {
    return ids.map(id => items.find(item => item.id === id)?.short || '?').join(', ');
  };

  return (
    <PageWrapper>
      <div className="flex-1 flex flex-col p-8 gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-muted">
              <BookMarked className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                Lessons
              </h1>
              <p className="text-gray-500 dark:text-gray-400">Manage lesson schedules</p>
            </div>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add Lesson
          </Button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
            <Input
              placeholder="Search lessons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button onClick={handleDeleteSelected} variant="destructive" size="sm" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedIds.size})
              </Button>
            )}
            <Button onClick={() => setIsDeleteAllDialogOpen(true)} variant="outline" size="sm" className="gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/30">
              <Trash className="w-4 h-4" />
              Delete All
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === filteredLessons.length && filteredLessons.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Teachers</TableHead>
                  <TableHead>Classes</TableHead>
                  <TableHead>Rooms</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead className="text-center">Total Periods</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLessons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No lessons found. Click "Add Lesson" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLessons.map((lesson) => (
                    <TableRow key={lesson.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(lesson.id)}
                          onCheckedChange={() => toggleSelect(lesson.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {subjects.find(s => s.id === lesson.subject_id)?.name || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getNames(lesson.teacher_ids, teachers) || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getNames(lesson.class_ids, classes) || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getNames(lesson.room_ids, classrooms) || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {getSessionDistribution(lesson.sessions)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-semibold">
                          {calculateTotalPeriods(lesson.sessions)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {lesson.is_locked && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-semibold">
                            <Lock className="w-3 h-3" />
                            Locked
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditLesson(lesson)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Lesson</DialogTitle>
            <DialogDescription>Configure the lesson details and sessions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Select value={newLesson.subject_id} onValueChange={(value) => setNewLesson({ ...newLesson, subject_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(subject => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Teachers Multi-Select */}
            <div className="space-y-2">
              <Label>Teachers * (Select one or more)</Label>
              <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                {teachers.map(teacher => (
                  <div key={teacher.id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={newLesson.teacher_ids.includes(teacher.id)}
                      onCheckedChange={() => toggleTeacher(teacher.id)}
                    />
                    <span className="text-sm">{teacher.name}</span>
                  </div>
                ))}
              </div>
              {newLesson.teacher_ids.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Selected: {getNames(newLesson.teacher_ids, teachers)}</p>
              )}
            </div>

            {/* Classes Multi-Select */}
            <div className="space-y-2">
              <Label>Classes * (Select one or more)</Label>
              <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                {classes.map(cls => (
                  <div key={cls.id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={newLesson.class_ids.includes(cls.id)}
                      onCheckedChange={() => toggleClass(cls.id)}
                    />
                    <span className="text-sm">{cls.name}</span>
                  </div>
                ))}
              </div>
              {newLesson.class_ids.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Selected: {getNames(newLesson.class_ids, classes)}</p>
              )}
            </div>

            {/* Rooms Multi-Select */}
            <div className="space-y-2">
              <Label>Rooms * (Select one or more)</Label>
              <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                {classrooms.map(room => (
                  <div key={room.id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={newLesson.room_ids.includes(room.id)}
                      onCheckedChange={() => toggleRoom(room.id)}
                    />
                    <span className="text-sm">{room.name}</span>
                  </div>
                ))}
              </div>
              {newLesson.room_ids.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Selected: {getNames(newLesson.room_ids, classrooms)}</p>
              )}
            </div>

            {/* Sessions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Sessions</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => addSession()}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add Session
                </Button>
              </div>
              {newLesson.sessions.map((session, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg">
                  <Select 
                    value={session.duration.toString()} 
                    onValueChange={(val) => updateSession(idx, 'duration', parseInt(val) as 1 | 2 | 3)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Period</SelectItem>
                      <SelectItem value="2">2 Periods</SelectItem>
                      <SelectItem value="3">3 Periods</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm">×</span>
                  <Input
                    type="number"
                    min="1"
                    value={session.count}
                    onChange={(e) => updateSession(idx, 'count', parseInt(e.target.value) || 1)}
                    className="w-20"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">= {session.duration * session.count}p</span>
                  {newLesson.sessions.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeSession(idx)}
                      className="ml-auto"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Total: {calculateTotalPeriods(newLesson.sessions)} periods | Distribution: {getSessionDistribution(newLesson.sessions)}
              </p>
            </div>

            {/* Lock to Fixed Time */}
            <div className="space-y-3 p-3 border rounded-lg bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={newLesson.is_locked}
                  onCheckedChange={(checked) => setNewLesson({ 
                    ...newLesson, 
                    is_locked: !!checked,
                    locked_day: checked ? 0 : null,
                    locked_start_period: checked ? 1 : null,
                    locked_duration: checked ? 1 : null,
                  })}
                />
                <Label className="cursor-pointer">Lock to a Fixed Time Slot</Label>
              </div>
              {newLesson.is_locked && (
                <div className="grid grid-cols-3 gap-2 ml-6">
                  <div className="space-y-1">
                    <Label className="text-xs">Day</Label>
                    <Select 
                      value={newLesson.locked_day?.toString() || "0"} 
                      onValueChange={(val) => setNewLesson({ ...newLesson, locked_day: parseInt(val) })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {daysOfWeek.slice(0, numberOfDays).map((day, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Start Period</Label>
                    <Select 
                      value={newLesson.locked_start_period?.toString() || "1"} 
                      onValueChange={(val) => setNewLesson({ ...newLesson, locked_start_period: parseInt(val) })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(period => (
                          <SelectItem key={period} value={period.toString()}>{period}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Duration</Label>
                    <Select 
                      value={newLesson.locked_duration?.toString() || "1"} 
                      onValueChange={(val) => setNewLesson({ ...newLesson, locked_duration: parseInt(val) as 1 | 2 | 3 })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Period</SelectItem>
                        <SelectItem value="2">2 Periods</SelectItem>
                        <SelectItem value="3">3 Periods</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLesson}>
              Add Lesson
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog - Similar structure to Add */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
            <DialogDescription>Update the lesson details and sessions</DialogDescription>
          </DialogHeader>
          {editingLesson && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-subject">Subject *</Label>
                <Select value={editingLesson.subject_id} onValueChange={(value) => setEditingLesson({ ...editingLesson, subject_id: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(subject => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Teachers Multi-Select */}
              <div className="space-y-2">
                <Label>Teachers *</Label>
                <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                  {teachers.map(teacher => (
                    <div key={teacher.id} className="flex items-center gap-2 py-1">
                      <Checkbox
                        checked={editingLesson.teacher_ids.includes(teacher.id)}
                        onCheckedChange={() => toggleTeacher(teacher.id, true)}
                      />
                      <span className="text-sm">{teacher.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Classes Multi-Select */}
              <div className="space-y-2">
                <Label>Classes *</Label>
                <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                  {classes.map(cls => (
                    <div key={cls.id} className="flex items-center gap-2 py-1">
                      <Checkbox
                        checked={editingLesson.class_ids.includes(cls.id)}
                        onCheckedChange={() => toggleClass(cls.id, true)}
                      />
                      <span className="text-sm">{cls.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rooms Multi-Select */}
              <div className="space-y-2">
                <Label>Rooms *</Label>
                <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                  {classrooms.map(room => (
                    <div key={room.id} className="flex items-center gap-2 py-1">
                      <Checkbox
                        checked={editingLesson.room_ids.includes(room.id)}
                        onCheckedChange={() => toggleRoom(room.id, true)}
                      />
                      <span className="text-sm">{room.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sessions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Sessions</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => addSession(true)}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add Session
                  </Button>
                </div>
                {editingLesson.sessions.map((session, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg">
                    <Select 
                      value={session.duration.toString()} 
                      onValueChange={(val) => updateSession(idx, 'duration', parseInt(val) as 1 | 2 | 3, true)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Period</SelectItem>
                        <SelectItem value="2">2 Periods</SelectItem>
                        <SelectItem value="3">3 Periods</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm">×</span>
                    <Input
                      type="number"
                      min="1"
                      value={session.count}
                      onChange={(e) => updateSession(idx, 'count', parseInt(e.target.value) || 1, true)}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">= {session.duration * session.count}p</span>
                    {editingLesson.sessions.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSession(idx, true)}
                        className="ml-auto"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Total: {calculateTotalPeriods(editingLesson.sessions)} periods
                </p>
              </div>

              {/* Lock to Fixed Time */}
              <div className="space-y-3 p-3 border rounded-lg bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={editingLesson.is_locked}
                    onCheckedChange={(checked) => setEditingLesson({ 
                      ...editingLesson, 
                      is_locked: !!checked,
                      locked_day: checked ? 0 : null,
                      locked_start_period: checked ? 1 : null,
                      locked_duration: checked ? 1 : null,
                    })}
                  />
                  <Label className="cursor-pointer">Lock to a Fixed Time Slot</Label>
                </div>
                {editingLesson.is_locked && (
                  <div className="grid grid-cols-3 gap-2 ml-6">
                    <div className="space-y-1">
                      <Label className="text-xs">Day</Label>
                      <Select 
                        value={editingLesson.locked_day?.toString() || "0"} 
                        onValueChange={(val) => setEditingLesson({ ...editingLesson, locked_day: parseInt(val) })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {daysOfWeek.slice(0, numberOfDays).map((day, idx) => (
                            <SelectItem key={idx} value={idx.toString()}>{day}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Start Period</Label>
                      <Select 
                        value={editingLesson.locked_start_period?.toString() || "1"} 
                        onValueChange={(val) => setEditingLesson({ ...editingLesson, locked_start_period: parseInt(val) })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(period => (
                            <SelectItem key={period} value={period.toString()}>{period}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Duration</Label>
                      <Select 
                        value={editingLesson.locked_duration?.toString() || "1"} 
                        onValueChange={(val) => setEditingLesson({ ...editingLesson, locked_duration: parseInt(val) as 1 | 2 | 3 })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Period</SelectItem>
                          <SelectItem value="2">2 Periods</SelectItem>
                          <SelectItem value="3">3 Periods</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Lessons?</DialogTitle>
            <DialogDescription>
              This will permanently delete all lessons. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteAllDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAll}>
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
