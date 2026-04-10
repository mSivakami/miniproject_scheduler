import { useState } from "react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Plus, Pencil, Trash2, School, Clock, BookOpen as BookIcon, Settings } from "lucide-react";import { Textarea } from "../components/ui/textarea";
import { PageWrapper } from "../components/PageWrapper";

interface Class {
  id: string;
  name: string;
  short: string;
  count: number;
  timeOff: boolean[][];
  constraints: string;
}

export function Classes() {
  const [classes, setClasses] = useState<Class[]>([
    { id: "1", name: "BSCS 2nd MOR", short: "BSCS 2nd MOR", count: 0, timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "2", name: "BSCS 4th MOR", short: "BSCS 4th MOR", count: 0, timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "3", name: "BSSE 2nd MOR", short: "BSSE 2nd MOR", count: 0, timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "4", name: "BSSE 4th MOR", short: "BSSE 4th MOR", count: 0, timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "5", name: "BScIT 2nd MOR", short: "BScIT 2nd MOR", count: 0, timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
    { id: "6", name: "BScIT 4th MOR", short: "BScIT 4th MOR", count: 0, timeOff: Array(5).fill(null).map(() => Array(7).fill(true)), constraints: "" },
  ]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTimeOffDialogOpen, setIsTimeOffDialogOpen] = useState(false);
  const [isConstraintsDialogOpen, setIsConstraintsDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [newClass, setNewClass] = useState({ name: "", short: "" });

  const days = ["Mo", "Tu", "We", "Th", "Fr"];
  const periods = ["1", "2", "3", "4", "5", "6", "7"];

  const handleAddClass = () => {
    if (newClass.name && newClass.short) {
      const classItem: Class = {
        id: Date.now().toString(),
        name: newClass.name,
        short: newClass.short,
        count: 0,
        timeOff: Array(5).fill(null).map(() => Array(7).fill(true)),
        constraints: "",
      };
      setClasses([...classes, classItem]);
      setNewClass({ name: "", short: "" });
      setIsAddDialogOpen(false);
    }
  };

  const handleEditClass = (classItem: Class) => {
    setEditingClass({ ...classItem });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingClass) {
      setClasses(classes.map(c => c.id === editingClass.id ? editingClass : c));
      setIsEditDialogOpen(false);
      setEditingClass(null);
    }
  };

  const handleDeleteClass = (id: string) => {
    setClasses(classes.filter((c) => c.id !== id));
  };

  const handleTimeOff = (classItem: Class) => {
    setSelectedClass({ ...classItem });
    setIsTimeOffDialogOpen(true);
  };

  const handleConstraints = (classItem: Class) => {
    setSelectedClass({ ...classItem });
    setIsConstraintsDialogOpen(true);
  };

  const toggleTimeSlot = (dayIndex: number, periodIndex: number) => {
    if (selectedClass) {
      const updated = { ...selectedClass };
      updated.timeOff = updated.timeOff.map(row => [...row]);
      updated.timeOff[dayIndex][periodIndex] = !updated.timeOff[dayIndex][periodIndex];
      setSelectedClass(updated);
    }
  };

  const handleSaveTimeOff = () => {
    if (selectedClass) {
      setClasses(classes.map(c => c.id === selectedClass.id ? selectedClass : c));
      setIsTimeOffDialogOpen(false);
      setSelectedClass(null);
    }
  };

  const handleSaveConstraints = () => {
    if (selectedClass) {
      setClasses(classes.map(c => c.id === selectedClass.id ? selectedClass : c));
      setIsConstraintsDialogOpen(false);
      setSelectedClass(null);
    }
  };

  return (
    <PageWrapper>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/80 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <School className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-800">Classes</h1>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}
            className="active:scale-95 transition-transform duration-100">
            <Plus className="w-4 h-4 mr-2" />
            New Class
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
          <div className="bg-white/70 backdrop-blur-sm rounded-lg border border-gray-100 shadow-sm">          {classes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-gray-100 rounded-full mb-4">
                <School className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No classes yet</p>
              <p className="text-gray-400 text-sm mt-1">Click "New Class" to add your first class</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold text-gray-700">Name</TableHead>
                  <TableHead className="font-semibold text-gray-700">Short</TableHead>
                  <TableHead className="font-semibold text-gray-700">Count</TableHead>
                  <TableHead className="font-semibold text-gray-700">Time off</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((classItem) => (
                  <TableRow key={classItem.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium text-gray-800">{classItem.name}</TableCell>
                    <TableCell className="text-gray-600">{classItem.short}</TableCell>
                    <TableCell className="text-gray-600">{classItem.count}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => handleTimeOff(classItem)}>
                        <Clock className="w-4 h-4 mr-2" />
                        Set Time Off
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClass(classItem)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClass(classItem.id)}>
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
          <Button variant="outline" onClick={() => classes.length > 0 && handleTimeOff(classes[0])}>
            <Clock className="w-4 h-4 mr-2" />
            Time off
          </Button>
          <Button variant="outline" onClick={() => classes.length > 0 && handleConstraints(classes[0])}>
            <Settings className="w-4 h-4 mr-2" />
            Constraints
          </Button>
        </div>
      </div>

      {/* Add Class Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Class</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="className">Class Name</Label>
              <Input id="className" placeholder="e.g., BSCS 2nd MOR" value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classShort">Short Code</Label>
              <Input id="classShort" placeholder="e.g., BSCS 2nd MOR" value={newClass.short} onChange={(e) => setNewClass({ ...newClass, short: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddClass}>Add Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Class</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editClassName">Class Name</Label>
              <Input id="editClassName" value={editingClass?.name || ""} onChange={(e) => setEditingClass({ ...editingClass!, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editClassShort">Short Code</Label>
              <Input id="editClassShort" value={editingClass?.short || ""} onChange={(e) => setEditingClass({ ...editingClass!, short: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editClassCount">Count</Label>
              <Input id="editClassCount" type="number" value={editingClass?.count || 0} onChange={(e) => setEditingClass({ ...editingClass!, count: parseInt(e.target.value) })} />
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Time-off - {selectedClass?.name}</DialogTitle>
            <DialogDescription>Click cells to toggle availability</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto border-2 border-gray-300 rounded-lg">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ 
                    border: '2px dashed #d1d5db', 
                    padding: '12px',
                    backgroundColor: '#f9fafb',
                    minWidth: '80px'
                  }}></th>
                  {periods.map((period) => (
                    <th key={period} style={{ 
                      border: '2px dashed #d1d5db', 
                      padding: '12px',
                      backgroundColor: '#fef08a',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      minWidth: '100px'
                    }}>
                      {period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day, dIndex) => (
                  <tr key={day}>
                    <td style={{ 
                      border: '2px dashed #d1d5db', 
                      padding: '12px',
                      backgroundColor: '#f9fafb',
                      fontWeight: '600',
                      textAlign: 'center',
                      minWidth: '80px'
                    }}>
                      {day}
                    </td>
                    {periods.map((_, pIndex) => {
                      const isAvailable = selectedClass?.timeOff?.[dIndex]?.[pIndex] ?? true;
                      return (
                        <td key={`${dIndex}-${pIndex}`} style={{ 
                          border: '2px dashed #d1d5db',
                          padding: 0,
                          minWidth: '100px',
                          height: '70px'
                        }}>
                          <button
                            onClick={() => toggleTimeSlot(dIndex, pIndex)}
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isAvailable ? '#ffffff' : '#fef2f2',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#fef08a';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isAvailable ? '#ffffff' : '#fef2f2';
                            }}
                          >
                            {isAvailable ? (
                              <span style={{ fontSize: '40px', color: '#22c55e', fontWeight: 'bold', lineHeight: 1 }}>✓</span>
                            ) : (
                              <span style={{ fontSize: '40px', color: '#ef4444', fontWeight: 'bold', lineHeight: 1 }}>✗</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-700 bg-gray-50 p-4 rounded border mt-4">
            <span className="font-semibold">Caption:</span>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '28px', color: '#22c55e', fontWeight: 'bold', lineHeight: 1 }}>✓</span>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '28px', color: '#ef4444', fontWeight: 'bold', lineHeight: 1 }}>✗</span>
              <span>Not available</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTimeOffDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTimeOff}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Constraints Dialog */}
      <Dialog open={isConstraintsDialogOpen} onOpenChange={setIsConstraintsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Constraints — {selectedClass?.name}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maxPeriodsPerDay">Max periods per day</Label>
              <Input id="maxPeriodsPerDay" type="number" placeholder="e.g., 6" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classConstraints">Additional Constraints</Label>
              <Textarea id="classConstraints" placeholder="e.g., No periods on Friday afternoon" value={selectedClass?.constraints || ""} onChange={(e) => setSelectedClass({ ...selectedClass!, constraints: e.target.value })} rows={4} />
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