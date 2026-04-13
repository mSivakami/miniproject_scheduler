import React, { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Plus, Pencil, Trash2, DoorOpen, Search, Trash, Filter, Beaker } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { Switch } from "../components/ui/switch";
import { PageWrapper } from "../components/PageWrapper";
import { useStore, Classroom } from "../store/useStore";
import { toast } from "sonner";

const COLORS = ["#a855f7", "#10b981", "#3b82f6", "#eab308", "#ef4444", "#8b5cf6", "#06b6d4"];

export function Classrooms() {
  const { classrooms, addClassroom, updateClassroom, deleteClassroom, deleteAllClassrooms } = useStore();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
  const [newClassroom, setNewClassroom] = useState({ 
    name: "", 
    short: "", 
    is_lab: false, 
    building: "", 
    color: COLORS[0] 
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [labFilter, setLabFilter] = useState<"all" | "lab" | "room">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredClassrooms = classrooms.filter(classroom => {
    const matchesSearch =
      classroom.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      classroom.short.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = 
      labFilter === "all" || 
      (labFilter === "lab" && classroom.is_lab) ||
      (labFilter === "room" && !classroom.is_lab);
    return matchesSearch && matchesType;
  });

  const handleAddClassroom = () => {
    if (newClassroom.name && newClassroom.short) {
      addClassroom({
        name: newClassroom.name,
        short: newClassroom.short,
        is_lab: newClassroom.is_lab,
        building: newClassroom.building,
        color: newClassroom.color,
      });
      setNewClassroom({ name: "", short: "", is_lab: false, building: "", color: COLORS[0] });
      setIsAddDialogOpen(false);
      toast.success("Classroom added successfully!");
    }
  };

  const handleEditClassroom = (classroom: Classroom) => {
    setEditingClassroom({ ...classroom });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingClassroom) {
      updateClassroom(editingClassroom.id, editingClassroom);
      setIsEditDialogOpen(false);
      setEditingClassroom(null);
      toast.success("Classroom updated successfully!");
    }
  };

  const handleDeleteClassroom = (id: string) => {
    deleteClassroom(id);
    toast.success("Classroom deleted!");
  };

  const handleDeleteSelected = () => {
    selectedIds.forEach(id => deleteClassroom(id));
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} classroom(s) deleted!`);
  };

  const handleDeleteAll = () => {
    deleteAllClassrooms();
    setIsDeleteAllDialogOpen(false);
    toast.success("All classrooms deleted!");
  };


  const toggleSelectAll = () => {
    if (selectedIds.size === filteredClassrooms.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClassrooms.map(c => c.id)));
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

  return (
    <PageWrapper>
      <div className="flex-1 flex flex-col p-8 gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-muted">
              <DoorOpen className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                Classrooms
              </h1>
              <p className="text-gray-500 dark:text-gray-400">Manage rooms and labs</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Add Classroom
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <Input
                placeholder="Search classrooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <Button
                  size="sm"
                  variant={labFilter === "all" ? "default" : "ghost"}
                  onClick={() => setLabFilter("all")}
                  className="h-8"
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={labFilter === "room" ? "default" : "ghost"}
                  onClick={() => setLabFilter("room")}
                  className="h-8"
                >
                  Rooms
                </Button>
                <Button
                  size="sm"
                  variant={labFilter === "lab" ? "default" : "ghost"}
                  onClick={() => setLabFilter("lab")}
                  className="h-8"
                >
                  Labs
                </Button>
              </div>
            </div>
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
                      checked={selectedIds.size === filteredClassrooms.length && filteredClassrooms.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Short</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Beaker className="w-4 h-4" />
                      Is Lab
                    </div>
                  </TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClassrooms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No classrooms found. Click "Add Classroom" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClassrooms.map((classroom) => (
                    <TableRow key={classroom.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(classroom.id)}
                          onCheckedChange={() => toggleSelect(classroom.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{classroom.name}</TableCell>
                      <TableCell>
                        <span 
                          className="px-2 py-1 rounded text-sm font-medium text-white"
                          style={{ backgroundColor: classroom.color }}
                        >
                          {classroom.short}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {classroom.is_lab ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                            <Beaker className="w-3 h-3" />
                            Lab
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-xs">Room</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-300">{classroom.building}</TableCell>
                      <TableCell>
                        <div
                          className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-gray-700"
                          style={{ backgroundColor: classroom.color }}
                          title={classroom.color}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClassroom(classroom)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClassroom(classroom.id)}
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
            <DialogTitle>Add New Classroom</DialogTitle>
            <DialogDescription>Enter the details for the new classroom</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Classroom Name</Label>
              <Input
                id="name"
                placeholder="e.g., Room #201"
                value={newClassroom.name}
                onChange={(e) => setNewClassroom({ ...newClassroom, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="short">Short Code</Label>
              <Input
                id="short"
                placeholder="e.g., R201"
                value={newClassroom.short}
                onChange={(e) => setNewClassroom({ ...newClassroom, short: e.target.value })}
                maxLength={10}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Beaker className="w-5 h-5 text-green-600" />
                <div>
                  <Label htmlFor="is_lab" className="cursor-pointer">Is Lab</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Mark if this is a laboratory</p>
                </div>
              </div>
              <Switch
                id="is_lab"
                checked={newClassroom.is_lab}
                onCheckedChange={(checked) => setNewClassroom({ ...newClassroom, is_lab: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="building">Building</Label>
              <Input
                id="building"
                placeholder="e.g., Main Building"
                value={newClassroom.building}
                onChange={(e) => setNewClassroom({ ...newClassroom, building: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewClassroom({ ...newClassroom, color })}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      newClassroom.color === color ? 'border-gray-800 dark:border-white scale-110' : 'border-gray-200 dark:border-gray-700'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddClassroom} disabled={!newClassroom.name || !newClassroom.short}>
              Add Classroom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Classroom</DialogTitle>
            <DialogDescription>Update the classroom details</DialogDescription>
          </DialogHeader>
          {editingClassroom && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Classroom Name</Label>
                <Input
                  id="edit-name"
                  value={editingClassroom.name}
                  onChange={(e) => setEditingClassroom({ ...editingClassroom, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-short">Short Code</Label>
                <Input
                  id="edit-short"
                  value={editingClassroom.short}
                  onChange={(e) => setEditingClassroom({ ...editingClassroom, short: e.target.value })}
                  maxLength={10}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Beaker className="w-5 h-5 text-green-600" />
                  <div>
                    <Label htmlFor="edit-is_lab" className="cursor-pointer">Is Lab</Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Mark if this is a laboratory</p>
                  </div>
                </div>
                <Switch
                  id="edit-is_lab"
                  checked={editingClassroom.is_lab}
                  onCheckedChange={(checked) => setEditingClassroom({ ...editingClassroom, is_lab: checked })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-building">Building</Label>
                <Input
                  id="edit-building"
                  value={editingClassroom.building}
                  onChange={(e) => setEditingClassroom({ ...editingClassroom, building: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingClassroom({ ...editingClassroom, color })}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        editingClassroom.color === color ? 'border-gray-800 dark:border-white scale-110' : 'border-gray-200 dark:border-gray-700'
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

      {/* Delete All Confirmation Dialog */}
      <Dialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Classrooms?</DialogTitle>
            <DialogDescription>
              This will permanently delete all classrooms. This action cannot be undone.
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
