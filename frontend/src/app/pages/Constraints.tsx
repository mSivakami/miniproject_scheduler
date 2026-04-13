import { useState, useEffect } from "react";
import { Sliders, Save, Info, RefreshCcw, Check, Copy } from "lucide-react";
import { PageWrapper } from "../components/PageWrapper";
import { useStore } from "../store/useStore";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Slider } from "../components/ui/slider";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";

const SOFT_CONSTRAINTS = [
  { id: "S1", name: "Teacher daily load", desc: "Penalize excess periods per day for teachers" },
  { id: "S2", name: "Difficult last period", desc: "Avoid major subjects in the final slot" },
  { id: "S3", name: "Repeat subject/day", desc: "Penalize same subject appearing twice for a class" },
  { id: "S4", name: "Class schedule gaps", desc: "Penalize free periods between active lessons" },
  { id: "S5", name: "Max consecutive", desc: "Respect max consecutive periods for teachers" },
  { id: "S6", name: "Subject distribution", desc: "Spread subjects across weekdays" },
  { id: "S7", name: "Avoid Friday Labs", desc: "Penalize lab sessions assigned to Friday" },
  { id: "S8", name: "Consec. distinct blocks", desc: "Avoid back-to-back different subject blocks" },
  { id: "S9", name: "Pack lessons early", desc: "Prefer earlier days (Mon-Thu) over Friday/Sat" },
  { id: "S10", name: "Max 1 lab/day", desc: "Ensure classes don't have multiple labs in one day" },
  { id: "S11", name: "First period empty", desc: "Penalize gaps in the first period for classes" },
  { id: "lab", name: "Avoid morning lab", desc: "Prefer labs outside the first two periods" },
];

const INTENSITY_WEIGHTS = [
    [0.3, 0.2, 0.2, 0.5, 0.2, 0.3, 0.1, 0.3, 0.2, 0.5,  0.8, 0.2], // minimal
    [1.0, 0.8, 0.7, 2.0, 0.5, 1.2, 0.3, 1.0, 0.8, 2.0,  3.0, 0.5], // medium
    [2.0, 1.5, 1.5, 4.0, 1.0, 2.5, 0.7, 2.0, 1.5, 4.0,  6.0, 1.0], // hard
    [4.0, 3.0, 3.0, 8.0, 2.0, 5.0, 1.5, 4.0, 3.0, 8.0, 12.0, 2.0], // very strict
];

const PRESETS = {
  default: { mask: "366503872447", name: "Balanced Default" },
  strict: { mask: "1099511627775", name: "Maximum Strictness" },
  hardOnly: { mask: "0", name: "Hard Constraints Only" },
};

