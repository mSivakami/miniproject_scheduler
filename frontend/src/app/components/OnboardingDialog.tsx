import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router';
import { BookOpen, Users, School, DoorOpen, CheckCircle, Rocket} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function OnboardingDialog() {
  const { isFirstTime, completeOnboarding, updateSettings, settings } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [schoolName, setSchoolName] = useState('');

  const handleSkip = () => {
    completeOnboarding();
  };

  const handleStart = () => {
    if (schoolName.trim()) {
      updateSettings({ ...settings, schoolName });
    }
    completeOnboarding();
    setStep(3);
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
                    <Rocket className="w-8 h-8 text-white" />
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

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100">
                    <BookOpen className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Subjects</h4>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                    <Users className="w-6 h-6 text-green-600 mx-auto mb-1" />
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Teachers</h4>
                  </div>
                  <div className="p-3 bg-violet-50 rounded-lg border border-violet-100">
                    <School className="w-6 h-6 text-violet-600 mx-auto mb-1" />
                    <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Classes</h4>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <DoorOpen className="w-6 h-6 text-amber-600 mx-auto mb-1" />
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

          {/* Step 2: School Setup */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <DialogTitle className="text-2xl">Tell us about your institution</DialogTitle>
                <DialogDescription>Enter your school or college name to get started</DialogDescription>
              </DialogHeader>

              <div className="py-6">
                <div className="space-y-4">
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">This helps us personalize your workspace.</p>
                  </div>

                  <div className="p-4 bg-muted/40 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground">
                      💡 You can configure working days, periods, and break timings in the <strong>Settings</strong> tab once you finish this setup.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleSkip}>Skip & Start</Button>
                <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
                <Button onClick={handleStart} disabled={!schoolName.trim()}>
                  Setup Institution →
                </Button>
              </DialogFooter>
            </motion.div>
          )}

          {/* Step 3: Complete */}
          {step === 3 && (
            <motion.div
              key="step3"
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
                  <DialogDescription>Let's build your first timetable</DialogDescription>
                </div>
              </DialogHeader>

              <div className="py-4 space-y-3">
                <p className="text-center text-gray-600 dark:text-gray-300 mb-4 text-sm">
                  We'll guide you through the process. Start by adding your data:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { path: '/subjects', label: '1. Add Subjects', color: 'blue' },
                    { path: '/teachers', label: '2. Add Teachers', color: 'green' },
                    { path: '/classes', label: '3. Add Classes', color: 'violet' },
                    { path: '/classrooms', label: '4. Add Classrooms', color: 'amber' },
                    { path: '/lessons', label: '5. Create Lessons', color: 'indigo' },
                  ].map((item) => (
                    <button
                      key={item.path}
                      onClick={() => handleNavigate(item.path)}
                      className="w-full p-2.5 text-left border border-border rounded-lg hover:border-primary hover:bg-muted/50 transition-all flex items-center justify-between group"
                    >
                      <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">{item.label}</span>
                      <div className="w-5 h-5 flex items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                        <span className="text-[10px]">→</span>
                      </div>
                    </button>
                  ))}
                  
                  <button
                    onClick={() => handleNavigate('/timetable')}
                    className="w-full p-3 text-left border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 transition-all flex items-center justify-between"
                  >
                    <span className="font-bold text-sm text-blue-700 dark:text-blue-300">✓ Generate Timetable</span>
                    <span className="text-xs text-blue-600">Go!</span>
                  </button>
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