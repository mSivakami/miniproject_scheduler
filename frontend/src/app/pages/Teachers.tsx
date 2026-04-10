import { useState } from "react";
import { PageWrapper } from "../components/PageWrapper";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Search, Trash, Sparkles, CalendarOff } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";
import { useStore, Teacher, slotsToGrid, gridToSlots } from "../store/useStore";

export function Teachers() {
  const { teachers, addTeacher, updateTeacher, deleteTeacher, deleteAllTeachers, settings, loadSampleData } = useStore();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTimeOffDialogOpen, setIsTimeOffDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [newTeacher, setNewTeacher] = useState({ name: "", short: "", color: "#3b82f6" });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [timeOffGrid, setTimeOffGrid] = useState<boolean[][]>([]);

  const numberOfDays = parseInt(settings.numberOfDays);
  const periodsPerDay = parseInt(settings.periodsPerDay);
  
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].slice(0, numberOfDays);
  const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);
  
  const teacherColors = [
    "#3b82f6", "#10b981", "#6366f1", "#f59e0b", "#ef4444",
    "#8b5cf6", "#14b8a6", "#f97316", "#06b6d4", "#84cc16"
  ];

  const filteredTeachers = teachers.filter(teacher =>
    teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.short.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddTeacher = () => {
    if (newTeacher.name && newTeacher.short) {
      addTeacher({
        name: newTeacher.name,
        short: newTeacher.short,
        color: newTeacher.color,
        available_mask: -1,
        max_per_day: 6,
        max_per_week: 30,
        unavailable_slots: [],
      });
      setNewTeacher({ name: "", short: "", color: "#3b82f6" });
      setIsAddDialogOpen(false);
      toast.success("Teacher added successfully!");
    }
  };

  const handleEditTeacher = (teacher: Teacher) => {
    setEditingTeacher({ ...teacher });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingTeacher) {
      updateTeacher(editingTeacher.id, editingTeacher);
      setIsEditDialogOpen(false);
      setEditingTeacher(null);
      toast.success("Teacher updated successfully!");
    }
  };

  const handleDeleteTeacher = (id: string) => {
    deleteTeacher(id);
    toast.success("Teacher deleted!");
  };

  const handleDeleteSelected = () => {
    selectedIds.forEach(id => deleteTeacher(id));
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} teacher(s) deleted!`);
  };

  const handleDeleteAll = () => {
    deleteAllTeachers();
    setIsDeleteAllDialogOpen(false);
    toast.success("All teachers deleted!");
  };

  const handleLoadSample = () => {
    loadSampleData();
    toast.success("Sample data loaded!");
  };

  const handleTimeOff = (teacher: Teacher) => {
    setSelectedTeacher({ ...teacher });
    // Convert unavailable_slots to grid for UI
    const grid = slotsToGrid(teacher.unavailable_slots, numberOfDays, periodsPerDay);
    setTimeOffGrid(grid);
    setIsTimeOffDialogOpen(true);
  };

  const handleToggleTimeOff = (dayIndex: number, periodIndex: number) => {
    const updatedGrid = timeOffGrid.map((day, dIdx) =>
      day.map((period, pIdx) =>
        dIdx === dayIndex && pIdx === periodIndex ? !period : period
      )
    );
    setTimeOffGrid(updatedGrid);
  };

  const handleSaveTimeOff = () => {
    if (selectedTeacher) {
      // Convert grid back to unavailable_slots
      const unavailable_slots = gridToSlots(timeOffGrid);
      updateTeacher(selectedTeacher.id, {
        ...selectedTeacher,
        unavailable_slots,
      });
      setIsTimeOffDialogOpen(false);
      toast.success("Unavailable periods updated!");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTeachers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTeachers.map(t => t.id)));
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

  const getUnavailableCount = (teacher: Teacher) => {
    return teacher.unavailable_slots?.length || 0;
  };

  return (
    <PageWrapper>
      <div className="flex-1 flex flex-col p-8 gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-muted">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                Teachers
              </h1>
              <p className="text-gray-500 dark:text-gray-400">Manage teaching staff</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleLoadSample} variant="outline" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Load Sample
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Add Teacher
            </Button>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
            <Input
              placeholder="Search teachers..."
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
                      checked={selectedIds.size === filteredTeachers.length && filteredTeachers.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Short</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-center">Unavailable Periods</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No teachers found. Click "Add Teacher" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(teacher.id)}
                          onCheckedChange={() => toggleSelect(teacher.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{teacher.name}</TableCell>
                      <TableCell>
                        <span 
                          className="px-2 py-1 rounded text-sm font-medium text-white"
                          style={{ backgroundColor: teacher.color }}
                        >
                          {teacher.short}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div
                          className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-gray-700"
                          style={{ backgroundColor: teacher.color }}
                          title={teacher.color}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {getUnavailableCount(teacher)} slot{getUnavailableCount(teacher) !== 1 ? 's' : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTimeOff(teacher)}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Set unavailable periods"
                          >
                            <CalendarOff className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTeacher(teacher)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTeacher(teacher.id)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Teacher</DialogTitle>
            <DialogDescription>Enter the details for the new teacher</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Teacher Name</Label>
              <Input
                id="name"
                placeholder="e.g., Umair Khalid"
                value={newTeacher.name}
                onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="short">Short Code</Label>
              <Input
                id="short"
                placeholder="e.g., UK"
                value={newTeacher.short}
                onChange={(e) => setNewTeacher({ ...newTeacher, short: e.target.value })}
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {teacherColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTeacher({ ...newTeacher, color })}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      newTeacher.color === color ? 'border-gray-800 dark:border-white scale-110' : 'border-gray-200 dark:border-gray-700'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 You can set unavailable periods after adding the teacher
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTeacher} disabled={!newTeacher.name || !newTeacher.short}>
              Add Teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>Update the teacher details</DialogDescription>
          </DialogHeader>
          {editingTeacher && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Teacher Name</Label>
                <Input
                  id="edit-name"
                  value={editingTeacher.name}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-short">Short Code</Label>
                <Input
                  id="edit-short"
                  value={editingTeacher.short}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, short: e.target.value })}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {teacherColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingTeacher({ ...editingTeacher, color })}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        editingTeacher.color === color ? 'border-gray-800 dark:border-white scale-110' : 'border-gray-200 dark:border-gray-700'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
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

      {/* Time Off Dialog */}
      <Dialog open={isTimeOffDialogOpen} onOpenChange={setIsTimeOffDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Set Unavailable Periods - {selectedTeacher?.name}</DialogTitle>
            <DialogDescription>
              Click cells to mark when this teacher is unavailable. Red = Unavailable, Green = Available
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-2 text-xs font-semibold text-gray-600 dark:text-gray-300 w-20">
                    Day / Period
                  </th>
                  {periods.map((period) => (
                    <th key={period} className="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-2 text-xs font-semibold text-gray-600 dark:text-gray-300 w-12">
                      {period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day, dayIndex) => (
                  <tr key={dayIndex}>
                    <td className="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                      {day}
                    </td>
                    {periods.map((_, periodIndex) => (
                      <td
                        key={periodIndex}
                        className="border border-gray-300 dark:border-gray-600 p-0"
                      >
                        <button
                          onClick={() => handleToggleTimeOff(dayIndex, periodIndex)}
                          className={`w-full h-12 transition-all hover:scale-105 ${
                            timeOffGrid[dayIndex]?.[periodIndex]
                              ? 'bg-green-500 hover:bg-green-600'
                              : 'bg-red-500 hover:bg-red-600'
                          }`}
                          title={timeOffGrid[dayIndex]?.[periodIndex] ? 'Available' : 'Unavailable'}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            🟩 Green = Available • 🟥 Red = Unavailable
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTimeOffDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTimeOff}>
              Save Unavailable Periods
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Teachers?</DialogTitle>
            <DialogDescription>
              This will permanently delete all teachers. This action cannot be undone.
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
