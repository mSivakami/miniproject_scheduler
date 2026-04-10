import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Subjects } from "./pages/Subjects";
import { Teachers } from "./pages/Teachers";
import { Classes } from "./pages/Classes";
import { Classrooms } from "./pages/Classrooms";
import { Lessons } from "./pages/Lessons";
import { Timetable } from "./pages/Timetable";
import { Settings } from "./pages/Settings";
import { SavedTimetables } from "./pages/SavedTimetables";
import { Groups } from "./pages/Groups";

function LoadingUI() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    HydrateFallback: LoadingUI,
    children: [
      { index: true, Component: Dashboard },
      { path: "subjects", Component: Subjects },
      { path: "teachers", Component: Teachers },
      { path: "classes", Component: Classes },
      { path: "classrooms", Component: Classrooms },
      { path: "lessons", Component: Lessons },
      { path: "timetable", Component: Timetable },
      { path: "saved-timetables", Component: SavedTimetables },
      { path: "groups", Component: Groups },
      { path: "settings", Component: Settings },
    ],
  },
]);
