import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Card, CardContent } from "../components/ui/card";
import { Building2, Calendar, BookOpen, Users, School, DoorOpen, BookMarked } from "lucide-react";
import { motion } from "motion/react";
import { useStore } from "../store/useStore";

export function Dashboard() {
  const navigate = useNavigate();
  const { subjects, teachers, classes, classrooms, lessons, settings, updateSettings } = useStore();
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [academicYear, setAcademicYear] = useState(settings.academicYear);
  const [periodsPerDay, setPeriodsPerDay] = useState(settings.periodsPerDay);
  const [numberOfDays, setNumberOfDays] = useState(settings.numberOfDays);

  useEffect(() => {
    setSchoolName(settings.schoolName);
    setAcademicYear(settings.academicYear);
    setPeriodsPerDay(settings.periodsPerDay);
    setNumberOfDays(settings.numberOfDays);
  }, [settings]);

  const stats = [
    { icon: BookOpen, label: "Subjects", value: subjects.length, path: "/subjects" },
    { icon: Users, label: "Teachers", value: teachers.length, path: "/teachers" },
    { icon: School, label: "Classes", value: classes.length, path: "/classes" },
    { icon: DoorOpen, label: "Classrooms", value: classrooms.length, path: "/classrooms" },
    { icon: BookMarked, label: "Lessons", value: lessons.length, path: "/lessons" },
  ];

  const handleSave = () => {
    updateSettings({ schoolName, academicYear, periodsPerDay, numberOfDays, breaks: settings.breaks, breakAfterPeriod: settings.breakAfterPeriod ?? 3 });
  };

  return (
    <motion.div
      className="flex-1 flex flex-col p-8 gap-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.2 }}
            >
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(stat.path)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Setup card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.2 }}
      >
        <Card className="w-full max-w-xl mx-auto">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-md bg-muted">
                <Building2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Automatic Timetable Scheduler</h2>
                <p className="text-xs text-muted-foreground">Powered by Genetic Algorithm</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="schoolName">School name</Label>
                <Input
                  id="schoolName"
                  placeholder="Enter school name"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  onBlur={handleSave}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="academicYear">Academic year</Label>
                <Input
                  id="academicYear"
                  placeholder="2024-2025"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  onBlur={handleSave}
                />
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-lg border border-border">
                <Calendar className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="periodsPerDay">Periods per day</Label>
                    <Select value={periodsPerDay} onValueChange={(val) => {
                      setPeriodsPerDay(val);
                      updateSettings({ ...settings, periodsPerDay: val });
                    }}>
                      <SelectTrigger id="periodsPerDay"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[5, 6, 7, 8, 9, 10].map((num) => (
                          <SelectItem key={num} value={String(num)}>{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="numberOfDays">Number of days</Label>
                    <Select value={numberOfDays} onValueChange={(val) => {
                      setNumberOfDays(val);
                      updateSettings({ ...settings, numberOfDays: val });
                    }}>
                      <SelectTrigger id="numberOfDays"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[5, 6, 7].map((num) => (
                          <SelectItem key={num} value={String(num)}>{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Configure break periods in the Settings tab.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/")}>Previous</Button>
                <Button size="sm" onClick={() => navigate("/subjects")}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
