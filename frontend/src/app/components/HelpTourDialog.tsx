import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { BookMarked, Calendar, Clock, Zap, Save, Info, BookOpen, Users, School, DoorOpen, Settings, ChevronRight, Check, Plus, Target, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HelpTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpTourDialog({ open, onOpenChange }: HelpTourDialogProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 8;

  const handleClose = () => {
    setStep(1);
    onOpenChange(false);
  };

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
    else handleClose();
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-700">
          <motion.div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
            initial={{ width: 0 }}
            animate={{ width: `${(step / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Overview */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">Welcome to the Help Tour! 👋</DialogTitle>
                    <DialogDescription>Complete guide to using the Timetable Scheduler</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-6 space-y-4">
                <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">This tour will teach you:</h4>
                  <div className="space-y-3">
                    {[
                      { icon: BookOpen, text: 'How to add and manage subjects, teachers, classes, and classrooms', color: 'blue' },
                      { icon: Calendar, text: 'Understanding time-off availability matrices', color: 'green' },
                      { icon: BookMarked, text: 'Creating lessons with flexible session types', color: 'indigo' },
                      { icon: Save, text: 'Save All workflow and why it matters', color: 'orange' },
                      { icon: Zap, text: 'How the Genetic Algorithm generates timetables', color: 'purple' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`p-2 bg-${item.color}-100 rounded-lg flex-shrink-0`}>
                          <item.icon className={`w-5 h-5 text-${item.color}-600`} />
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-200 pt-1">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/40">
                  <div className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Takes about 5 minutes</span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Step 1 of {totalSteps}</span>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleClose}>Close</Button>
                <Button onClick={handleNext}>Let's Start →</Button>
              </DialogFooter>
            </motion.div>
          )}

          {/* Step 2: Subjects */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                    <BookOpen className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">Step 1: Subjects 📚</DialogTitle>
                    <DialogDescription>Define the courses and subjects to be scheduled</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-6 space-y-4">
                <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">What to Add:</h4>
                  <div className="space-y-3 mb-4">
                    <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-blue-100 dark:border-blue-900/40">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Subject Name</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300">e.g., "Artificial Intelligence", "Data Structures"</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-blue-100 dark:border-blue-900/40">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Short Name</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300">Abbreviation for timetable display: "AI", "DS"</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-blue-100 dark:border-blue-900/40">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Constraint Type</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300">Soft, Medium, or Hard - defines scheduling flexibility</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-blue-100 dark:border-blue-900/40">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Priority</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300">Number indicating scheduling priority (1 = highest)</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                  <Target className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-900 mb-1">Pro Tip:</p>
                    <p className="text-sm text-yellow-800">Use descriptive short names that are easy to read in the timetable grid!</p>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Step {step} of {totalSteps}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleBack}>← Back</Button>
                  <Button onClick={handleNext}>Next →</Button>
                </div>
              </DialogFooter>
            </motion.div>
          )}

          {/* Step 3: Teachers, Classes, Classrooms */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">Steps 2-4: Core Entities 👥</DialogTitle>
                    <DialogDescription>Add teachers, classes, and classrooms</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-6 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {/* Teachers */}
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-5 h-5 text-green-600" />
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100">Teachers</h4>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">Add your teaching staff with:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-600" />
                        <span>Full Name</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-600" />
                        <span>Short Name</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-600" />
                        <span>Color Code</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-600" />
                        <span>Availability</span>
                      </div>
                    </div>
                  </div>

                  {/* Classes */}
                  <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
                    <div className="flex items-center gap-2 mb-3">
                      <School className="w-5 h-5 text-violet-600" />
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100">Classes / Sections</h4>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">Student groups that need scheduling:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-violet-600" />
                        <span>Class Name</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-violet-600" />
                        <span>Short Name</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-violet-600" />
                        <span>Availability</span>
                      </div>
                    </div>
                  </div>

                  {/* Classrooms */}
                  <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                      <DoorOpen className="w-5 h-5 text-amber-600" />
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100">Classrooms</h4>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">Physical rooms and labs:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-amber-600" />
                        <span>Room Name</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-amber-600" />
                        <span>Type (Room/Lab)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-amber-600" />
                        <span>Building</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-amber-600" />
                        <span>Availability</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Step {step} of {totalSteps}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleBack}>← Back</Button>
                  <Button onClick={handleNext}>Next →</Button>
                </div>
              </DialogFooter>
            </motion.div>
          )}

          {/* Step 4: Time-Off Matrices */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl">
                    <Calendar className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">Time-Off Availability 📅</DialogTitle>
                    <DialogDescription>Control scheduling availability for each entity</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-6 space-y-4">
                <div className="p-5 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl border border-green-200">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-green-600" />
                    Interactive Availability Grids
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">
                    Each teacher, class, and classroom has a grid showing their availability throughout the week.
                  </p>
                  
                  <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-green-100">
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Example: Teacher Availability</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="p-2 text-left font-medium text-gray-600 dark:text-gray-300">Period</th>
                            <th className="p-2 text-center font-medium text-gray-600 dark:text-gray-300">Mon</th>
                            <th className="p-2 text-center font-medium text-gray-600 dark:text-gray-300">Tue</th>
                            <th className="p-2 text-center font-medium text-gray-600 dark:text-gray-300">Wed</th>
                            <th className="p-2 text-center font-medium text-gray-600 dark:text-gray-300">Thu</th>
                            <th className="p-2 text-center font-medium text-gray-600 dark:text-gray-300">Fri</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[1, 2, 3, 4].map((period) => (
                            <tr key={period} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="p-2 font-medium text-gray-700 dark:text-gray-200">{period}</td>
                              {[...Array(5)].map((_, day) => {
                                const isAvailable = !(period === 1 && day === 0) && !(period === 3 && day === 4);
                                return (
                                  <td key={day} className="p-2">
                                    <div className={`h-8 rounded flex items-center justify-center font-semibold ${
                                      isAvailable 
                                        ? 'bg-green-200 text-green-800' 
                                        : 'bg-red-200 text-red-800'
                                    }`}>
                                      {isAvailable ? '✓' : '✕'}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-200 rounded" />
                        <span className="text-gray-600 dark:text-gray-300">Available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-200 rounded" />
                        <span className="text-gray-600 dark:text-gray-300">Not Available</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/40">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">How to Use:</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">Click on any cell to toggle availability. Red cells (✕) will be blocked during timetable generation.</p>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Step {step} of {totalSteps}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleBack}>← Back</Button>
                  <Button onClick={handleNext}>Next →</Button>
                </div>
              </DialogFooter>
            </motion.div>
          )}

          {/* Step 5: Lessons & Session Types */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                    <BookMarked className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">Step 5: Lessons 📖</DialogTitle>
                    <DialogDescription>Combine everything with flexible session types</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-6 space-y-4">
                <div className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">What are Lessons?</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">
                    A lesson connects all the pieces together: Subject + Teacher + Class + Classroom
                  </p>
                  
                  <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-indigo-100 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Example Lesson:</p>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Data Structures → Prof. Smith → BSCS 2nd → Room 201</p>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Session Types:</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <span className="text-sm"><strong>Single</strong> — 1 period</span>
                          <span className="text-xs bg-blue-200 px-2 py-1 rounded">3/week × 1p = 3 periods</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <span className="text-sm"><strong>Double</strong> — 2 periods</span>
                          <span className="text-xs bg-blue-200 px-2 py-1 rounded">1/week × 2p = 2 periods</span>
                        </div>
                        <div className="pt-2 border-t border-indigo-100">
                          <span className="text-sm font-bold text-indigo-600">Total: 5 periods/week</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-100 p-3 rounded-lg">
                    <p className="text-sm font-semibold text-indigo-900 mb-1">Session Type Options:</p>
                    <ul className="text-xs text-indigo-800 space-y-1">
                      <li>• <strong>Single:</strong> 1 continuous period (lectures)</li>
                      <li>• <strong>Double:</strong> 2 continuous periods (labs, workshops)</li>
                      <li>• <strong>Triple:</strong> 3 continuous periods (extended labs)</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                  <Plus className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-900 mb-1">Multiple Session Types:</p>
                    <p className="text-sm text-yellow-800">Click "+ add session type" to mix different session lengths in one lesson!</p>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Step {step} of {totalSteps}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleBack}>← Back</Button>
                  <Button onClick={handleNext}>Next →</Button>
                </div>
              </DialogFooter>
            </motion.div>
          )}

          {/* Step 6: Save All Workflow */}
          {step === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl">
                    <Save className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">Save All Workflow 💾</DialogTitle>
                    <DialogDescription>Critical step before generating timetables</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-6 space-y-4">
                <div className="p-5 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-orange-600" />
                    The Complete Workflow
                  </h4>
                  <div className="space-y-3">
                    {[
                      { num: 1, title: 'Add & Edit Your Data', desc: 'Make changes to subjects, teachers, classes, classrooms, and lessons. All changes are tracked in the frontend.' },
                      { num: 2, title: 'Unsaved Changes Banner Appears', desc: 'An orange banner with a pulsing indicator shows at the top when you have unsaved changes.' },
                      { num: 3, title: 'Click "Save All" Button', desc: 'Click the button in the orange banner to save everything to the database in one batch operation.' },
                      { num: 4, title: 'Generate Timetable', desc: 'Only after saving can you generate the timetable. The genetic algorithm needs saved data!' },
                    ].map((item) => (
                      <div key={item.num} className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-orange-100">
                        <div className="flex items-center justify-center w-7 h-7 bg-orange-500 text-white rounded-full font-bold text-sm flex-shrink-0">
                          {item.num}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{item.title}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">Preview:</p>
                  <div className="flex items-center justify-between p-3 bg-orange-500 text-white rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-white dark:bg-gray-900 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">You have unsaved changes</span>
                    </div>
                    <button className="bg-white dark:bg-gray-900 text-orange-600 px-4 py-1.5 rounded text-sm font-semibold shadow-lg">
                      Save All
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-red-100 border-l-4 border-red-500 rounded-r-lg">
                  <p className="text-sm font-semibold text-red-900 mb-1">⚠️ Critical:</p>
                  <p className="text-xs text-red-800">
                    Always save before generating! The algorithm can't access unsaved changes.
                  </p>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Step {step} of {totalSteps}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleBack}>← Back</Button>
                  <Button onClick={handleNext}>Next →</Button>
                </div>
              </DialogFooter>
            </motion.div>
          )}

          {/* Step 7: Genetic Algorithm */}
          {step === 7 && (
            <motion.div
              key="step7"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">Genetic Algorithm ⚡</DialogTitle>
                    <DialogDescription>How the AI generates optimal timetables</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-6 space-y-4">
                <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">What is a Genetic Algorithm?</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">
                    An AI technique inspired by natural evolution that finds optimal solutions by:
                  </p>
                  
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-purple-100">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">🧬</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-purple-900 mb-1">1. Population</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300">Creates multiple random timetable variations (e.g., 50-100 schedules)</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-purple-100">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">⭐</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-purple-900 mb-1">2. Fitness Evaluation</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300">Scores each timetable based on constraints (no conflicts, availability, etc.)</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-purple-100">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">🔄</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-purple-900 mb-1">3. Evolution</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300">Uses crossover and mutation to create better schedules over generations</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-purple-100">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">🏆</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-purple-900 mb-1">4. Best Solution</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300">After many generations, returns the optimal timetable</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-100 p-4 rounded-lg">
                  <p className="text-sm font-semibold text-purple-900 mb-2">Configurable Parameters:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white dark:bg-gray-900 p-2 rounded">
                      <p className="font-semibold text-gray-800 dark:text-gray-100">Population Size</p>
                      <p className="text-gray-600 dark:text-gray-300">50-200 schedules</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2 rounded">
                      <p className="font-semibold text-gray-800 dark:text-gray-100">Generations</p>
                      <p className="text-gray-600 dark:text-gray-300">100-1000 cycles</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2 rounded">
                      <p className="font-semibold text-gray-800 dark:text-gray-100">Mutation Rate</p>
                      <p className="text-gray-600 dark:text-gray-300">0.01-0.1 (1-10%)</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2 rounded">
                      <p className="font-semibold text-gray-800 dark:text-gray-100">Crossover Rate</p>
                      <p className="text-gray-600 dark:text-gray-300">0.7-0.9 (70-90%)</p>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Step {step} of {totalSteps}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleBack}>← Back</Button>
                  <Button onClick={handleNext}>Next →</Button>
                </div>
              </DialogFooter>
            </motion.div>
          )}

          {/* Step 8: Settings & Tips */}
          {step === 8 && (
            <motion.div
              key="step8"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl">
                    <Settings className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">Settings & Pro Tips 🚀</DialogTitle>
                    <DialogDescription>Configure your scheduler and best practices</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-6 space-y-4">
                <div className="p-5 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200 dark:border-gray-700">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Settings Page</h4>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-200"><strong>School Setup:</strong> Name, academic year, periods/day, working days</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-200"><strong>Load Sample Data:</strong> Quick way to test the app</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-200"><strong>Reset All:</strong> Clear everything and start fresh</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-5 rounded-xl border border-green-200">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-green-600" />
                    Pro Tips for Best Results
                  </h4>
                  <div className="space-y-2">
                    {[
                      'Set realistic availability - block lunch breaks and non-working hours',
                      'Use descriptive short names that fit in timetable cells',
                      'Mark important subjects with high priority',
                      'Save frequently to avoid losing work',
                      'Start with sample data to learn the interface',
                      'Adjust GA parameters if generation takes too long',
                    ].map((tip, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-200">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-blue-100 rounded-lg text-center">
                  <p className="text-sm font-semibold text-blue-900 mb-1">🎉 You're now ready to create amazing timetables!</p>
                  <p className="text-xs text-blue-700">Remember: You can access this tour anytime from Settings</p>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Step {step} of {totalSteps}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleBack}>← Back</Button>
                  <Button onClick={handleClose} className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                    Finish Tour ✓
                  </Button>
                </div>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
