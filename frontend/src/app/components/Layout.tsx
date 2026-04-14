import { Outlet, Link, useLocation, useBlocker } from "react-router";
import { Toaster, toast } from "sonner";
import { BookOpen, Users, School, DoorOpen, BookMarked, Calendar, Settings, GraduationCap, Save, Sun, Moon, Archive, Layers, LogOut, Wifi, WifiOff, Sliders, AlertTriangle } from "lucide-react";
import { OnboardingDialog } from "./OnboardingDialog";
import { useStore } from "../store/useStore";
import { Button } from "./ui/button";
import { useTheme } from "../context/ThemeContext";
import { useAppContext } from "../context/AppContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export function Layout() {
  const location = useLocation();
  const { hasUnsavedChanges, saveAll, backendAvailable, markAsSaved } = useStore();
  const { isDark, toggleTheme } = useTheme();
  const { onSignOut } = useAppContext();

  // Navigation Blocker
  const blocker = useBlocker(({ nextLocation, currentLocation }) => {
    return hasUnsavedChanges && nextLocation.pathname !== currentLocation.pathname;
  });

  const navItems = [
    { icon: BookOpen,   label: "Subjects",   path: "/subjects" },
    { icon: Users,      label: "Teachers",   path: "/teachers" },
    { icon: School,     label: "Classes",    path: "/classes" },
    { icon: DoorOpen,   label: "Classrooms", path: "/classrooms" },
    { icon: BookMarked, label: "Lessons",    path: "/lessons" },
    { icon: Calendar,   label: "Timetable",  path: "/timetable" },
    { icon: Archive,    label: "Saved",      path: "/saved-timetables" },
    { icon: Layers,     label: "Groups",     path: "/groups" },
    { icon: Sliders,    label: "Constraints", path: "/constraints" },
    { icon: Settings,   label: "Settings",   path: "/settings" },
  ];
  const visibleNavItems = navItems;

  const handleSaveAll = async () => {
    try {
      await saveAll();
      toast.success(backendAvailable ? "All changes saved!" : "Saved locally.");
      if (blocker?.state === "blocked") {
        blocker.proceed();
      }
    } catch {
      toast.error("Failed to save - check your connection and try again.");
    }
  };

  const handleDiscardChanges = () => {
    markAsSaved();
    if (blocker?.state === "blocked") {
      blocker.proceed();
    }
  };

  const handleSignOut = () => {
    onSignOut();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Toaster position="bottom-right" richColors />
      <OnboardingDialog />

      {/* Sidebar */}
      <div className="w-16 flex flex-col items-center py-5 gap-1 border-r border-border bg-card shrink-0">
        <div className="mb-4 p-2 rounded-lg hover:bg-muted transition-colors">
          <GraduationCap className="w-6 h-6 text-foreground" />
        </div>

        <div className="flex-1 flex flex-col gap-0.5 w-full px-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
            return (
              <div key={item.path} className="relative group">
                <Link to={item.path} className={`w-full p-2.5 rounded-md flex items-center justify-center transition-colors ${isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  <Icon className="w-4 h-4" />
                </Link>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-foreground text-background text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-sm">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-0.5 w-full px-2 pt-2 border-t border-border">
          {/* Backend status */}
          <div className="relative group">
            <div className="w-full p-2.5 rounded-md flex items-center justify-center">
              {backendAvailable
                ? <Wifi className="w-3.5 h-3.5 text-green-500" />
                : <WifiOff className="w-3.5 h-3.5 text-muted-foreground/50" />}
            </div>
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-foreground text-background text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {backendAvailable ? "Backend connected" : "Local mode"}
            </div>
          </div>

          {/* Theme toggle */}
          <div className="relative group">
            <button onClick={toggleTheme} className="w-full p-2.5 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-foreground text-background text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {isDark ? "Light mode" : "Dark mode"}
            </div>
          </div>

          {/* Sign out */}
          <div className="relative group">
            <button onClick={handleSignOut} className="w-full p-2.5 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-foreground text-background text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Sign out
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {hasUnsavedChanges && (
          <div className="shrink-0 z-40 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-6 py-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                <span>You have unsaved changes{!backendAvailable ? " (Local Mode)" : ""}</span>
              </div>
              <Button onClick={handleSaveAll} size="sm" className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm gap-1.5 transition-all active:scale-95">
                <Save className="w-3.5 h-3.5" />
                Save All Changes
              </Button>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-auto bg-background/50">
          <Outlet />
        </div>
      </div>

      {/* Navigation Guard Dialog */}
      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent className="border-amber-200 dark:border-amber-900 shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground pt-2">
              You have unsaved changes that will be lost if you leave this page. 
              Would you like to save them now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="ghost" 
              onClick={handleDiscardChanges}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              Discard Changes
            </Button>
            <div className="flex gap-2">
              <AlertDialogCancel 
                onClick={() => blocker.reset!()}
                className="mt-0"
              >
                Stay on Page
              </AlertDialogCancel>
              <Button 
                onClick={handleSaveAll}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Save & Continue
              </Button>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
