import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '../store/dataStore';
import { useMiniGroupStore } from '../store/miniGroupStore';
import { useTimetableStore } from '../store/timetableStore';

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card" style={accent ? { borderColor: `rgba(${accent},0.3)` } : {}}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function QuickLink({ to, label, desc, color = 'var(--accent)' }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className="item-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div className="item-name" style={{ color }}>{label}</div>
        <div className="item-meta">{desc}</div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { fetchData, institution, teachers, subjects, rooms, classrooms, lessonBlocks, loading } = useDataStore();
  const { fetchGroups, groups } = useMiniGroupStore();
  const { fetchTimetables, timetables } = useTimetableStore();

  useEffect(() => {
    fetchData();
    fetchGroups();
    fetchTimetables();
  }, []);

  const inst = institution;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{inst?.name || 'Dashboard'}</h1>
          <p className="page-subtitle">
            {inst
              ? `${inst.days_per_week} days/week · ${inst.periods_per_day} periods/day · break after P${inst.break_after_period}`
              : 'Loading institution…'}
          </p>
        </div>
        <Link to="/generate">
          <button className="btn btn-primary btn-lg">⚡ Generate Timetable</button>
        </Link>
      </div>

      {loading && !inst && (
        <div className="loader-overlay">
          <div className="spinner" style={{ width: 28, height: 28 }}></div>
          <span>Loading data…</span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid-4 section">
        <StatCard label="Teachers" value={teachers.length} sub="configured" />
        <StatCard label="Classrooms" value={classrooms.length} sub="student sections" />
        <StatCard label="Subjects" value={subjects.length} sub={`${subjects.filter(s => s.is_lab).length} labs`} />
        <StatCard label="Rooms" value={rooms.length} sub={`${rooms.filter(r => r.is_lab).length} lab rooms`} />
      </div>

      <div className="grid-4 section">
        <StatCard label="Lesson Blocks" value={lessonBlocks.length} sub="main schedule" />
        <StatCard label="Mini Groups" value={groups.length} sub="max 2 allowed" />
        <StatCard label="Saved Timetables" value={timetables.length} sub="max 5 allowed" />
        <StatCard
          label="Schedule Grid"
          value={inst ? `${inst.days_per_week}×${inst.periods_per_day}` : '—'}
          sub="days × periods"
        />
      </div>

      {/* Quick access */}
      <div className="section">
        <div className="card-title mb-1">Quick Access</div>
        <div className="grid-3">
          <QuickLink to="/teachers"     label="👤 Teachers"      desc="Manage teacher availability & limits" />
          <QuickLink to="/classrooms"   label="🏫 Classrooms"    desc="Student sections / classes" />
          <QuickLink to="/subjects"     label="📚 Subjects"      desc="Subjects, labs & priorities" />
          <QuickLink to="/rooms"        label="🏢 Rooms"         desc="Physical rooms & labs" />
          <QuickLink to="/lesson-blocks" label="🧩 Lesson Blocks" desc="Configure schedulable events" />
          <QuickLink to="/mini-groups"  label="🔀 Mini Groups"   desc="Alternate timetable slots" color="var(--purple)" />
          <QuickLink to="/generate"     label="⚡ Generate"      desc="Run GA timetable engine" color="var(--yellow)" />
          <QuickLink to="/timetables"   label="📅 Timetables"    desc="View & manage saved schedules" color="var(--green)" />
          <QuickLink to="/settings"     label="⚙️ Settings"      desc="Institution schedule config" color="var(--cyan)" />
        </div>
      </div>

      {/* Mini groups summary */}
      {groups.length > 0 && (
        <div className="section">
          <div className="card-title mb-1">Mini Groups</div>
          <div className="grid-2">
            {groups.map(g => (
              <div key={g.id} className="card" style={{ padding: '1.25rem' }}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontWeight: 600 }}>{g.name}</span>
                  <span className="badge purple">Slot {g.slot_index}</span>
                </div>
                <div className="text-xs text-muted mono">
                  {g.days_per_week}d · {g.periods_per_day}p · break after P{g.break_after_period}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent timetables */}
      {timetables.length > 0 && (
        <div className="section">
          <div className="card-title mb-1">Recent Timetables</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Fitness</th>
                  <th>Hard Violations</th>
                  <th>Soft Violations</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {timetables.slice(0, 5).map(tt => (
                  <tr key={tt.id}>
                    <td style={{ fontWeight: 500 }}>{tt.name}</td>
                    <td><span className="badge green">{tt.fitness_score?.toFixed?.(3) ?? tt.fitness_score ?? '—'}</span></td>
                    <td>
                      <span className={`badge ${tt.hard_violations === 0 ? 'green' : 'red'}`}>
                        {tt.hard_violations ?? '—'}
                      </span>
                    </td>
                    <td><span className="badge yellow">{tt.soft_violations ?? '—'}</span></td>
                    <td className="text-muted mono" style={{ fontSize: '0.72rem' }}>
                      {new Date(tt.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link to={`/timetables/${tt.id}`}>
                        <button className="btn btn-ghost btn-sm">View</button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