export function Constraints() {
  const { settings, updateSettings, hasUnsavedChanges, saveAll, backendAvailable } = useStore();
  
  // Internal UI state
  const [constraintEnables, setConstraintEnables] = useState<boolean[]>(new Array(12).fill(true));
  const [constraintIntensities, setConstraintIntensities] = useState<number[]>(new Array(12).fill(1)); // 0-3
  const [mcp, setMcp] = useState(3); // Max consecutive periods
  const [ldg, setLdg] = useState(1); // Last day gap
  const [manualMaskInput, setManualMaskInput] = useState("");

  // Sync from store on mount
  useEffect(() => {
    if (settings.constraintMask) {
        decodeToState(settings.constraintMask.toString());
    }
  }, []);

  const calculateMask = () => {
    let mask = 0n;
    // Flags 0-11
    for (let i = 0; i < 12; i++) {
        if (constraintEnables[i]) mask |= (1n << BigInt(i));
    }
    // Intensities 12-35
    for (let i = 0; i < 12; i++) {
        const level = BigInt(constraintIntensities[i] & 3);
        mask |= (level << BigInt(12 + i * 2));
    }
    // Tuning 36-39
    mask |= (BigInt(mcp & 3) << 36n);
    mask |= (BigInt(ldg & 3) << 38n);
    return mask;
  };

  const decodeToState = (maskStr: string) => {
    let mask: bigint;
    try { mask = BigInt(maskStr); } catch { mask = 0n; }
    
    const enables = new Array(12).fill(false);
    for (let i = 0; i < 12; i++) {
        enables[i] = (mask & (1n << BigInt(i))) !== 0n;
    }
    setConstraintEnables(enables);

    const intensities = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
        intensities[i] = Number((mask >> BigInt(12 + i * 2)) & 3n);
    }
    setConstraintIntensities(intensities);

    setMcp(Number((mask >> 36n) & 3n));
    setLdg(Number((mask >> 38n) & 3n));
    setManualMaskInput(mask.toString());
  };

  const handleApplyMask = () => {
    if (!manualMaskInput.trim()) return;
    decodeToState(manualMaskInput);
    toast.success("Mask decoded and applied to UI");
  };

  const currentMask = calculateMask();

  const handleSaveMask = async () => {
    updateSettings({ ...settings, constraintMask: Number(currentMask) });
    toast.success("Global constraints updated in local state");
    if (backendAvailable) {
        try {
            await saveAll();
            toast.success("Constraints saved to server");
        } catch {
            toast.error("Failed to save to server");
        }
    }
  };

  return (
    <PageWrapper title="Scheduling Constraints" description="Fine-tune the genetic algorithm by setting constraint weights and priorities.">
        <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Config Area */}
            <div className="flex-1 space-y-6">
                <Card>
                    <CardHeader className="pb-3 border-b">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Soft Constraints Tuning</CardTitle>
                                <CardDescription>Adjust the intensity of non-mandatory rules.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                {Object.entries(PRESETS).map(([key, p]) => (
                                    <Button key={key} variant="outline" size="xs" onClick={() => decodeToState(p.mask)} className="text-[10px] h-7">
                                        {p.name}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y max-h-[600px] overflow-y-auto pr-1">
                            {SOFT_CONSTRAINTS.map((sc, idx) => (
                                <div key={sc.id} className={cn("p-4 flex items-center gap-6", !constraintEnables[idx] && "opacity-50 transition-opacity")}>
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-[10px] font-bold text-primary">{sc.id}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Label className="font-semibold text-sm cursor-pointer" onClick={() => {
                                                const ne = [...constraintEnables]; ne[idx] = !ne[idx]; setConstraintEnables(ne);
                                            }}>{sc.name}</Label>
                                            <Badge variant="outline" className="text-[9px] px-1 h-4 uppercase">{["Minimal", "Medium", "Hard", "Strict"][constraintIntensities[idx]]}</Badge>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground truncate">{sc.desc}</p>
                                    </div>
                                    <div className="w-32">
                                        <Slider 
                                            disabled={!constraintEnables[idx]}
                                            value={[constraintIntensities[idx]]} 
                                            max={3} step={1}
                                            onValueChange={([v]) => { const ni = [...constraintIntensities]; ni[idx] = v; setConstraintIntensities(ni); }}
                                        />
                                    </div>
                                    <Switch 
                                        checked={constraintEnables[idx]} 
                                        onCheckedChange={(v) => { const ne = [...constraintEnables]; ne[idx] = v; setConstraintEnables(ne); }} 
                                    />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2 border-b">
                        <CardTitle className="text-sm">Global Tuning Parameters</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs font-medium">S5: Max Consecutive Periods</Label>
                                <Badge variant="secondary" className="text-[10px]">{mcp}p</Badge>
                            </div>
                            <Slider value={[mcp]} min={1} max={4} step={1} onValueChange={([v]) => setMcp(v)} />
                            <p className="text-[10px] text-muted-foreground italic">Restricts teachers from taking more than {mcp} continuous slots.</p>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs font-medium">S9: Last Day Gap (Fri/Sat)</Label>
                                <Badge variant="secondary" className="text-[10px]">{ldg === 0 ? "None" : ldg === 1 ? "Normal" : "Extreme"}</Badge>
                            </div>
                            <Slider value={[ldg]} min={0} max={3} step={1} onValueChange={([v]) => setLdg(v)} />
                            <p className="text-[10px] text-muted-foreground italic">Higher values push lessons away from the end of the week.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Weights Reference */}
                <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Info className="w-4 h-4 text-primary" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Penalty Weight Reference</h4>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted hover:bg-muted">
                                <TableHead className="h-8 text-[10px]">Intensity</TableHead>
                                <TableHead className="h-8 text-[10px]">Base (S1)</TableHead>
                                <TableHead className="h-8 text-[10px]">Critical (S4)</TableHead>
                                <TableHead className="h-8 text-[10px]">Spreading (S6)</TableHead>
                                <TableHead className="h-8 text-[10px]">Friday (S7)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[0,1,2,3].map(lvl => (
                                <TableRow key={lvl} className="h-8">
                                    <TableCell className="py-1 text-[10px] font-semibold">{["Minimal", "Medium", "Hard", "Strict"][lvl]}</TableCell>
                                    <TableCell className="py-1 text-[10px]">{INTENSITY_WEIGHTS[lvl][0].toFixed(1)}</TableCell>
                                    <TableCell className="py-1 text-[10px]">{INTENSITY_WEIGHTS[lvl][3].toFixed(1)}</TableCell>
                                    <TableCell className="py-1 text-[10px] transition-colors">{INTENSITY_WEIGHTS[lvl][5].toFixed(1)}</TableCell>
                                    <TableCell className="py-1 text-[10px] text-primary font-medium">{INTENSITY_WEIGHTS[lvl][6].toFixed(1)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Sidebar Stats / Mask Display */}
            <div className="w-full lg:w-80 space-y-6">
                <Card className="bg-primary/5 border-primary/20 sticky top-6">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <RefreshCcw className="w-4 h-4" /> Mask Encoder
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-3 bg-secondary/50 rounded-lg font-mono text-center">
                            <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-tighter">BigInt Decoder (41-bit)</div>
                            <div className="text-lg font-bold text-primary break-all">{currentMask.toString()}</div>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground uppercase">Hex Representation</Label>
                                <div className="p-2 border rounded bg-background text-[11px] font-mono break-all">0x{currentMask.toString(16).toUpperCase()}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground uppercase">Binary Fragment</Label>
                                <div className="p-2 border rounded bg-background text-[11px] font-mono break-all leading-relaxed">
                                    {currentMask.toString(2).padStart(41, '0').match(/.{1,4}/g)?.join(' ')}
                                </div>
                                <div className="flex justify-between px-1 text-[8px] text-muted-foreground uppercase font-mono">
                                    <span>Tuning</span>
                                    <span>Intensities (24b)</span>
                                    <span>Flags (12b)</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <Label className="text-[10px] text-muted-foreground uppercase mb-2 block">Reverse Decode</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        value={manualMaskInput} 
                                        onChange={(e) => setManualMaskInput(e.target.value)}
                                        placeholder="Paste mask integer..." 
                                        className="h-8 text-xs font-mono"
                                    />
                                    <Button size="icon" variant="secondary" className="h-8 w-8 shrink-0" onClick={handleApplyMask}>
                                        <RefreshCcw className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button className="w-full gap-2" onClick={handleSaveMask}>
                                    <Save className="w-4 h-4" /> Save Global Config
                                </Button>
                                {hasUnsavedChanges && (
                                    <p className="text-[10px] text-amber-600 mt-2 text-center animate-pulse">You have pending changes.</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:bg-blue-950/20 dark:border-blue-900/30">
                    <div className="flex items-center gap-2 mb-2">
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Engine Ready</span>
                    </div>
                    <p className="text-[11px] text-blue-800/70 dark:text-blue-200/60 leading-relaxed">
                        The Genetic Algorithm automatically reads these weights when you click "Generate Timetable". <b>S7: Avoid Friday Labs</b> is actively penalized during fitness evaluation.
                    </p>
                </div>
            </div>
        </div>
    </PageWrapper>
  );
}
