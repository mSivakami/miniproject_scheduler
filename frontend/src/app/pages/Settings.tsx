import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Settings as SettingsIcon, Save, Sparkles, Trash2, HelpCircle, Coffee, SlidersHorizontal } from "lucide-react";
import { PageWrapper } from "../components/PageWrapper";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { toast } from "sonner";
import { useStore, Break } from "../store/useStore";
import { HelpTourDialog } from "../components/HelpTourDialog";
import { Slider } from "../components/ui/slider";
import { Switch } from "../components/ui/switch";

// ─── Constraint types ──────────────────────────────────────────────────────

interface SchedulingConstraint {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  weight: number; // 0–100
}

const DEFAULT_CONSTRAINTS: SchedulingConstraint[] = [
  {
    id: "no_consecutive_periods",
    label: "No more than 2 consecutive periods per teacher",
    description: "Prevents a teacher from being assigned 3 or more back-to-back periods in a day.",
    enabled: true,
    weight: 70,
  },
  {
    id: "difficult_not_last",
    label: "Difficult subjects not in last period",
    description: "Subjects marked as difficult are avoided in the final period of the day.",
    enabled: true,
    weight: 60,
  },
  {
    id: "avoid_morning_lab",
    label: "Avoid scheduling labs in morning hours",
    description: "Lab sessions will be placed in mid-day or later periods when possible.",
    enabled: false,
    weight: 50,
  },
  {
    id: "no_subject_twice_same_day",
    label: "Same subject not twice on same day",
    description: "Prevents a subject from appearing in two different periods on the same day for a class.",
    enabled: true,
    weight: 80,
  },
];

const CONSTRAINTS_STORAGE_KEY = "autoscheduler_constraints";

function loadConstraints(): SchedulingConstraint[] {
  try {
    const stored = localStorage.getItem(CONSTRAINTS_STORAGE_KEY);
    if (!stored) return DEFAULT_CONSTRAINTS;
    const parsed: SchedulingConstraint[] = JSON.parse(stored);
    // Merge to pick up any new default constraints not yet stored
    return DEFAULT_CONSTRAINTS.map((def) => {
      const found = parsed.find((p) => p.id === def.id);
      return found ?? def;
    });
  } catch {
    return DEFAULT_CONSTRAINTS;
  }
}

function saveConstraints(constraints: SchedulingConstraint[]) {
  localStorage.setItem(CONSTRAINTS_STORAGE_KEY, JSON.stringify(constraints));
}

// ─── Component ─────────────────────────────────────────────────────────────

