import { Outlet, Link, useLocation } from "react-router";
import { Toaster } from "sonner";
import { BookOpen, Users, School, DoorOpen, Calendar, Settings, GraduationCap } from "lucide-react";

export function Layout() {
  const location = useLocation();

  const navItems = [
    { icon: BookOpen, label: "Subjects", path: "/subjects" },
    { icon: Users, label: "Teachers", path: "/teachers" },
    { icon: School, label: "Classes", path: "/classes" },
    { icon: DoorOpen, label: "Classrooms", path: "/classrooms" },
    { icon: Calendar, label: "Timetable", path: "/timetable" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <Toaster position="bottom-right" richColors />
      {/* Sidebar */}
      <div className="w-20 flex flex-col items-center py-6 gap-6"
        style={{ background: "linear-gradient(180deg, #1e40af 0%, #2563eb 40%, #3b82f6 100%)" }}
      >
        {/* Logo */}
        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
          <GraduationCap className="w-8 h-8 text-white" />
        </div>

        <div className="flex-1 flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <div key={item.path} className="relative group">
                <Link
                  to={item.path}
                  className={`p-3 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 ${
                    isActive
                      ? "bg-white text-blue-600 shadow-md"
                      : "text-white/70 hover:bg-white/20 hover:text-white"
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </Link>
                {/* Tooltip */}
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-auto dot-grid">
        <Outlet />
      </div>
    </div>
  );
}