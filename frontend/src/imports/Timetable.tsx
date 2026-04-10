import { useState } from "react";
import { Button } from "../components/ui/button";
import { Calendar, Wand2, RotateCcw, Download, Settings, CheckCircle2, AlertCircle, Zap, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Slider } from "../components/ui/slider";
import { PageWrapper } from "../components/PageWrapper";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export function Timetable() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isGASettingsOpen, setIsGASettingsOpen] = useState(false);
  const [gaSettings, setGASettings] = useState({
    populationSize: 100,
    generations: 500,
    mutationRate: 0.01,
    crossoverRate: 0.8,
  });

  const periods = ["08:00-09:00", "09:00-10:00", "10:00-11:00", "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00"];

  const timetableData = [
    { teacher: "AI", color: "#6366f1", periods: [
      { subject: "BSCS", color: "#ef4444" },
      { subject: "", color: "" },
      { subject: "BSCS F19", color: "#10b981" },
      { subject: "", color: "" },
      { subject: "BSCS", color: "#ef4444" },
      { subject: "", color: "" },
      { subject: "BSCS", color: "#10b981" },
    ]},
    { teacher: "US", color: "#3b82f6", periods: [
      { subject: "", color: "" },
      { subject: "BSCS", color: "#3b82f6" },
      { subject: "", color: "" },
      { subject: "BScIT", color: "#3b82f6" },
      { subject: "", color: "" },
      { subject: "BScIT", color: "#3b82f6" },
      { subject: "", color: "" },
    ]},
    { teacher: "UK", color: "#8b5cf6", periods: [
      { subject: "", color: "" },
      { subject: "", color: "" },
      { subject: "BSCS F19", color: "#eab308" },
      { subject: "", color: "" },
      { subject: "", color: "" },
      { subject: "", color: "" },
      { subject: "", color: "" },
    ]},
    { teacher: "Hr", color: "#f59e0b", periods: [
      { subject: "", color: "" },
      { subject: "", color: "" },
      { subject: "", color: "" },
      { subject: "BScIT F19", color: "#eab308" },
      { subject: "", color: "" },
      { subject: "BScIT F19", color: "#eab308" },
      { subject: "BSCS F19", color: "#eab308" },
    ]},
    { teacher: "MA", color: "#10b981", periods: [
      { subject: "BSCS BScIT F19", color: "#eab308" },
      { subject: "", color: "" },
      { subject: "", color: "" },
      { subject: "", color: "" },
      { subject: "", color: "" },
      { subject: "", color: "" },
      { subject: "", color: "" },
    ]},
    { teacher: "UZ", color: "#ef4444", periods: [
      { subject: "BScIT", color: "#ef4444" },
      { subject: "BScIT", color: "#ef4444" },
      { subject: "", color: "" },
      { subject: "", color: "" },
      { subject: "", color: "" },
      { subject: "BScIT", color: "#ef4444" },
      { subject: "BScIT", color: "#ef4444" },
    ]},
  ];

  const stats = [
    { label: "Fitness Score", value: "95.5%", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
    { label: "Conflicts", value: "0", icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Generation", value: "247", icon: Zap, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Time Taken", value: "2.3s", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  const handleGenerate = () => {
    setIsGenerating(true);
    setIsGenerated(false);
    toast.loading("Generating timetable...", { id: "generate" });
    setTimeout(() => {
      setIsGenerating(false);
      setIsGenerated(true);
      toast.success("Timetable generated successfully!", { id: "generate" });
    }, 2000);
  };

  const handleReset = () => {
    setIsGenerated(false);
    toast.info("Timetable reset.");
  };

  return (
    <PageWrapper>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/80 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-800">Timetable</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsGASettingsOpen(true)}
              className="active:scale-95 transition-transform duration-100">
              <Settings className="w-4 h-4 mr-2" />
              GA Settings
            </Button>
            <Button variant="outline" disabled={!isGenerated}
              className="active:scale-95 transition-transform duration-100"
              onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button variant="outline" disabled={!isGenerated}
              className="active:scale-95 transition-transform duration-100">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating}
              className="active:scale-95 transition-transform duration-100">
              <Wand2 className="w-4 h-4 mr-2" />
              {isGenerating ? "Generating..." : "Generate Timetable"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          {/* Empty state */}
          {!isGenerated && !isGenerating && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center h-full text-gray-500"
            >
              <div className="p-6 bg-gray-100 rounded-full mb-6">
                <Calendar className="w-14 h-14 text-gray-300" />
              </div>
              <p className="text-lg font-semibold text-gray-700 mb-2">No timetable generated yet</p>
              <p className="text-sm text-gray-400 mb-8">Click "Generate Timetable" to create a schedule using genetic algorithm</p>
              <Button onClick={handleGenerate} className="active:scale-95 transition-transform duration-100">
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Timetable
              </Button>
            </motion.div>
          )}

          {/* Generating state */}
          {isGenerating && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center h-full gap-6"
            >
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-100 rounded-full" />
                <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
                <Wand2 className="w-8 h-8 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-700">Running Genetic Algorithm...</p>
                <p className="text-sm text-gray-400 mt-1">Optimizing schedule across {gaSettings.generations} generations</p>
              </div>
              {/* Animated progress bar */}
              <div className="w-64 h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          )}

          {/* Generated timetable */}
          {isGenerated && (
            <motion.div
              key="timetable"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
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
                      transition={{ delay: i * 0.07 }}
                    >
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${stat.bg}`}>
                          <Icon className={`w-5 h-5 ${stat.color}`} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">{stat.label}</p>
                          <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Timetable grid */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="bg-gray-50 border-b border-r border-gray-100 p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[80px]">
                          Teacher
                        </th>
                        {periods.map((period, i) => (
                          <th key={i} className="bg-gray-50 border-b border-r border-gray-100 p-3 text-center min-w-[120px]">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Period {i + 1}</p>
                            <p className="text-xs text-gray-400 font-normal mt-0.5">{period}</p>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timetableData.map((row, rowIndex) => (
                        <motion.tr
                          key={rowIndex}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: rowIndex * 0.05 }}
                          className="hover:bg-gray-50/50 transition-colors"
                        >
                          {/* Teacher cell */}
                          <td className="border-b border-r border-gray-100 p-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: row.color }}
                              />
                              <span className="font-semibold text-gray-700 text-sm">{row.teacher}</span>
                            </div>
                          </td>
                          {/* Period cells */}
                          {row.periods.map((cell, cellIndex) => (
                            <td key={cellIndex} className="border-b border-r border-gray-100 p-1.5 text-center">
                              {cell.subject ? (
                                <div
                                  className="px-2 py-1.5 rounded-lg text-white text-xs font-medium shadow-sm"
                                  style={{ backgroundColor: cell.color }}
                                >
                                  {cell.subject}
                                </div>
                              ) : (
                                <div className="px-2 py-1.5 rounded-lg text-gray-200 text-xs">
                                  —
                                </div>
                              )}
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* GA Settings Dialog */}
      <Dialog open={isGASettingsOpen} onOpenChange={setIsGASettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Genetic Algorithm Settings</DialogTitle>
            <DialogDescription>Configure the genetic algorithm parameters to generate the timetable.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="populationSize">Population Size</Label>
                <span className="text-sm font-medium text-blue-600">{gaSettings.populationSize}</span>
              </div>
              <Slider id="populationSize" min={50} max={500} step={10}
                value={[gaSettings.populationSize]}
                onValueChange={([value]) => setGASettings({ ...gaSettings, populationSize: value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="generations">Max Generations</Label>
                <span className="text-sm font-medium text-blue-600">{gaSettings.generations}</span>
              </div>
              <Slider id="generations" min={100} max={2000} step={50}
                value={[gaSettings.generations]}
                onValueChange={([value]) => setGASettings({ ...gaSettings, generations: value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="mutationRate">Mutation Rate</Label>
                <span className="text-sm font-medium text-blue-600">{gaSettings.mutationRate}</span>
              </div>
              <Slider id="mutationRate" min={0.001} max={0.1} step={0.001}
                value={[gaSettings.mutationRate]}
                onValueChange={([value]) => setGASettings({ ...gaSettings, mutationRate: value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="crossoverRate">Crossover Rate</Label>
                <span className="text-sm font-medium text-blue-600">{gaSettings.crossoverRate}</span>
              </div>
              <Slider id="crossoverRate" min={0.5} max={1} step={0.05}
                value={[gaSettings.crossoverRate]}
                onValueChange={([value]) => setGASettings({ ...gaSettings, crossoverRate: value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGASettingsOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              setIsGASettingsOpen(false);
              toast.success("GA settings saved!");
            }}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}