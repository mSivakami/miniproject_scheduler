import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Building2, Calendar, BookOpen, Users, School, DoorOpen } from "lucide-react";
import { motion } from "motion/react";

const stats = [
  { icon: BookOpen, label: "Subjects", value: "0", color: "bg-blue-50 text-blue-600" },
  { icon: Users, label: "Teachers", value: "0", color: "bg-emerald-50 text-emerald-600" },
  { icon: School, label: "Classes", value: "0", color: "bg-violet-50 text-violet-600" },
  { icon: DoorOpen, label: "Classrooms", value: "0", color: "bg-amber-50 text-amber-600" },
];

export function Dashboard() {
  const navigate = useNavigate();
  const [schoolName, setSchoolName] = useState("");
  const [academicYear, setAcademicYear] = useState("2024-2025");
  const [periodsPerDay, setPeriodsPerDay] = useState("7");
  const [numberOfDays, setNumberOfDays] = useState("5");
  const [weekend, setWeekend] = useState("saturday-sunday");

  return (
    <motion.div
      className="flex-1 flex flex-col p-8 gap-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.25 }}
            >
              <Card className="hover:shadow-md transition-shadow duration-200">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className={`p-3 rounded-xl ${stat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-800">{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Setup card */}
      <Card className="w-full max-w-2xl mx-auto shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold">Automatic Timetable Scheduler</CardTitle>
              <CardDescription>Using Genetic Algorithm</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <Calendar className="w-12 h-12 text-blue-500 shrink-0" />
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="periodsPerDay">Periods per day</Label>
                  <Select value={periodsPerDay} onValueChange={setPeriodsPerDay}>
                    <SelectTrigger id="periodsPerDay"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5, 6, 7, 8, 9, 10].map((num) => (
                        <SelectItem key={num} value={String(num)}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numberOfDays">Number of days</Label>
                  <Select value={numberOfDays} onValueChange={setNumberOfDays}>
                    <SelectTrigger id="numberOfDays"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5, 6, 7].map((num) => (
                        <SelectItem key={num} value={String(num)}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekend">Weekend</Label>
                <Select value={weekend} onValueChange={setWeekend}>
                  <SelectTrigger id="weekend"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saturday-sunday">Saturday - Sunday</SelectItem>
                    <SelectItem value="friday-saturday">Friday - Saturday</SelectItem>
                    <SelectItem value="sunday">Sunday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" className="active:scale-95 transition-transform duration-100">Previous</Button>
            <Button onClick={() => navigate("/subjects")} className="active:scale-95 transition-transform duration-100">Next</Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}