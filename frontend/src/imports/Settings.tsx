import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Settings as SettingsIcon, Save } from "lucide-react";
import { PageWrapper } from "../components/PageWrapper";
import { toast } from "sonner";

const STORAGE_KEY = "app-settings";

const defaultSettings = {
  schoolName: "",
  academicYear: "2024-2025",
  periodsPerDay: "7",
  numberOfDays: "5",
  weekend: "saturday-sunday",
};

export function Settings() {
  const [schoolName, setSchoolName] = useState(defaultSettings.schoolName);
  const [academicYear, setAcademicYear] = useState(defaultSettings.academicYear);
  const [periodsPerDay, setPeriodsPerDay] = useState(defaultSettings.periodsPerDay);
  const [numberOfDays, setNumberOfDays] = useState(defaultSettings.numberOfDays);
  const [weekend, setWeekend] = useState(defaultSettings.weekend);

  // Load saved settings on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setSchoolName(parsed.schoolName ?? defaultSettings.schoolName);
      setAcademicYear(parsed.academicYear ?? defaultSettings.academicYear);
      setPeriodsPerDay(parsed.periodsPerDay ?? defaultSettings.periodsPerDay);
      setNumberOfDays(parsed.numberOfDays ?? defaultSettings.numberOfDays);
      setWeekend(parsed.weekend ?? defaultSettings.weekend);
    }
  }, []);

  const handleSave = () => {
    const settings = { schoolName, academicYear, periodsPerDay, numberOfDays, weekend };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    toast.success("Settings saved successfully!");
  };

  return (
    <PageWrapper>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/80 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl">Settings</h1>
          </div>
          <Button onClick={handleSave}
            className="active:scale-95 transition-transform duration-100">
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>School Information</CardTitle>
              <CardDescription>Basic information about your institution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="schoolName">Name of the school</Label>
                <Input
                  id="schoolName"
                  placeholder="Enter school name"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="academicYear">Academic year</Label>
                <Input
                  id="academicYear"
                  placeholder="2024-2025"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule Configuration</CardTitle>
              <CardDescription>Configure your timetable structure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="periodsPerDay">Periods per day</Label>
                  <Select value={periodsPerDay} onValueChange={setPeriodsPerDay}>
                    <SelectTrigger id="periodsPerDay">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 6, 7, 8, 9, 10].map((num) => (
                        <SelectItem key={num} value={String(num)}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numberOfDays">Number of days</Label>
                  <Select value={numberOfDays} onValueChange={setNumberOfDays}>
                    <SelectTrigger id="numberOfDays">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 6, 7].map((num) => (
                        <SelectItem key={num} value={String(num)}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekend">Weekend</Label>
                <Select value={weekend} onValueChange={setWeekend}>
                  <SelectTrigger id="weekend">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saturday-sunday">Saturday - Sunday</SelectItem>
                    <SelectItem value="friday-saturday">Friday - Saturday</SelectItem>
                    <SelectItem value="sunday">Sunday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}