import React, { useState } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TimetableGrid({ timetableJson, institution, teachers = [], rooms = [] }) {
  const [selectedCell, setSelectedCell] = useState(null);

  if (!timetableJson) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📅</div>
        <p>No timetable data to display.</p>
      </div>
    );
  }

  // Parse timetable JSON — supports array-of-slots or nested object structure
  let slots = [];
  try {
    const data = typeof timetableJson === 'string' ? JSON.parse(timetableJson) : timetableJson;
    if (Array.isArray(data)) {
      slots = data;
    } else if (data.slots) {
      slots = data.slots;
    } else if (data.timetable) {
      slots = data.timetable;
    } else {
      // Try to flatten nested structure: { day: { period: [slot,...] } }
      Object.entries(data).forEach(([dayKey, periods]) => {
        if (typeof periods === 'object' && !Array.isArray(periods)) {
          Object.entries(periods).forEach(([periodKey, entries]) => {
            const arr = Array.isArray(entries) ? entries : [entries];
            arr.forEach(entry => {
              if (entry) slots.push({ ...entry, day: parseInt(dayKey), period: parseInt(periodKey) });
            });
          });
        }
      });
    }
  } catch (e) {
    return (
      <div className="alert error">Failed to parse timetable JSON: {e.message}</div>
    );
  }

  const days = institution?.days_per_week || 5;
  const periods = institution?.periods_per_day || 7;
  const breakAfter = institution?.break_after_period || 3;

  // Build lookup: { "day-period": [slot, ...] }
  const lookup = {};
  slots.forEach(slot => {
    const d = slot.day ?? slot.day_index ?? 0;
    const p = slot.period ?? slot.period_index ?? 0;
    const key = `${d}-${p}`;
    if (!lookup[key]) lookup[key] = [];
    lookup[key].push(slot);
  });

  const teacherMap = {};
  teachers.forEach(t => { teacherMap[t.id] = t; });
  const roomMap = {};
  rooms.forEach(r => { roomMap[r.id] = r; });

  const isBreak = (p) => p === breakAfter; // period after which break falls (1-indexed)

  // grid: cols = 1 (period label) + days, rows = 1 (header) + periods + breaks
  const colTemplate = `60px repeat(${days}, 1fr)`;

  return (
    <div>
      <div
        className="tt-grid"
        style={{ gridTemplateColumns: colTemplate }}
      >
        {/* Header row */}
        <div className="tt-header-cell">Period</div>
        {Array.from({ length: days }, (_, d) => (
          <div key={d} className="tt-header-cell">{DAY_SHORT[d] || `D${d + 1}`}</div>
        ))}

        {Array.from({ length: periods }, (_, pIdx) => {
          const p = pIdx + 1; // 1-indexed period
          const showBreak = pIdx === breakAfter - 1; // break row after this period

          return (
            <React.Fragment key={pIdx}>
              {/* Period row */}
              <div className="tt-period-label">P{p}</div>
              {Array.from({ length: days }, (_, d) => {
                const cellSlots = lookup[`${d}-${pIdx}`] || lookup[`${d + 1}-${p}`] || [];
                const slot = cellSlots[0];
                const isSelected = selectedCell === `${d}-${pIdx}`;

                return (
                  <div
                    key={d}
                    className={`tt-cell ${slot ? (slot.is_lab ? 'lab-cell' : 'filled') : 'empty'}`}
                    style={isSelected ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent-glow)' } : {}}
                    onClick={() => setSelectedCell(isSelected ? null : `${d}-${pIdx}`)}
                    title={slot ? `${slot.subject_name || slot.subject || ''} — ${slot.teacher_name || ''}` : ''}
                  >
                    {slot && (
                      <>
                        <div className="cell-subject">
                          {slot.subject_name || slot.subject || '—'}
                        </div>
                        <div className="cell-teacher">
                          {slot.teacher_short_name || slot.teacher_name || slot.teacher || ''}
                        </div>
                        {(slot.room_name || slot.room) && (
                          <div className="cell-room">{slot.room_name || slot.room}</div>
                        )}
                        {cellSlots.length > 1 && (
                          <div className="cell-teacher">+{cellSlots.length - 1} more</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {/* Break row after breakAfter */}
              {showBreak && (
                <>
                  <div className="tt-period-label" style={{ opacity: 0.4, fontSize: '0.6rem' }}>Break</div>
                  {Array.from({ length: days }, (_, d) => (
                    <div key={d} className="tt-cell break-cell">
                      <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '0.62rem', opacity: 0.6 }}>—</div>
                    </div>
                  ))}
                </>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="legend mt-2">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--accent)', opacity: 0.6 }}></div>
          Regular
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--green)', opacity: 0.6 }}></div>
          Lab
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--surface-2)' }}></div>
          Empty
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--border)' }}></div>
          Break
        </div>
      </div>
    </div>
  );
}
