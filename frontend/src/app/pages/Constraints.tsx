import { useState, useEffect } from "react";
import { Sliders, Save, Info, RefreshCcw, Check, Copy, ClipboardPaste } from "lucide-react";
import { PageWrapper } from "../components/PageWrapper";
import { useStore } from "../store/useStore";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Slider } from "../components/ui/slider";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";

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

export function Constraints() {
  const { settings, updateSettings, hasUnsavedChanges, saveAll, backendAvailable } = useStore();
  
  // Internal UI state for the 12 constraints
  const [constraintEnables, setConstraintEnables] = useState<boolean[]>(new Array(12).fill(true));
  const [constraintIntensities, setConstraintIntensities] = useState<number[]>(new Array(12).fill(1)); // 0-3 (Minimal, Medium, Hard, Strict)
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
    // Hardcoded Tuning bits 36-39: Default mcp=1 (3 periods), ldg=1 (1 day gap)
    mask |= (1n << 36n); // mcp bit 36 set
    mask |= (1n << 38n); // ldg bit 38 set
    return mask;
  };

  const decodeToState = (maskStr: string) => {
    let mask: bigint;
    try { 
        mask = BigInt(maskStr); 
    } catch { 
        console.warn("Invalid mask pasted:", maskStr);
        return false; 
    }
    
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
    return true;
  };

  const handleApplyMask = () => {
    if (!manualMaskInput.trim()) return;
    if (decodeToState(manualMaskInput)) {
        toast.success("Mask Digit applied to constraints list");
    } else {
        toast.error("Invalid mask format. Please provide a valid integer.");
    }
  };

  const currentMask = calculateMask();

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMask.toString());
    toast.success("Mask Digit copied to clipboard");
  };

  const handleSaveMask = async () => {
    updateSettings({ ...settings, constraintMask: Number(currentMask) });
    if (backendAvailable) {
        try {
            await saveAll();
            toast.success("Constraints saved to server successfully");
        } catch {
            toast.error("Failed to sync constraints with server");
        }
    } else {
        toast.info("Constraints saved locally (Server offline)");
    }
  };

  return (
    <PageWrapper>
        <div className="flex-1 flex flex-col p-8 gap-6 max-w-7xl mx-auto w-full">
            <div className="flex flex-col gap-1 mb-2">
                <h1 className="text-2xl font-bold tracking-tight">Scheduling Constraints</h1>
                <p className="text-sm text-muted-foreground italic">Configure evolutionary weights and share constraint masks with other users.</p>
            </div>
            <div className="flex flex-col xl:flex-row gap-8">
            {/* Left Column: Constraints List */}
            <div className="flex-1 space-y-6">
                <Card className="border-primary/10 shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Soft Constraints Configuration</CardTitle>
                                <CardDescription className="text-xs">Enable/Disable specific rules and set their penalty intensity.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {SOFT_CONSTRAINTS.map((sc, idx) => (
                                <div key={sc.id} className={cn("p-4 flex items-center gap-6 transition-all", !constraintEnables[idx] && "opacity-40 grayscale-[0.5]")}>
                                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/5">
                                        <span className="text-[11px] font-bold text-primary uppercase">{sc.id}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <Label className="font-semibold text-[13px] cursor-pointer hover:text-primary transition-colors" onClick={() => {
                                                const ne = [...constraintEnables]; ne[idx] = !ne[idx]; setConstraintEnables(ne);
                                            }}>{sc.name}</Label>
                                            <Badge variant={constraintIntensities[idx] > 1 ? "default" : "secondary"} className="text-[9px] px-1.5 h-4 uppercase tracking-tighter">
                                                {["Minimal", "Medium", "Hard", "Strict"][constraintIntensities[idx]]}
                                            </Badge>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground truncate leading-relaxed">{sc.desc}</p>
                                    </div>
                                    <div className="w-36 flex items-center gap-3">
                                        <Slider 
                                            disabled={!constraintEnables[idx]}
                                            value={[constraintIntensities[idx]]} 
                                            max={3} step={1}
                                            onValueChange={([v]) => { const ni = [...constraintIntensities]; ni[idx] = v; setConstraintIntensities(ni); }}
                                            className="cursor-pointer"
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
            </div>

            {/* Right Column: Mask Management */}
            <div className="w-full xl:w-[400px] space-y-6">
                <Card className="bg-primary/5 border-primary/20 sticky top-6 shadow-md shadow-primary/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <RefreshCcw className="w-4 h-4 text-primary" /> Shareable Constraint Mask
                        </CardTitle>
                        <CardDescription className="text-xs">Share this digit to replicate these settings on other machines.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="relative group p-4 bg-background border-2 border-primary/10 rounded-xl font-mono text-center transition-all hover:border-primary/30">
                            <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-widest font-bold opacity-60">Your Multi-Constraint Digit</div>
                            <div className="text-2xl font-black text-primary break-all tracking-tighter leading-none select-all">{currentMask.toString()}</div>
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                className="absolute -top-3 -right-3 rounded-full w-10 h-10 shadow-lg border-2 border-background" 
                                onClick={handleCopy}
                            >
                                <Copy className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div className="pt-4 border-t border-primary/10">
                                <Label className="text-[11px] font-bold text-muted-foreground uppercase mb-3 block">Import External Mask</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <ClipboardPaste className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground opacity-50" />
                                        <Input 
                                            value={manualMaskInput} 
                                            onChange={(e) => setManualMaskInput(e.target.value)}
                                            placeholder="Paste Digit Here..." 
                                            className="h-10 pl-9 text-[13px] font-mono border-muted bg-background/50 focus:bg-background transition-all"
                                        />
                                    </div>
                                    <Button variant="outline" className="h-10 px-4 gap-2 font-medium" onClick={handleApplyMask}>
                                        Apply
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2 italic">Paste an 11+ digit integer from another user to sync immediately.</p>
                            </div>

                            <div className="pt-6 border-t border-primary/10 flex flex-col gap-3">
                                <Button 
                                    className="w-full h-11 gap-2.5 text-sm font-bold shadow-lg shadow-primary/20" 
                                    onClick={handleSaveMask}
                                >
                                    <Save className="w-5 h-5" /> Save All Constraints
                                </Button>
                               
                                {hasUnsavedChanges && (
                                    <div className="flex items-center justify-center gap-2 py-1 px-3 bg-amber-500/10 rounded-full w-max mx-auto border border-amber-500/20">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        <span className="text-[10px] text-amber-600 font-bold uppercase">Pending Changes</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 dark:bg-blue-950/20 dark:border-blue-900/30">
                    <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/50">
                            <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Synchronization Ready</span>
                    </div>
                    <p className="text-[11px] text-blue-800/70 dark:text-blue-200/60 leading-relaxed font-medium">
                        Encoded masks include your penalty levels for all 12 constraints. When shared, they ensure identical Timetable generation results across different user accounts.
                    </p>
                </div>
            </div>
            </div>
        </div>
    </PageWrapper>
  );
}
