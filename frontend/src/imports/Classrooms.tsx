import { useState } from "react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Plus, Pencil, Trash2, DoorOpen, Clock, BookOpen as BookIcon, Settings } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { PageWrapper } from "../components/PageWrapper";

interface Classroom {
  id: string;
  name: string;
  short: string;
  count: number;
  type: string;
  building: string;
  color: string;
  timeOff: boolean[][];
  constraints: string;
}

export function Classrooms() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([
    { id: "1", name: "Room#201", short: "R", count: 0, type: "R", building: "", color: "#a855f7", timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "2", name: "Room#202", short: "R", count: 0, type: "R", building: "", color: "#a855f7", timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "3", name: "Room#203", short: "R", count: 0, type: "R", building: "", color: "#a855f7", timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "4", name: "Room#205", short: "R", count: 0, type: "R", building: "", color: "#a855f7", timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "5", name: "LAB A", short: "L", count: 0, type: "L", building: "", color: "#10b981", timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "6", name: "LAB B", short: "L", count: 0, type: "L", building: "", color: "#10b981", timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
  ]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTimeOffDialogOpen, setIsTimeOffDialogOpen] = useState(false);
  const [isConstraintsDialogOpen, setIsConstraintsDialogOpen] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
  const [newClassroom, setNewClassroom] = useState({ name: "", short: "", type: "R", color: "#a855f7" });

  const days = ["Mo", "Tu", "We", "Th", "Fr"];
  const periods = ["1", "2", "3", "4", "5", "6", "7"];

  const handleAddClassroom = () => {
    if (newClassroom.name && newClassroom.short) {
      const classroom: Classroom = {
        id: Date.now().toString(),
        name: newClassroom.name,
        short: newClassroom.short,
        type: newClassroom.type,
        building: "",
        count: 0,
        color: newClassroom.color,
        timeOff: Array(5).fill(null).map(() => Array(7).fill(true)),
        constraints: "",
      };
      setClassrooms([...classrooms, classroom]);
      setNewClassroom({ name: "", short: "", type: "R", color: "#a855f7" });
      setIsAddDialogOpen(false);
    }
  };

  const handleEditClassroom = (classroom: Classroom) => {
    setEditingClassroom({ ...classroom });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingClassroom) {
      setClassrooms(classrooms.map(c => c.id === editingClassroom.id ? editingClassroom : c));
      setIsEditDialogOpen(false);
      setEditingClassroom(null);
    }
  };

  const handleDeleteClassroom = (id: string) => {
    setClassrooms(classrooms.filter((c) => c.id !== id));
  };

  const handleTimeOff = (classroom: Classroom) => {
    setSelectedClassroom({ ...classroom });
    setIsTimeOffDialogOpen(true);
  };

  const handleConstraints = (classroom: Classroom) => {
    setSelectedClassroom({ ...classroom });
    setIsConstraintsDialogOpen(true);
  };

  const toggleTimeSlot = (dayIndex: number, periodIndex: number) => {
    if (selectedClassroom) {
      const updated = { ...selectedClassroom };
      updated.timeOff = updated.timeOff.map(row => [...row]);
      updated.timeOff[dayIndex][periodIndex] = !updated.timeOff[dayIndex][periodIndex];
      setSelectedClassroom(updated);
    }
  };

  const handleSaveTimeOff = () => {
    if (selectedClassroom) {
      setClassrooms(classrooms.map(c => c.id === selectedClassroom.id ? selectedClassroom : c));
      setIsTimeOffDialogOpen(false);
      setSelectedClassroom(null);
    }
  };

  const handleSaveConstraints = () => {
    if (selectedClassroom) {
      setClassrooms(classrooms.map(c => c.id === selectedClassroom.id ? selectedClassroom : c));
      setIsConstraintsDialogOpen(false);
      setSelectedClassroom(null);
    }
  };

  return (
    <PageWrapper>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/80 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DoorOpen className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-800">Classrooms</h1>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}
            className="active:scale-95 transition-transform duration-100">
            <Plus className="w-4 h-4 mr-2" />
            New Classroom
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white/70 backdrop-blur-sm rounded-lg border border-gray-100 shadow-sm">
          {classrooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-gray-100 rounded-full mb-4">
                <DoorOpen className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No classrooms yet</p>
              <p className="text-gray-400 text-sm mt-1">Click "New Classroom" to add your first classroom</p>
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
                  <TableHead className="font-semibold text-gray-700">Type</TableHead>
                  <TableHead className="font-semibold text-gray-700">Building</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classrooms.map((classroom) => (
                  <TableRow key={classroom.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell>
                      <div className="w-6 h-6 rounded" style={{ backgroundColor: classroom.color }} />
                    </TableCell>
                    <TableCell className="font-medium text-gray-800">{classroom.name}</TableCell>
                    <TableCell className="text-gray-600">{classroom.short}</TableCell>
                    <TableCell className="text-gray-600">{classroom.count}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleTimeOff(classroom)}>
                        <Clock className="w-4 h-4 mr-2" />
                        Set Time Off
                      </Button>
                    </TableCell>
                    <TableCell className="text-gray-600">{classroom.type}</TableCell>
                    <TableCell className="text-gray-400">{classroom.building || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClassroom(classroom)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClassroom(classroom.id)}>
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
          <Button variant="outline" onClick={() => classrooms.length > 0 && handleTimeOff(classrooms[0])}>
            <Clock className="w-4 h-4 mr-2" />
            Time off
          </Button>
          <Button variant="outline" onClick={() => classrooms.length > 0 && handleConstraints(classrooms[0])}>
            <Settings className="w-4 h-4 mr-2" />
            Constraints
          </Button>
        </div>
      </div>

      {/* Add Classroom Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Classroom</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="classroomName">Classroom Name</Label>
              <Input id="classroomName" placeholder="e.g., Room #201" value={newClassroom.name} onChange={(e) => setNewClassroom({ ...newClassroom, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classroomShort">Short Code</Label>
              <Input id="classroomShort" placeholder="e.g., R" value={newClassroom.short} onChange={(e) => setNewClassroom({ ...newClassroom, short: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classroomType">Type</Label>
              <Select value={newClassroom.type} onValueChange={(value) => setNewClassroom({ ...newClassroom, type: value })}>
                <SelectTrigger id="classroomType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="R">Regular (R)</SelectItem>
                  <SelectItem value="L">Lab (L)</SelectItem>
                  <SelectItem value="H">Hall (H)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classroomColor">Color</Label>
              <div className="flex gap-2">
                <input type="color" id="classroomColor" value={newClassroom.color} onChange={(e) => setNewClassroom({ ...newClassroom, color: e.target.value })} className="h-10 w-20 rounded border border-gray-300" />
                <Input value={newClassroom.color} onChange={(e) => setNewClassroom({ ...newClassroom, color: e.target.value })} className="flex-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddClassroom}>Add Classroom</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Classroom Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Classroom</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editClassroomName">Classroom Name</Label>
              <Input id="editClassroomName" value={editingClassroom?.name || ""} onChange={(e) => setEditingClassroom({ ...editingClassroom!, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editClassroomShort">Short Code</Label>
              <Input id="editClassroomShort" value={editingClassroom?.short || ""} onChange={(e) => setEditingClassroom({ ...editingClassroom!, short: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editClassroomType">Type</Label>
              <Select value={editingClassroom?.type || "R"} onValueChange={(value) => setEditingClassroom({ ...editingClassroom!, type: value })}>
                <SelectTrigger id="editClassroomType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="R">Regular (R)</SelectItem>
                  <SelectItem value="L">Lab (L)</SelectItem>
                  <SelectItem value="H">Hall (H)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editClassroomBuilding">Building</Label>
              <Input id="editClassroomBuilding" placeholder="e.g., Main Building" value={editingClassroom?.building || ""} onChange={(e) => setEditingClassroom({ ...editingClassroom!, building: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editClassroomColor">Color</Label>
              <div className="flex gap-2">
                <input type="color" id="editClassroomColor" value={editingClassroom?.color || "#a855f7"} onChange={(e) => setEditingClassroom({ ...editingClassroom!, color: e.target.value })} className="h-10 w-20 rounded border border-gray-300" />
                <Input value={editingClassroom?.color || "#a855f7"} onChange={(e) => setEditingClassroom({ ...editingClassroom!, color: e.target.value })} className="flex-1" />
              </div>
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
          <DialogHeader><DialogTitle>Time off — {selectedClassroom?.name}</DialogTitle></DialogHeader>
          <div className="py-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-purple-100">
                    <th className="p-2 text-left"></th>
                    {periods.map((period) => (
                      <th key={period} className="p-2 text-center w-12">{period}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((day, dayIndex) => (
                    <tr key={day} className="border-t border-purple-200">
                      <td className="p-2 font-medium bg-purple-50">{day}</td>
                      {periods.map((_, periodIndex) => (
                        <td key={periodIndex} className="p-2 text-center">
                          <button onClick={() => toggleTimeSlot(dayIndex, periodIndex)} className="w-full h-8 flex items-center justify-center hover:bg-purple-100 rounded">
                            {selectedClassroom?.timeOff[dayIndex][periodIndex] ? (
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
          <DialogHeader><DialogTitle>Constraints — {selectedClassroom?.name}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maxCapacity">Max Capacity</Label>
              <Input id="maxCapacity" type="number" placeholder="e.g., 50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classroomConstraints">Additional Constraints</Label>
              <Textarea id="classroomConstraints" placeholder="e.g., Requires projector, AC maintenance on Wednesdays" value={selectedClassroom?.constraints || ""} onChange={(e) => setSelectedClassroom({ ...selectedClassroom!, constraints: e.target.value })} rows={4} />
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