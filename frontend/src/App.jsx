import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Sidebar from './components/Sidebar';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TeachersPage from './pages/TeachersPage';
import ClassroomsPage from './pages/ClassroomsPage';
import SubjectsPage from './pages/SubjectsPage';
import RoomsPage from './pages/RoomsPage';
import LessonBlocksPage from './pages/LessonBlocksPage';
import MiniGroupsPage from './pages/MiniGroupsPage';
import GeneratePage from './pages/GeneratePage';
import { TimetablesListPage, TimetableViewPage } from './pages/TimetablesPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedLayout() {
  const { token, user, health, checkHealth, fetchMe } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkHealth();
    if (token && !user) {
      fetchMe().then(u => {
        if (!u) navigate('/login', { replace: true });
      });
    } else if (!token) {
      navigate('/login', { replace: true });
    }
  }, [token]);

  if (!token) return null;

  return (
    <div className="layout">
      <Sidebar health={health} />
      <main className="main-content">
        <Routes>
          <Route path="/dashboard"    element={<DashboardPage />} />
          <Route path="/teachers"     element={<TeachersPage />} />
          <Route path="/classrooms"   element={<ClassroomsPage />} />
          <Route path="/subjects"     element={<SubjectsPage />} />
          <Route path="/rooms"        element={<RoomsPage />} />
          <Route path="/lesson-blocks" element={<LessonBlocksPage />} />
          <Route path="/mini-groups"  element={<MiniGroupsPage />} />
          <Route path="/generate"     element={<GeneratePage />} />
          <Route path="/timetables"   element={<TimetablesListPage />} />
          <Route path="/timetables/:id" element={<TimetableViewPage />} />
          <Route path="/settings"     element={<SettingsPage />} />
          <Route path="*"             element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*"     element={<ProtectedLayout />} />
    </Routes>
  );
}
