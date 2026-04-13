import { Outlet, Link, useLocation } from "react-router";
import { Toaster, toast } from "sonner";
import { BookOpen, Users, School, DoorOpen, BookMarked, Calendar, Settings, GraduationCap, Save, Sun, Moon, Archive, Layers, LogOut, Wifi, WifiOff, Sliders } from "lucide-react";
import { OnboardingDialog } from "./OnboardingDialog";
import { useStore } from "../store/useStore";
import { Button } from "./ui/button";
import { useTheme } from "../context/ThemeContext";
import { useAppContext } from "../context/AppContext";

export function Layout() {
  const location = useLocation();
  const { hasUnsavedChanges, saveAll, backendAvailable } = useStore();
  const { isDark, toggleTheme } = useTheme();
  const { onSignOut } = useAppContext();

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
    } catch {
      toast.error("Failed to save - check your connection and try again.");
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
      <div className="flex-1 flex flex-col overflow-auto">
        {hasUnsavedChanges && (
          <div className="shrink-0 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-6 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                <span>Unsaved changes{!backendAvailable ? " - local mode" : ""}</span>
              </div>
              <Button onClick={handleSaveAll} size="sm" variant="outline" className="h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 gap-1.5">
                <Save className="w-3 h-3" />
                Save all
              </Button>
            </div>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}
