import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router';
import { Sparkles, BookOpen, Users, School, DoorOpen, CheckCircle} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function OnboardingDialog() {
  const { isFirstTime, completeOnboarding, loadSampleData, updateSettings, settings } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [schoolName, setSchoolName] = useState('');

  const handleSkip = () => {
    completeOnboarding();
  };

  const handleLoadSample = () => {
    loadSampleData();
    completeOnboarding();
    setStep(4);
  };

  const handleStart = () => {
    if (schoolName.trim()) {
      updateSettings({ ...settings, schoolName });
    }
    completeOnboarding();
    setStep(4);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <Dialog open={isFirstTime} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl" hideCloseButton>
        <AnimatePresence mode="wait">
          {/* Step 1: Welcome */}
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
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl">Welcome to Timetable Scheduler! 🎓</DialogTitle>
                    <DialogDescription>Create optimal timetables using Genetic Algorithms</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-6 space-y-6">
                <p className="text-gray-600 dark:text-gray-300 text-center">
                  This app automatically generates optimal timetables for your institution.<br />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Need help? Access the detailed tour anytime from Settings!</span>
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100">
                    <BookOpen className="w-6 h-6 text-blue-600 mb-1" />
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Subjects</h4>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                    <Users className="w-6 h-6 text-green-600 mb-1" />
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Teachers</h4>
                  </div>
                  <div className="p-3 bg-violet-50 rounded-lg border border-violet-100">
                    <School className="w-6 h-6 text-violet-600 mb-1" />
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Classes</h4>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <DoorOpen className="w-6 h-6 text-amber-600 mb-1" />
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Classrooms</h4>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleSkip}>Skip & Start</Button>
                <Button onClick={() => setStep(2)}>Continue →</Button>
              </DialogFooter>
            </motion.div>
          )}

          {/* Step 2: Choose Setup Method */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <DialogTitle className="text-2xl">How would you like to start?</DialogTitle>
                <DialogDescription>Choose your preferred setup method</DialogDescription>
              </DialogHeader>

              <div className="py-6 space-y-4">
                <button
                  onClick={handleLoadSample}
                  className="w-full p-6 text-left border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/60 transition-colors">
                      <Sparkles className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Load Sample Data</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Explore the app with pre-populated data. Perfect for testing!
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setStep(3)}
                  className="w-full p-6 text-left border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-green-100 dark:bg-green-900/40 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/60 transition-colors">
                      <School className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Start from Scratch</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Set up your institution with your own data.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleSkip}>Skip & Start</Button>
                <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
              </DialogFooter>
            </motion.div>
          )}

          {/* Step 3: School Setup */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <DialogTitle className="text-2xl">Tell us about your institution</DialogTitle>
                <DialogDescription>Enter your school or college name</DialogDescription>
              </DialogHeader>

              <div className="py-6">
                <div className="space-y-2">
                  <Label htmlFor="schoolName">School / College Name</Label>
                  <Input
                    id="schoolName"
                    placeholder="e.g., Central University"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="text-lg"
                    autoFocus
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400">You can change this later in Settings</p>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleSkip}>Skip & Start</Button>
                <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
                <Button onClick={handleStart} disabled={!schoolName.trim()}>
                  Continue →
                </Button>
              </DialogFooter>
            </motion.div>
          )}

          {/* Step 4: Complete */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="p-4 bg-green-100 dark:bg-green-900/40 rounded-full mb-4">
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  </div>
                  <DialogTitle className="text-2xl">You're All Set! 🎉</DialogTitle>
                  <DialogDescription>Ready to create your first timetable</DialogDescription>
                </div>
              </DialogHeader>

              <div className="py-4 space-y-3">
                <p className="text-center text-gray-600 dark:text-gray-300 mb-4">
                  Follow these steps in order:
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleNavigate('/subjects')}
                    className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all flex items-center gap-3"
                  >
                    <div className="flex items-center justify-center w-7 h-7 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-full font-semibold text-sm">1</div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">Add Subjects</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleNavigate('/teachers')}
                    className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all flex items-center gap-3"
                  >
                    <div className="flex items-center justify-center w-7 h-7 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300 rounded-full font-semibold text-sm">2</div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">Add Teachers</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleNavigate('/classes')}
                    className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all flex items-center gap-3"
                  >
                    <div className="flex items-center justify-center w-7 h-7 bg-violet-100 text-violet-600 rounded-full font-semibold text-sm">3</div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">Add Classes</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleNavigate('/classrooms')}
                    className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all flex items-center gap-3"
                  >
                    <div className="flex items-center justify-center w-7 h-7 bg-amber-100 text-amber-600 rounded-full font-semibold text-sm">4</div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">Add Classrooms</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleNavigate('/lessons')}
                    className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center gap-3"
                  >
                    <div className="flex items-center justify-center w-7 h-7 bg-indigo-100 text-indigo-600 rounded-full font-semibold text-sm">5</div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">Create Lessons</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleNavigate('/timetable')}
                    className="w-full p-3 text-left border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 transition-all flex items-center gap-3"
                  >
                    <div className="flex items-center justify-center w-7 h-7 bg-blue-500 text-white rounded-full font-semibold text-sm">✓</div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">Generate Timetable</p>
                    </div>
                  </button>
                </div>
                
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                  <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                    💡 Need help? Access the detailed tour from Settings
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => handleNavigate('/subjects')} className="w-full">
                  Start Adding Data
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}