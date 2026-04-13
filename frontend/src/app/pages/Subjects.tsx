import { useState } from "react";
import React from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Plus, Pencil, Trash2, BookOpen, Search, Trash, Beaker, Brain, Filter } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { Switch } from "../components/ui/switch";
import { PageWrapper } from "../components/PageWrapper";
import { useStore } from "../store/useStore";
import type { Subject } from "../store/useStore";
import { toast } from "sonner";

export function Subjects() {
  const { subjects, addSubject, updateSubject, deleteSubject, deleteAllSubjects } = useStore();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [newSubject, setNewSubject] = useState({ 
    name: "", 
    short: "", 
    is_difficult: false, 
    is_lab: false,
    priority: 5 
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "normal" | "difficult" | "lab">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredSubjects = subjects.filter(subject => {
    const matchesSearch =
      subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subject.short.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      typeFilter === "all" ||
      (typeFilter === "difficult" && subject.is_difficult) ||
      (typeFilter === "lab" && subject.is_lab) ||
      (typeFilter === "normal" && !subject.is_difficult && !subject.is_lab);
    return matchesSearch && matchesType;
  });

  const handleAddSubject = () => {
    if (newSubject.name && newSubject.short) {
      addSubject({
        name: newSubject.name,
        short: newSubject.short,
        is_difficult: newSubject.is_difficult,
        is_lab: newSubject.is_lab,
        priority: newSubject.priority,
      });
      setNewSubject({ name: "", short: "", is_difficult: false, is_lab: false, priority: 5 });
      setIsAddDialogOpen(false);
      toast.success("Subject added successfully!");
    }
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject({ ...subject });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingSubject) {
      updateSubject(editingSubject.id, editingSubject);
      setIsEditDialogOpen(false);
      setEditingSubject(null);
      toast.success("Subject updated successfully!");
    }
  };

  const handleDeleteSubject = (id: string) => {
    deleteSubject(id);
    toast.success("Subject deleted!");
  };

  const handleDeleteSelected = () => {
    selectedIds.forEach(id => deleteSubject(id));
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} subject(s) deleted!`);
  };

  const handleDeleteAll = () => {
    deleteAllSubjects();
    setIsDeleteAllDialogOpen(false);
    toast.success("All subjects deleted!");
  };


  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSubjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSubjects.map(s => s.id)));
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
              <BookOpen className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                Subjects
              </h1>
              <p className="text-gray-500 dark:text-gray-400">Manage academic subjects</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Add Subject
            </Button>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <Input
                placeholder="Search subjects..."
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
                  variant={typeFilter === "all" ? "default" : "ghost"}
                  onClick={() => setTypeFilter("all")}
                  className="h-8"
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={typeFilter === "normal" ? "default" : "ghost"}
                  onClick={() => setTypeFilter("normal")}
                  className="h-8"
                >
                  Normal
                </Button>
                <Button
                  size="sm"
                  variant={typeFilter === "difficult" ? "default" : "ghost"}
                  onClick={() => setTypeFilter("difficult")}
                  className="h-8"
                >
                  Difficult
                </Button>
                <Button
                  size="sm"
                  variant={typeFilter === "lab" ? "default" : "ghost"}
                  onClick={() => setTypeFilter("lab")}
                  className="h-8"
                >
                  Lab
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
                      checked={selectedIds.size === filteredSubjects.length && filteredSubjects.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject Code</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Brain className="w-4 h-4" />
                      Difficult
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Beaker className="w-4 h-4" />
                      Lab
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No subjects found. Click "Add Subject" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubjects.map((subject) => (
                    <TableRow key={subject.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(subject.id)}
                          onCheckedChange={() => toggleSelect(subject.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm font-medium">
                          {subject.short}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {subject.is_difficult ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-semibold">
                            <Brain className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-xs">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {subject.is_lab ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                            <Beaker className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-xs">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSubject(subject)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSubject(subject.id)}
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
            <DialogTitle>Add New Subject</DialogTitle>
            <DialogDescription>Enter the details for the new subject</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Subject Name</Label>
              <Input
                id="name"
                placeholder="e.g., Artificial Intelligence"
                value={newSubject.name}
                onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="short">Subject Code</Label>
              <Input
                id="short"
                placeholder="e.g., AI"
                value={newSubject.short}
                onChange={(e) => setNewSubject({ ...newSubject, short: e.target.value })}
                maxLength={10}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-red-600" />
                <div>
                  <Label htmlFor="is_difficult" className="cursor-pointer">Is Difficult</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Mark if this subject is challenging</p>
                </div>
              </div>
              <Switch
                id="is_difficult"
                checked={newSubject.is_difficult}
                onCheckedChange={(checked) => setNewSubject({ ...newSubject, is_difficult: checked })}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Beaker className="w-5 h-5 text-green-600" />
                <div>
                  <Label htmlFor="is_lab" className="cursor-pointer">Is Lab</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Mark if this is a lab subject</p>
                </div>
              </div>
              <Switch
                id="is_lab"
                checked={newSubject.is_lab}
                onCheckedChange={(checked) => setNewSubject({ ...newSubject, is_lab: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSubject} disabled={!newSubject.name || !newSubject.short}>
              Add Subject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>Update the subject details</DialogDescription>
          </DialogHeader>
          {editingSubject && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Subject Name</Label>
                <Input
                  id="edit-name"
                  value={editingSubject.name}
                  onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-short">Subject Code</Label>
                <Input
                  id="edit-short"
                  value={editingSubject.short}
                  onChange={(e) => setEditingSubject({ ...editingSubject, short: e.target.value })}
                  maxLength={10}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-red-600" />
                  <div>
                    <Label htmlFor="edit-is_difficult" className="cursor-pointer">Is Difficult</Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Mark if this subject is challenging</p>
                  </div>
                </div>
                <Switch
                  id="edit-is_difficult"
                  checked={editingSubject.is_difficult}
                  onCheckedChange={(checked) => setEditingSubject({ ...editingSubject, is_difficult: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Beaker className="w-5 h-5 text-green-600" />
                  <div>
                    <Label htmlFor="edit-is_lab" className="cursor-pointer">Is Lab</Label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Mark if this is a lab subject</p>
                  </div>
                </div>
                <Switch
                  id="edit-is_lab"
                  checked={editingSubject.is_lab}
                  onCheckedChange={(checked) => setEditingSubject({ ...editingSubject, is_lab: checked })}
                />
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
            <DialogTitle>Delete All Subjects?</DialogTitle>
            <DialogDescription>
              This will permanently delete all subjects. This action cannot be undone.
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