export function Settings() {
  const { settings, updateSettings, loadSampleData, resetAllData } = useStore();
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [academicYear, setAcademicYear] = useState(settings.academicYear);
  const [periodsPerDay, setPeriodsPerDay] = useState(settings.periodsPerDay);
  const [numberOfDays, setNumberOfDays] = useState(settings.numberOfDays);
  const [breaks, setBreaks] = useState<Break[]>(settings.breaks || []);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isHelpTourOpen, setIsHelpTourOpen] = useState(false);
  const [constraints, setConstraints] = useState<SchedulingConstraint[]>(loadConstraints);

  const numDays = parseInt(numberOfDays);
  const numPeriods = parseInt(periodsPerDay);
  const exceedsBackendLimit = numDays * numPeriods > 64;
  const periodOptions = [5, 6, 7, 8, 9, 10].filter(num => num <= Math.floor(64 / Math.max(numDays || 1, 1)));
  const dayOptions = [5, 6, 7].filter(num => num * Math.max(numPeriods || 1, 1) <= 64);

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].slice(0, numDays);
  const periods = Array.from({ length: numPeriods }, (_, i) => i + 1);

  const breaksGrid = Array(numDays).fill(null).map((_, day) =>
    Array(numPeriods).fill(null).map((_, period) =>
      breaks.some(b => b.day === day && b.period === period)
    )
  );

  useEffect(() => {
    setSchoolName(settings.schoolName);
    setAcademicYear(settings.academicYear);
    setPeriodsPerDay(settings.periodsPerDay);
    setNumberOfDays(settings.numberOfDays);
    setBreaks(settings.breaks || []);
  }, [settings]);

  const toggleBreak = (day: number, period: number) => {
    setBreaks(prev => {
      const exists = prev.some(b => b.day === day && b.period === period);
      if (exists) return prev.filter(b => !(b.day === day && b.period === period));
      return [...prev, { day, period }];
    });
  };

  const handleSave = () => {
    if (exceedsBackendLimit) {
      toast.error("This backend supports at most 64 total timetable slots. Reduce days or periods.");
      return;
    }
    updateSettings({ schoolName, academicYear, periodsPerDay, numberOfDays, breaks, breakAfterPeriod: settings.breakAfterPeriod ?? 3 });
    toast.success("Settings saved.");
  };

  const handleLoadSample = () => {
    loadSampleData();
    toast.success("Sample data loaded.");
  };

  const handleResetAll = () => {
    resetAllData();
    setIsResetDialogOpen(false);
    toast.success("All data cleared.");
  };

  const updateConstraint = (id: string, patch: Partial<SchedulingConstraint>) => {
    setConstraints(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...patch } : c);
      saveConstraints(updated);
      return updated;
    });
  };

  const handleSaveConstraints = () => {
    saveConstraints(constraints);
    toast.success("Constraints saved.");
  };

  return (
    <PageWrapper>
      <div className="flex-1 flex flex-col p-8 gap-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SettingsIcon className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Settings</h1>
          </div>
          <Button onClick={() => setIsHelpTourOpen(true)} variant="outline" size="sm" className="gap-1.5">
            <HelpCircle className="w-4 h-4" />
            Help
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* School Setup */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">School setup</CardTitle>
              <CardDescription>Basic information about your institution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="schoolName">School name</Label>
                <Input
                  id="schoolName"
                  placeholder="Enter school name"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="academicYear">Academic year</Label>
                <Input
                  id="academicYear"
                  placeholder="2024-2025"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="periodsPerDay">Periods per day</Label>
                  <Select value={periodsPerDay} onValueChange={setPeriodsPerDay}>
                    <SelectTrigger id="periodsPerDay"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {periodOptions.map((num) => (
                        <SelectItem key={num} value={String(num)}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="numberOfDays">Number of days</Label>
                  <Select value={numberOfDays} onValueChange={setNumberOfDays}>
                    <SelectTrigger id="numberOfDays"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {dayOptions.map((num) => (
                        <SelectItem key={num} value={String(num)}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className={`text-xs ${exceedsBackendLimit ? "text-red-600" : "text-muted-foreground"}`}>
                Backend limit: 64 total slots. Current grid: {numDays} days x {numPeriods} periods = {numDays * numPeriods}.
              </p>

              <Button onClick={handleSave} className="w-full gap-2 mt-2" size="sm">
                <Save className="w-3.5 h-3.5" />
                Save settings
              </Button>
            </CardContent>
          </Card>

          {/* Break Periods */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Break periods</CardTitle>
                  <CardDescription>Click cells to mark breaks</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-border bg-muted/50 p-2 text-xs font-medium text-muted-foreground w-14">
                        Day / P
                      </th>
                      {periods.map((period) => (
                        <th key={period} className="border border-border bg-muted/50 p-2 text-xs font-medium text-muted-foreground w-10">
                          {period}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day, dayIndex) => (
                      <tr key={dayIndex}>
                        <td className="border border-border bg-muted/30 p-2 text-xs font-medium">
                          {day}
                        </td>
                        {periods.map((_, periodIndex) => (
                          <td key={periodIndex} className="border border-border p-0">
                            <button
                              onClick={() => toggleBreak(dayIndex, periodIndex)}
                              className={`w-full h-9 transition-colors ${
                                breaksGrid[dayIndex][periodIndex]
                                  ? "bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60"
                                  : "bg-card hover:bg-muted/50"
                              }`}
                            >
                              {breaksGrid[dayIndex][periodIndex] && (
                                <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mx-auto" />
                              )}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2.5">
                Amber = break period · White = active period
              </p>
              <Button onClick={handleSave} className="w-full gap-2 mt-3" size="sm" variant="outline">
                <Save className="w-3.5 h-3.5" />
                Save breaks
              </Button>
            </CardContent>
          </Card>

          {/* Scheduling Constraints — full width */}
          <Card className="xl:col-span-2">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Scheduling constraints</CardTitle>
                    <CardDescription>Toggle constraints and tune their penalty weights (0 = ignore, 100 = strict)</CardDescription>
                  </div>
                </div>
                <Button onClick={handleSaveConstraints} size="sm" variant="outline" className="gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col divide-y divide-border">
                {constraints.map((c) => (
                  <div key={c.id} className={`py-4 first:pt-0 last:pb-0 transition-opacity ${!c.enabled ? "opacity-50" : ""}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-0.5">
                          <Switch
                            id={c.id}
                            checked={c.enabled}
                            onCheckedChange={(v) => updateConstraint(c.id, { enabled: v })}
                          />
                          <label
                            htmlFor={c.id}
                            className="text-sm font-medium cursor-pointer leading-snug"
                          >
                            {c.label}
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-[calc(2rem+10px)]">
                          {c.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0 w-40">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs text-muted-foreground">Weight</span>
                          <span className="text-xs font-medium tabular-nums">{c.weight}</span>
                        </div>
                        <Slider
                          disabled={!c.enabled}
                          value={[c.weight]}
                          min={0}
                          max={100}
                          step={5}
                          onValueChange={([v]) => updateConstraint(c.id, { weight: v })}
                          className="w-full"
                        />
                        <div className="flex justify-between w-full">
                          <span className="text-[10px] text-muted-foreground">Soft</span>
                          <span className="text-[10px] text-muted-foreground">Strict</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Data management</CardTitle>
              <CardDescription>Load sample data or reset everything</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-4 rounded-md bg-muted/40 border border-border">
                <p className="text-sm font-medium mb-1">Load sample data</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Populate the app with sample teachers, classes, subjects, and classrooms for testing.
                </p>
                <Button onClick={handleLoadSample} variant="outline" size="sm" className="gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Load sample data
                </Button>
              </div>

              <div className="p-4 rounded-md bg-destructive/5 border border-destructive/20">
                <p className="text-sm font-medium mb-1 text-destructive">Danger zone</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Permanently delete all data. This cannot be undone.
                </p>
                <Button
                  onClick={() => setIsResetDialogOpen(true)}
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset all data
                </Button>
              </div>

              <div className="p-4 rounded-md bg-muted/30 border border-border">
                <p className="text-sm font-medium mb-0.5">About</p>
                <p className="text-xs text-muted-foreground">Automatic Timetable Scheduler · v1.0.0 · Genetic Algorithm</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reset dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset all data?</DialogTitle>
            <DialogDescription>
              This will permanently delete all subjects, teachers, classes, classrooms, and reset settings to default. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleResetAll}>Reset everything</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Tour */}
      <HelpTourDialog open={isHelpTourOpen} onOpenChange={setIsHelpTourOpen} />
    </PageWrapper>
  );
}
