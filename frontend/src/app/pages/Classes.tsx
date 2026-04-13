import { useState } from "react";
import React from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Plus, Pencil, Trash2, School, Search, Trash } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { PageWrapper } from "../components/PageWrapper";
import { useStore, Class } from "../store/useStore";
import { toast } from "sonner";

export function Classes() {
  const { classes, addClass, updateClass, deleteClass, deleteAllClasses } = useStore();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [newClass, setNewClass] = useState({ name: "", short: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredClasses = classes.filter(cls =>
    cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cls.short.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddClass = () => {
    if (newClass.name && newClass.short) {
      addClass({
        name: newClass.name,
        short: newClass.short,
      });
      setNewClass({ name: "", short: "" });
      setIsAddDialogOpen(false);
      toast.success("Class added successfully!");
    }
  };

  const handleEditClass = (cls: Class) => {
    setEditingClass({ ...cls });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingClass) {
      updateClass(editingClass.id, editingClass);
      setIsEditDialogOpen(false);
      setEditingClass(null);
      toast.success("Class updated successfully!");
    }
  };

  const handleDeleteClass = (id: string) => {
    deleteClass(id);
    toast.success("Class deleted!");
  };

  const handleDeleteSelected = () => {
    selectedIds.forEach(id => deleteClass(id));
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} class(es) deleted!`);
  };

  const handleDeleteAll = () => {
    deleteAllClasses();
    setIsDeleteAllDialogOpen(false);
    toast.success("All classes deleted!");
  };


  const toggleSelectAll = () => {
    if (selectedIds.size === filteredClasses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClasses.map(c => c.id)));
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
              <School className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                Classes
              </h1>
              <p className="text-gray-500 dark:text-gray-400">Manage student classes</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Add Class
            </Button>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
            <Input
              placeholder="Search classes..."
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
                      checked={selectedIds.size === filteredClasses.length && filteredClasses.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Short Code</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No classes found. Click "Add Class" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClasses.map((cls) => (
                    <TableRow key={cls.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/70">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(cls.id)}
                          onCheckedChange={() => toggleSelect(cls.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{cls.name}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                          {cls.short}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClass(cls)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClass(cls.id)}
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
            <DialogTitle>Add New Class</DialogTitle>
            <DialogDescription>Enter the details for the new class</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Class Name</Label>
              <Input
                id="name"
                placeholder="e.g., BSCS 2nd MOR"
                value={newClass.name}
                onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="short">Short Code</Label>
              <Input
                id="short"
                placeholder="e.g., BSCS 2M"
                value={newClass.short}
                onChange={(e) => setNewClass({ ...newClass, short: e.target.value })}
                maxLength={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddClass} disabled={!newClass.name || !newClass.short}>
              Add Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>Update the class details</DialogDescription>
          </DialogHeader>
          {editingClass && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Class Name</Label>
                <Input
                  id="edit-name"
                  value={editingClass.name}
                  onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-short">Short Code</Label>
                <Input
                  id="edit-short"
                  value={editingClass.short}
                  onChange={(e) => setEditingClass({ ...editingClass, short: e.target.value })}
                  maxLength={10}
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
            <DialogTitle>Delete All Classes?</DialogTitle>
            <DialogDescription>
              This will permanently delete all classes. This action cannot be undone.
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
