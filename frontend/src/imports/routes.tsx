import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Subjects } from "./pages/Subjects";
import { Teachers } from "./pages/Teachers";
import { Classes } from "./pages/Classes";
import { Classrooms } from "./pages/Classrooms";
import { Timetable } from "./pages/Timetable";
import { Settings } from "./pages/Settings";

function LoadingUI() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading...</p>
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
      { path: "timetable", Component: Timetable },
      { path: "settings", Component: Settings },
    ],
  },
]);