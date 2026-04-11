import { useState } from "react";
import { Button } from "../app/components/ui/button";
import { Input } from "../app/components/ui/input";
import { Label } from "../app/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../app/components/ui/table";
import { Textarea } from "../app/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../app/components/ui/dialog";
import { Plus, Pencil, Trash2, BookOpen, Clock, Users as UsersIcon, Settings } from "lucide-react";
import { Checkbox } from "../app/components/ui/checkbox";
import { PageWrapper } from "./PageWrapper";

interface Subject {
  id: string;
  name: string;
  short: string;
  teacher: string;
  count: number;
  timeOff: boolean[][];
  constraints: string;
}

export function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([
    { id: "1", name: "Artificial Intelligence", short: "AI", teacher: "", count: 0, timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
  ]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTimeOffDialogOpen, setIsTimeOffDialogOpen] = useState(false);
  const [isConstraintsDialogOpen, setIsConstraintsDialogOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [newSubject, setNewSubject] = useState({ name: "", short: "" });

  const days = ["Mo", "Tu", "We", "Th", "Fr"];
  const periods = ["1", "2", "3", "4", "5", "6", "7"];

  const handleAddSubject = () => {
    if (newSubject.name && newSubject.short) {
      const subject: Subject = {
        id: Date.now().toString(),
        name: newSubject.name,
        short: newSubject.short,
        teacher: "",
        count: 0,
        timeOff: Array(5).fill(null).map(() => Array(7).fill(true)),
        constraints: "",
      };
      setSubjects([...subjects, subject]);
      setNewSubject({ name: "", short: "" });
      setIsAddDialogOpen(false);
    }
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject({ ...subject });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingSubject) {
      setSubjects(subjects.map(s => s.id === editingSubject.id ? editingSubject : s));
      setIsEditDialogOpen(false);
      setEditingSubject(null);
    }
  };

  const handleDeleteSubject = (id: string) => {
    setSubjects(subjects.filter((s) => s.id !== id));
  };

  const handleTimeOff = (subject: Subject) => {
    setSelectedSubject({ ...subject });
    setIsTimeOffDialogOpen(true);
  };

  const handleConstraints = (subject: Subject) => {
    setSelectedSubject({ ...subject });
    setIsConstraintsDialogOpen(true);
  };

  const toggleTimeSlot = (dayIndex: number, periodIndex: number) => {
    if (selectedSubject) {
      const updated = { ...selectedSubject };
      updated.timeOff = updated.timeOff.map(row => [...row]);
      updated.timeOff[dayIndex][periodIndex] = !updated.timeOff[dayIndex][periodIndex];
      setSelectedSubject(updated);
    }
  };

  const handleSaveTimeOff = () => {
    if (selectedSubject) {
      setSubjects(subjects.map(s => s.id === selectedSubject.id ? selectedSubject : s));
      setIsTimeOffDialogOpen(false);
      setSelectedSubject(null);
    }
  };

  const handleSaveConstraints = () => {
    if (selectedSubject) {
      setSubjects(subjects.map(s => s.id === selectedSubject.id ? selectedSubject : s));
      setIsConstraintsDialogOpen(false);
      setSelectedSubject(null);
    }
  };

  return (
    <PageWrapper>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/80 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-800">Subjects</h1>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}
            className="active:scale-95 transition-transform duration-100">
            <Plus className="w-4 h-4 mr-2" />
            New Subject
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white/70 backdrop-blur-sm rounded-lg border border-gray-100 shadow-sm">
          {subjects.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-gray-100 rounded-full mb-4">
                <BookOpen className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No subjects yet</p>
              <p className="text-gray-400 text-sm mt-1">Click "New Subject" to add your first subject</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold text-gray-700">Name</TableHead>
                  <TableHead className="font-semibold text-gray-700">Subject Code</TableHead>
                  <TableHead className="font-semibold text-gray-700">Teacher</TableHead>
                  <TableHead className="font-semibold text-gray-700">Count</TableHead>
                  <TableHead className="font-semibold text-gray-700">Time off</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject) => (
                  <TableRow key={subject.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium text-gray-800">{subject.name}</TableCell>
                    <TableCell className="text-gray-600">{subject.short}</TableCell>
                    <TableCell className="text-gray-400">{subject.teacher || "-"}</TableCell>
                    <TableCell className="text-gray-600">{subject.count}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleTimeOff(subject)}>
                        <Clock className="w-4 h-4 mr-2" />
                        Set Time Off
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditSubject(subject)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteSubject(subject.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={() => subjects.length > 0 && handleTimeOff(subjects[0])}>
            <Clock className="w-4 h-4 mr-2" />
            Time off
          </Button>
          <Button variant="outline" onClick={() => subjects.length > 0 && handleConstraints(subjects[0])}>
            <Settings className="w-4 h-4 mr-2" />
            Constraints
          </Button>
        </div>
      </div>

      {/* Add Subject Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Subject</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subjectName">Subject Name</Label>
              <Input id="subjectName" placeholder="e.g., Artificial Intelligence" value={newSubject.name} onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subjectShort">Subject Code</Label>
              <Input id="subjectShort" placeholder="e.g., AI" value={newSubject.short} onChange={(e) => setNewSubject({ ...newSubject, short: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSubject}>Add Subject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subject Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editSubjectName">Subject Name</Label>
              <Input id="editSubjectName" value={editingSubject?.name || ""} onChange={(e) => setEditingSubject({ ...editingSubject!, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editSubjectShort">Subject Code</Label>
              <Input id="editSubjectShort" value={editingSubject?.short || ""} onChange={(e) => setEditingSubject({ ...editingSubject!, short: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editSubjectTeacher">Teacher</Label>
              <Input id="editSubjectTeacher" value={editingSubject?.teacher || ""} onChange={(e) => setEditingSubject({ ...editingSubject!, teacher: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editSubjectCount">Count</Label>
              <Input id="editSubjectCount" type="number" value={editingSubject?.count || 0} onChange={(e) => setEditingSubject({ ...editingSubject!, count: parseInt(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Time Off Dialog */}
      <Dialog open={isTimeOffDialogOpen} onOpenChange={setIsTimeOffDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Time off — {selectedSubject?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-yellow-100">
                    <th className="p-2 text-left"></th>
                    {periods.map((period) => (
                      <th key={period} className="p-2 text-center w-12">{period}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((day, dayIndex) => (
                    <tr key={day} className="border-t border-yellow-200">
                      <td className="p-2 font-medium bg-yellow-50">{day}</td>
                      {periods.map((_, periodIndex) => (
                        <td key={periodIndex} className="p-2 text-center">
                          <button onClick={() => toggleTimeSlot(dayIndex, periodIndex)} className="w-full h-8 flex items-center justify-center hover:bg-yellow-100 rounded">
                            {selectedSubject?.timeOff[dayIndex][periodIndex] ? (
                              <span className="text-green-600 text-2xl">✓</span>
                            ) : (
                              <span className="text-red-600 text-2xl">✗</span>
                            )}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2"><span className="text-green-600 text-xl">✓</span><span>Available</span></div>
              <div className="flex items-center gap-2"><span className="text-red-600 text-xl">✗</span><span>Not available</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveTimeOff}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Constraints Dialog */}
      <Dialog open={isConstraintsDialogOpen} onOpenChange={setIsConstraintsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Constraints — {selectedSubject?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="constraints">Constraints</Label>
            <Textarea id="constraints" placeholder="e.g., No consecutive periods" value={selectedSubject?.constraints || ""} onChange={(e) => setSelectedSubject({ ...selectedSubject!, constraints: e.target.value })} />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveConstraints}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}