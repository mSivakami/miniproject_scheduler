import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Clock, BookOpen as BookIcon, Settings } from "lucide-react";
import { PageWrapper } from "../components/PageWrapper";

interface Teacher {
  id: string;
  name: string;
  short: string;
  count: number;
  color: string;
  timeOff: boolean[][];
  constraints: string;
}

export function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([
    { id: "1", name: "Umair Khalid", short: "UK", count: 0, color: "#3b82f6", timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "2", name: "Ayyaz Hussain", short: "AH", count: 0, color: "#10b981", timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "3", name: "Umar Shahzad", short: "US", count: 0, color: "#3b82f6", timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "4", name: "Hassan rauf", short: "Hr", count: 0, color: "#000000", timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "5", name: "M Asif", short: "MA", count: 0, color: "#eab308", timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "6", name: "Usman Zia", short: "UZ", count: 0, color: "#ef4444", timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
  ]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDiallagOpen] = useState(false);
  const [isTimeOffDialogOpen, setIsTimeOffDialogOpen] = useState(false);
  const [isConstraintsDialogOpen, setIsConstraintsDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [newTeacher, setNewTeacher] = useState({ name: "", short: "", color: "#3b82f6" });

  const days = ["Mo", "Tu", "We", "Th", "Fr"];
  const periods = ["1", "2", "3", "4", "5", "6", "7"];

  const handleAddTeacher = () => {
    if (newTeacher.name && newTeacher.short) {
      const teacher: Teacher = {
        id: Date.now().toString(),
        name: newTeacher.name,
        short: newTeacher.short,
        color: newTeacher.color,
        count: 0,
        timeOff: Array(5).fill(null).map(() => Array(7).fill(true)),
        constraints: "",
      };
      setTeachers([...teachers, teacher]);
      setNewTeacher({ name: "", short: "", color: "#3b82f6" });
      setIsAddDialogOpen(false);
    }
  };

  const handleEditTeacher = (teacher: Teacher) => {
    setEditingTeacher({ ...teacher });
    setIsEditDiallagOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingTeacher) {
      setTeachers(teachers.map(t => t.id === editingTeacher.id ? editingTeacher : t));
      setIsEditDiallagOpen(false);
      setEditingTeacher(null);
    }
  };

  const handleDeleteTeacher = (id: string) => {
    setTeachers(teachers.filter((t) => t.id !== id));
  };

  const handleTimeOff = (teacher: Teacher) => {
    setSelectedTeacher({ ...teacher });
    setIsTimeOffDialogOpen(true);
  };

  const handleConstraints = (teacher: Teacher) => {
    setSelectedTeacher({ ...teacher });
    setIsConstraintsDialogOpen(true);
  };

  const toggleTimeSlot = (dayIndex: number, periodIndex: number) => {
    if (selectedTeacher) {
      const updated = { ...selectedTeacher };
      updated.timeOff = updated.timeOff.map(row => [...row]);
      updated.timeOff[dayIndex][periodIndex] = !updated.timeOff[dayIndex][periodIndex];
      setSelectedTeacher(updated);
    }
  };

  const handleSaveTimeOff = () => {
    if (selectedTeacher) {
      setTeachers(teachers.map(t => t.id === selectedTeacher.id ? selectedTeacher : t));
      setIsTimeOffDialogOpen(false);
      setSelectedTeacher(null);
    }
  };

  const handleSaveConstraints = () => {
    if (selectedTeacher) {
      setTeachers(teachers.map(t => t.id === selectedTeacher.id ? selectedTeacher : t));
      setIsConstraintsDialogOpen(false);
      setSelectedTeacher(null);
    }
  };

  return (
    <PageWrapper>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/80 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-800">Teachers</h1>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}
            className="active:scale-95 transition-transform duration-100">
            <Plus className="w-4 h-4 mr-2" />
            New Teacher
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white/70 backdrop-blur-sm rounded-lg border border-gray-100 shadow-sm">
          {teachers.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-gray-100 rounded-full mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No teachers yet</p>
              <p className="text-gray-400 text-sm mt-1">Click "New Teacher" to add your first teacher</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="font-semibold text-gray-700">Name</TableHead>
                  <TableHead className="font-semibold text-gray-700">Short</TableHead>
                  <TableHead className="font-semibold text-gray-700">Count</TableHead>
                  <TableHead className="font-semibold text-gray-700">Time off</TableHead>
                  <TableHead className="font-semibold text-gray-700">Class teacher</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => (
                  <TableRow key={teacher.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell>
                      <div className="w-6 h-6 rounded" style={{ backgroundColor: teacher.color }} />
                    </TableCell>
                    <TableCell className="font-medium text-gray-800">{teacher.name}</TableCell>
                    <TableCell className="text-gray-600">{teacher.short}</TableCell>
                    <TableCell className="text-gray-600">{teacher.count}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleTimeOff(teacher)}>
                        <Clock className="w-4 h-4 mr-2" />
                        Set Time Off
                      </Button>
                    </TableCell>
                    <TableCell className="text-gray-400">-</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditTeacher(teacher)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteTeacher(teacher.id)}>
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
          <Button variant="outline" onClick={() => teachers.length > 0 && handleTimeOff(teachers[0])}>
            <Clock className="w-4 h-4 mr-2" />
            Time off
          </Button>
          <Button variant="outline" onClick={() => teachers.length > 0 && handleConstraints(teachers[0])}>
            <Settings className="w-4 h-4 mr-2" />
            Constraints
          </Button>
        </div>
      </div>

      {/* Add Teacher Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Teacher</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="teacherName">Teacher Name</Label>
              <Input id="teacherName" placeholder="e.g., Umair Khalid" value={newTeacher.name} onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherShort">Short Code</Label>
              <Input id="teacherShort" placeholder="e.g., UK" value={newTeacher.short} onChange={(e) => setNewTeacher({ ...newTeacher, short: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherColor">Color</Label>
              <div className="flex gap-2">
                <input type="color" id="teacherColor" value={newTeacher.color} onChange={(e) => setNewTeacher({ ...newTeacher, color: e.target.value })} className="h-10 w-20 rounded border border-gray-300" />
                <Input value={newTeacher.color} onChange={(e) => setNewTeacher({ ...newTeacher, color: e.target.value })} className="flex-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTeacher}>Add Teacher</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Teacher Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDiallagOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Teacher</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editTeacherName">Teacher Name</Label>
              <Input id="editTeacherName" value={editingTeacher?.name || ""} onChange={(e) => setEditingTeacher({ ...editingTeacher!, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTeacherShort">Short Code</Label>
              <Input id="editTeacherShort" value={editingTeacher?.short || ""} onChange={(e) => setEditingTeacher({ ...editingTeacher!, short: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTeacherColor">Color</Label>
              <div className="flex gap-2">
                <input type="color" id="editTeacherColor" value={editingTeacher?.color || "#3b82f6"} onChange={(e) => setEditingTeacher({ ...editingTeacher!, color: e.target.value })} className="h-10 w-20 rounded border border-gray-300" />
                <Input value={editingTeacher?.color || "#3b82f6"} onChange={(e) => setEditingTeacher({ ...editingTeacher!, color: e.target.value })} className="flex-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDiallagOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Time Off Dialog */}
      <Dialog open={isTimeOffDialogOpen} onOpenChange={setIsTimeOffDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Time off — {selectedTeacher?.name}</DialogTitle></DialogHeader>
          <div className="py-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left"></th>
                    {periods.map((period) => (
                      <th key={period} className="p-2 text-center w-12">{period}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((day, dayIndex) => (
                    <tr key={day} className="border-t border-gray-200">
                      <td className="p-2 font-medium bg-gray-50">{day}</td>
                      {periods.map((_, periodIndex) => (
                        <td key={periodIndex} className="p-2 text-center">
                          <button onClick={() => toggleTimeSlot(dayIndex, periodIndex)} className="w-full h-8 flex items-center justify-center hover:bg-gray-100 rounded">
                            {selectedTeacher?.timeOff[dayIndex][periodIndex] ? (
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
          <DialogHeader><DialogTitle>Constraints — {selectedTeacher?.name}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maxPeriodsPerDay">Max periods per day</Label>
              <Input id="maxPeriodsPerDay" type="number" placeholder="e.g., 6" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPeriodsPerWeek">Max periods per week</Label>
              <Input id="maxPeriodsPerWeek" type="number" placeholder="e.g., 30" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherConstraints">Additional Constraints</Label>
              <Textarea id="teacherConstraints" placeholder="e.g., Prefer morning slots, No back-to-back periods" value={selectedTeacher?.constraints || ""} onChange={(e) => setSelectedTeacher({ ...selectedTeacher!, constraints: e.target.value })} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveConstraints}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}