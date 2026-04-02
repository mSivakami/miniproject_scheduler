# ChromaSchedule — Frontend Architecture & Implementation Guide
## React + Vite + Zustand + TailwindCSS

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Routing & Page Map](#2-routing--page-map)
3. [Zustand Store Design](#3-zustand-store-design)
4. [API Client Layer](#4-api-client-layer)
5. [Core Page Implementations](#5-core-page-implementations)
6. [Availability Grid Component](#6-availability-grid-component)
7. [Lesson Block Builder Component](#7-lesson-block-builder-component)
8. [Constraint Settings Panel](#8-constraint-settings-panel)
9. [Generation & Polling Flow](#9-generation--polling-flow)
10. [Timetable Display Component](#10-timetable-display-component)
11. [Drag-Drop Swap Editor](#11-drag-drop-swap-editor)
12. [PDF Export](#12-pdf-export)

---

## 1. Project Structure

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── api/
│   │   ├── client.ts          # axios instance with JWT interceptor
│   │   ├── auth.ts
│   │   ├── institution.ts
│   │   ├── teachers.ts
│   │   ├── rooms.ts
│   │   ├── subjects.ts
│   │   ├── classrooms.ts
│   │   ├── lessonBlocks.ts
│   │   ├── constraints.ts
│   │   ├── generate.ts
│   │   ├── timetables.ts
│   │   └── miniGroups.ts
│   │
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── institutionStore.ts
│   │   ├── teacherStore.ts
│   │   ├── roomStore.ts
│   │   ├── subjectStore.ts
│   │   ├── classroomStore.ts
│   │   ├── lessonBlockStore.ts
│   │   ├── constraintStore.ts
│   │   ├── generateStore.ts
│   │   ├── timetableStore.ts
│   │   └── miniGroupStore.ts
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── SetupPage.tsx          # first-run wizard
│   │   ├── DashboardPage.tsx
│   │   ├── InstitutionPage.tsx
│   │   ├── TeachersPage.tsx
│   │   ├── RoomsPage.tsx
│   │   ├── SubjectsPage.tsx
│   │   ├── ClassroomsPage.tsx
│   │   ├── LessonBlocksPage.tsx
│   │   ├── ConstraintsPage.tsx
│   │   ├── GeneratePage.tsx
│   │   ├── TimetablePage.tsx
│   │   ├── SavedTimetablesPage.tsx
│   │   ├── DragDropPage.tsx
│   │   └── MiniGroupPage.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── shared/
│   │   │   ├── SaveAllButton.tsx
│   │   │   ├── DirtyBadge.tsx
│   │   │   └── ConfirmDialog.tsx
│   │   ├── institution/
│   │   │   ├── BreakPositionGrid.tsx
│   │   ├── data-entry/
│   │   │   ├── AvailabilityGrid.tsx
│   │   │   ├── EntityForm.tsx
│   │   │   └── EntityList.tsx
│   │   ├── lesson-blocks/
│   │   │   ├── LessonBlockForm.tsx
│   │   │   ├── LessonBlockList.tsx
│   │   │   └── MultiSelect.tsx
│   │   ├── constraints/
│   │   │   ├── ConstraintToggle.tsx
│   │   │   ├── WeightSlider.tsx
│   │   │   └── ConstraintPanel.tsx
│   │   ├── generate/
│   │   │   ├── PreflightResults.tsx
│   │   │   ├── GenerationProgress.tsx
│   │   │   └── GenerateButton.tsx
│   │   ├── timetable/
│   │   │   ├── TimetableGrid.tsx
│   │   │   ├── ClassView.tsx
│   │   │   ├── TeacherView.tsx
│   │   │   ├── RoomView.tsx
│   │   │   └── TimetableCell.tsx
│   │   └── drag-drop/
│   │       ├── DraggableCell.tsx
│   │       └── SwapConfirmDialog.tsx
│   │
│   ├── hooks/
│   │   ├── usePolling.ts
│   │   ├── useDirtyState.ts
│   │   └── useBreakMask.ts
│   │
│   └── utils/
│       ├── bitmask.ts
│       ├── timetable.ts
│       └── pdf.ts
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 2. Routing & Page Map

```typescript
// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'

function App() {
  const { token, isFirstRun } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        {/* First-run setup */}
        <Route path="/setup" element={<SetupPage />} />

        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected app */}
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard"      element={<DashboardPage />} />
          <Route path="institution"    element={<InstitutionPage />} />
          <Route path="teachers"       element={<TeachersPage />} />
          <Route path="classrooms"     element={<ClassroomsPage />} />
          <Route path="subjects"       element={<SubjectsPage />} />
          <Route path="rooms"          element={<RoomsPage />} />
          <Route path="lessons"        element={<LessonBlocksPage />} />
          <Route path="constraints"    element={<ConstraintsPage />} />
          <Route path="generate"       element={<GeneratePage />} />
          <Route path="timetable"      element={<TimetablePage />} />
          <Route path="saved"          element={<SavedTimetablesPage />} />
          <Route path="editor/:id"     element={<DragDropPage />} />
          <Route path="mini-groups"    element={<MiniGroupPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

### Sidebar Navigation Order
```
Dashboard
─── Data Entry ───
  Institution
  Teachers
  Classrooms
  Subjects
  Rooms
  Lesson Blocks
─── Generate ───
  Constraints
  Main Timetable
  Mini-Groups
─── Results ───
  Current Result
  Saved (5)
  Editor
```

---

## 3. Zustand Store Design

### Auth Store
```typescript
// stores/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  user: { id: string; username: string; institution_id: string } | null
  isFirstRun: boolean
  setToken: (token: string) => void
  setUser: (user: any) => void
  setFirstRun: (v: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isFirstRun: false,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      setFirstRun: (isFirstRun) => set({ isFirstRun }),
      logout: () => set({ token: null, user: null })
    }),
    { name: 'auth-storage' }
  )
)
```

### Generic Entity Store Pattern
All entity stores (teachers, rooms, subjects, classrooms) follow this pattern:

```typescript
// stores/teacherStore.ts
import { create } from 'zustand'

interface Teacher {
  id: string
  name: string
  available_mask: number
  max_per_day: number
  max_per_week: number
}

interface TeacherState {
  teachers: Teacher[]
  pending: Partial<Teacher>[]   // unsaved new/edited
  dirty: boolean                 // any unsaved changes?
  loading: boolean

  // Actions
  setTeachers: (teachers: Teacher[]) => void
  addPending: (teacher: Partial<Teacher>) => void
  updatePending: (id: string, data: Partial<Teacher>) => void
  removePending: (id: string) => void
  markClean: () => void
  setLoading: (v: boolean) => void
}

export const useTeacherStore = create<TeacherState>()((set) => ({
  teachers: [],
  pending: [],
  dirty: false,
  loading: false,

  setTeachers: (teachers) => set({ teachers }),
  addPending: (teacher) => set((s) => ({
    pending: [...s.pending, { ...teacher, _new: true }],
    dirty: true
  })),
  updatePending: (id, data) => set((s) => ({
    pending: s.pending.map(t => t.id === id ? { ...t, ...data } : t),
    dirty: true
  })),
  removePending: (id) => set((s) => ({
    pending: s.pending.filter(t => t.id !== id),
    dirty: true
  })),
  markClean: () => set({ dirty: false, pending: [] }),
  setLoading: (loading) => set({ loading })
}))
```

### Save-All Store
```typescript
// stores/saveAllStore.ts
// Coordinates saving all dirty stores at once

export const useSaveAll = create((set, get) => ({
  saving: false,

  saveAll: async () => {
    set({ saving: true })
    try {
      const teacherStore = useTeacherStore.getState()
      const roomStore = useRoomStore.getState()
      // ... etc

      // Batch save dirty stores
      if (teacherStore.dirty) {
        await teacherApi.batchUpsert(teacherStore.pending)
        teacherStore.markClean()
      }
      if (roomStore.dirty) {
        await roomApi.batchUpsert(roomStore.pending)
        roomStore.markClean()
      }
      // ... repeat for all stores
    } finally {
      set({ saving: false })
    }
  }
}))
```

### Lesson Block Store
```typescript
// stores/lessonBlockStore.ts
interface LessonBlock {
  id: string
  lesson_type: 'single' | 'double' | 'triple'
  count: number
  is_locked: boolean
  locked_slot: number    // bitmask
  teacher_ids: string[]
  subject_ids: string[]
  classroom_ids: string[]
  room_ids: string[]
  mini_group_id: string | null
}

interface LessonBlockState {
  blocks: LessonBlock[]
  draft: Partial<LessonBlock> | null  // currently being built in form
  dirty: boolean

  setBlocks: (blocks: LessonBlock[]) => void
  setDraft: (draft: Partial<LessonBlock>) => void
  updateDraft: (data: Partial<LessonBlock>) => void
  commitDraft: () => void
  clearDraft: () => void
  deleteBlock: (id: string) => void
  markClean: () => void
}
```

### Generate Store
```typescript
// stores/generateStore.ts
interface GenerateState {
  jobId: string | null
  status: 'idle' | 'preflight' | 'running' | 'complete' | 'failed'
  progress: number
  warnings: string[]
  errors: string[]
  result: TimetableResult | null
  preflightResult: PreflightResult | null

  startJob: (jobId: string) => void
  updateProgress: (progress: number, status: string) => void
  setResult: (result: TimetableResult) => void
  setError: (errors: string[]) => void
  reset: () => void
}
```

### Constraint Store
```typescript
// stores/constraintStore.ts
interface ConstraintConfig {
  // Hard constraints (boolean toggles)
  H1_teacher_clash: boolean           // default: true, locked
  H2_room_double_booking: boolean     // default: true, locked
  H3_teacher_availability: boolean    // default: true
  H4_room_availability: boolean       // default: true
  H5_authorized_teacher: boolean      // default: true
  H6_session_count: boolean           // default: true
  H7_lab_needs_lab_room: boolean      // default: true
  H8_contiguous_double: boolean       // default: true

  // Soft constraints (boolean toggle + weight 0-1)
  S1_max_daily_periods: boolean;      S1_weight: number
  S2_difficult_not_last: boolean;     S2_weight: number
  S3_no_same_subject_twice_day: boolean; S3_weight: number
  S4_lab_not_first_period: boolean;   S4_weight: number
  S5_teacher_max_consecutive: boolean; S5_weight: number
  S6_even_distribution: boolean;      S6_weight: number
  S7_no_isolated_gaps: boolean;       S7_weight: number

  // [More will be added per constraint list]
}
```

---

## 4. API Client Layer

```typescript
// api/client.ts
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const API_BASE = 'http://localhost:8000/api'

export const api = axios.create({ baseURL: API_BASE })

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
```

---

## 5. Core Page Implementations

### Setup Page (First-Run)
```typescript
// pages/SetupPage.tsx
// Only shown when no users exist in DB (backend returns 404 on /auth/me)

export function SetupPage() {
  const [institutionName, setInstitutionName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSetup = async () => {
    await api.post('/auth/setup', { institutionName, username, password })
    // redirect to login
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-96 p-8 border rounded-lg">
        <h1>Welcome to ChromaSchedule</h1>
        <p>Let's set up your institution</p>
        {/* form fields */}
      </div>
    </div>
  )
}
```

### Generate Page
```typescript
// pages/GeneratePage.tsx
export function GeneratePage() {
  const { status, progress, warnings, errors, result } = useGenerateStore()
  const [preflightDone, setPreflightDone] = useState(false)

  const runPreflight = async () => {
    const r = await generateApi.preflight()
    setPreflightDone(true)
    // show warnings/errors
  }

  const startGeneration = async () => {
    const { job_id } = await generateApi.generateMain()
    useGenerateStore.getState().startJob(job_id)
  }

  return (
    <div>
      <PreflightResults />
      <div className="flex gap-4">
        <button onClick={runPreflight}>Run Pre-Flight Check</button>
        <button onClick={startGeneration} disabled={!preflightDone}>
          Generate Timetable
        </button>
      </div>
      {status === 'running' && <GenerationProgress progress={progress} />}
      {status === 'complete' && <TimetablePreview result={result} />}
    </div>
  )
}
```

---

## 6. Availability Grid Component

```typescript
// components/data-entry/AvailabilityGrid.tsx
// Visual day × period grid for teacher/room availability

interface Props {
  value: number          // current bitmask
  days: number
  periods: number
  breakMask: number      // grey out break slots
  onChange: (mask: number) => void
  label?: string
}

export function AvailabilityGrid({ value, days, periods, breakMask, onChange }: Props) {
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].slice(0, days)
  const PERIOD_LABELS = Array.from({ length: periods }, (_, i) => `P${i + 1}`)

  const getBit = (day: number, period: number) => {
    const bit = day * periods + period
    return (value >> bit) & 1
  }

  const isBreak = (day: number, period: number) => {
    const bit = day * periods + period
    return (breakMask >> bit) & 1
  }

  const toggleBit = (day: number, period: number) => {
    if (isBreak(day, period)) return  // cannot toggle break slots
    const bit = day * periods + period
    onChange(value ^ (1 << bit))      // XOR to toggle
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="w-12" />
            {DAY_NAMES.map(d => <th key={d} className="px-2 py-1 text-center">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: periods }, (_, p) => (
            <tr key={p}>
              <td className="pr-2 text-right text-gray-500">{PERIOD_LABELS[p]}</td>
              {Array.from({ length: days }, (_, d) => {
                const available = getBit(d, p) === 1
                const breakSlot = isBreak(d, p) === 1
                return (
                  <td key={d}
                    className={`
                      w-8 h-8 border cursor-pointer text-center
                      ${breakSlot ? 'bg-gray-200 cursor-not-allowed' : ''}
                      ${!breakSlot && available ? 'bg-green-400 hover:bg-green-500' : ''}
                      ${!breakSlot && !available ? 'bg-red-100 hover:bg-red-200' : ''}
                    `}
                    onClick={() => toggleBit(d, p)}
                    title={breakSlot ? 'Break' : available ? 'Available' : 'Unavailable'}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-3 mt-2 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-400 inline-block" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-100 inline-block" /> Unavailable
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-gray-200 inline-block" /> Break
        </span>
      </div>
    </div>
  )
}
```

---

## 7. Lesson Block Builder Component

```typescript
// components/lesson-blocks/LessonBlockForm.tsx

export function LessonBlockForm({ miniGroupId = null, onSave }) {
  const { teachers } = useTeacherStore()
  const { rooms } = useRoomStore()
  const { subjects } = useSubjectStore()
  const { classrooms } = useClassroomStore()
  const { institution } = useInstitutionStore()

  const [form, setForm] = useState({
    lesson_type: 'single' as 'single' | 'double' | 'triple',
    count: 1,
    teacher_ids: [] as string[],
    subject_ids: [] as string[],
    classroom_ids: [] as string[],
    room_ids: [] as string[],
    is_locked: false,
    locked_slot: 0
  })

  const [showSlotPicker, setShowSlotPicker] = useState(false)

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="font-medium">New Lesson Block</h3>

      {/* Type + Count */}
      <div className="flex gap-4">
        <div>
          <label>Type</label>
          <select value={form.lesson_type}
            onChange={e => setForm(f => ({ ...f, lesson_type: e.target.value as any }))}>
            <option value="single">Single Period</option>
            <option value="double">Double Period</option>
            <option value="triple">Triple Period</option>
          </select>
        </div>
        <div>
          <label>Times per week</label>
          <input type="number" min={1} max={10} value={form.count}
            onChange={e => setForm(f => ({ ...f, count: +e.target.value }))} />
        </div>
      </div>

      {/* Multi-selects */}
      <MultiSelect
        label="Teachers"
        options={teachers.map(t => ({ value: t.id, label: t.name }))}
        selected={form.teacher_ids}
        onChange={ids => setForm(f => ({ ...f, teacher_ids: ids }))}
      />

      <MultiSelect
        label="Subjects"
        options={subjects.map(s => ({ value: s.id, label: s.name }))}
        selected={form.subject_ids}
        onChange={ids => setForm(f => ({ ...f, subject_ids: ids }))}
      />

      <MultiSelect
        label="Classrooms"
        options={classrooms.map(c => ({ value: c.id, label: c.name }))}
        selected={form.classroom_ids}
        onChange={ids => setForm(f => ({ ...f, classroom_ids: ids }))}
      />

      <MultiSelect
        label="Rooms"
        options={rooms.map(r => ({
          value: r.id,
          label: `${r.name}${r.is_lab ? ' (Lab)' : ''}`
        }))}
        selected={form.room_ids}
        onChange={ids => setForm(f => ({ ...f, room_ids: ids }))}
      />

      {/* Lock toggle */}
      <div className="flex items-center gap-3">
        <input type="checkbox" id="locked" checked={form.is_locked}
          onChange={e => {
            setForm(f => ({ ...f, is_locked: e.target.checked }))
            if (e.target.checked) setShowSlotPicker(true)
          }} />
        <label htmlFor="locked">Lock to specific slot</label>
      </div>

      {/* Locked slot picker — shows grid, single selection */}
      {form.is_locked && showSlotPicker && (
        <LockedSlotPicker
          days={institution.days_per_week}
          periods={institution.periods_per_day}
          breakMask={institution.break_mask}
          blockLength={{"single":1,"double":2,"triple":3}[form.lesson_type]}
          value={form.locked_slot}
          onChange={slot => setForm(f => ({ ...f, locked_slot: slot }))}
        />
      )}

      <button onClick={() => onSave(form)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        Add Block
      </button>
    </div>
  )
}
```

---

## 8. Constraint Settings Panel

```typescript
// components/constraints/ConstraintPanel.tsx

const HARD_CONSTRAINTS = [
  { key: 'H1_teacher_clash', label: 'Teacher clash prevention', locked: true },
  { key: 'H2_room_double_booking', label: 'Room double-booking', locked: true },
  { key: 'H3_teacher_availability', label: 'Teacher availability', locked: false },
  { key: 'H4_room_availability', label: 'Room availability', locked: false },
  { key: 'H5_authorized_teacher', label: 'Authorized teacher for subject', locked: false },
  { key: 'H6_session_count', label: 'Required sessions per week', locked: true },
  { key: 'H7_lab_needs_lab_room', label: 'Lab subjects need lab rooms', locked: false },
  { key: 'H8_contiguous_double', label: 'Double/triple must be contiguous', locked: true },
]

const SOFT_CONSTRAINTS = [
  { key: 'S1_max_daily_periods', label: 'Max periods per day per teacher' },
  { key: 'S2_difficult_not_last', label: 'Difficult subjects not in last period' },
  { key: 'S3_no_same_subject_twice_day', label: 'No same subject twice in a day' },
  { key: 'S4_lab_not_first_period', label: 'Labs not in first period' },
  { key: 'S5_teacher_max_consecutive', label: 'Limit consecutive teaching periods' },
  { key: 'S6_even_distribution', label: 'Even subject distribution across week' },
  { key: 'S7_no_isolated_gaps', label: 'No isolated single-period gaps for teachers' },
]

export function ConstraintPanel() {
  const { config, update, save, exportBinary, importBinary } = useConstraintStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-6">

      {/* Hard Constraints */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-3">Hard Constraints</h3>
        <p className="text-sm text-gray-500 mb-3">
          Hard constraints must always be satisfied. Locked constraints are always active.
        </p>
        <div className="space-y-2">
          {HARD_CONSTRAINTS.map(c => (
            <div key={c.key} className="flex items-center gap-3 py-2 border-b">
              <input
                type="checkbox"
                checked={config[c.key] ?? true}
                disabled={c.locked}
                onChange={e => update(c.key, e.target.checked)}
                className={c.locked ? 'opacity-50' : ''}
              />
              <span className="flex-1 text-sm">{c.label}</span>
              {c.locked && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  locked
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Soft Constraints */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-3">Soft Constraints</h3>
        <p className="text-sm text-gray-500 mb-3">
          The GA minimizes violations. Higher weight = stronger preference.
        </p>
        <div className="space-y-3">
          {SOFT_CONSTRAINTS.map(c => (
            <div key={c.key} className="py-2 border-b">
              <div className="flex items-center gap-3 mb-1">
                <input
                  type="checkbox"
                  checked={config[c.key] ?? true}
                  onChange={e => update(c.key, e.target.checked)}
                />
                <span className="text-sm">{c.label}</span>
              </div>
              {config[c.key] && (
                <div className="flex items-center gap-3 ml-6">
                  <span className="text-xs text-gray-400 w-12">Weight</span>
                  <input
                    type="range" min={0} max={1} step={0.1}
                    value={config[`${c.key}_weight`] ?? 0.5}
                    onChange={e => update(`${c.key}_weight`, +e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-xs w-8 text-right">
                    {(config[`${c.key}_weight`] ?? 0.5).toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={save}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
          Save Settings
        </button>
        <button onClick={exportBinary}
          className="px-4 py-2 border rounded text-sm">
          Export as .csp
        </button>
        <button onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 border rounded text-sm">
          Import .csp
        </button>
        <input
          ref={fileInputRef} type="file" accept=".csp" className="hidden"
          onChange={e => importBinary(e.target.files![0])}
        />
      </div>
    </div>
  )
}
```

---

## 9. Generation & Polling Flow

```typescript
// hooks/usePolling.ts
export function usePolling(jobId: string | null, intervalMs = 2000) {
  const { updateProgress, setResult, setError } = useGenerateStore()

  useEffect(() => {
    if (!jobId) return
    const interval = setInterval(async () => {
      const status = await generateApi.pollJob(jobId)

      updateProgress(status.progress, status.status)

      if (status.status === 'complete') {
        clearInterval(interval)
        const result = await generateApi.getResult(jobId)
        setResult(result)
      } else if (status.status === 'failed') {
        clearInterval(interval)
        setError(status.error)
      }
    }, intervalMs)

    return () => clearInterval(interval)
  }, [jobId])
}

// components/generate/GenerationProgress.tsx
export function GenerationProgress({ progress }: { progress: number }) {
  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <div className="flex justify-between text-sm">
        <span>Generating timetable...</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">
        {progress < 15 ? 'Running pre-flight checks...' :
         progress < 90 ? 'GA evolving population...' :
         'Finalizing timetable...'}
      </p>
    </div>
  )
}
```

---

## 10. Timetable Display Component

```typescript
// components/timetable/TimetableGrid.tsx
interface Props {
  timetable: TimetableResult
  viewMode: 'class' | 'teacher' | 'room'
  selectedEntity: string   // e.g. "10A" or "Raj Kumar"
}

export function TimetableGrid({ timetable, viewMode, selectedEntity }: Props) {
  const { institution } = useInstitutionStore()
  const days = institution.days_per_week
  const periods = institution.periods_per_day
  const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].slice(0, days)

  const viewData = viewMode === 'class'
    ? timetable.views.by_class[selectedEntity]
    : viewMode === 'teacher'
    ? timetable.views.by_teacher[selectedEntity]
    : timetable.views.by_room[selectedEntity]

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border p-2 bg-gray-50 w-16">Period</th>
            {DAY_NAMES.map(d => (
              <th key={d} className="border p-2 bg-gray-50 text-center">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: periods }, (_, p) => (
            <tr key={p}>
              <td className="border p-2 text-center text-gray-500 text-xs">P{p+1}</td>
              {Array.from({ length: days }, (_, d) => {
                const cell = viewData?.[d]?.[p]
                const isBreak = (institution.break_mask >> (d * periods + p)) & 1
                return (
                  <TimetableCell
                    key={d}
                    cell={cell}
                    isBreak={!!isBreak}
                    viewMode={viewMode}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// components/timetable/TimetableCell.tsx
export function TimetableCell({ cell, isBreak, viewMode }) {
  if (isBreak) {
    return (
      <td className="border p-1 bg-gray-100 text-center text-xs text-gray-400">
        Break
      </td>
    )
  }
  if (!cell || cell.is_continuation) {
    return <td className="border p-1" />
  }

  return (
    <td className={`border p-1 text-xs align-top ${
      cell.is_lab ? 'bg-purple-50' : 'bg-white'
    } ${cell.is_locked ? 'ring-2 ring-yellow-400' : ''}`}
      rowSpan={cell.length}
    >
      <div className="font-medium text-gray-800">
        {cell.subjects.map(s => s.name).join(' / ')}
      </div>
      {viewMode !== 'teacher' && (
        <div className="text-gray-500">
          {cell.teachers.map(t => t.name).join(', ')}
        </div>
      )}
      {viewMode !== 'room' && (
        <div className="text-gray-400">
          {cell.rooms.map(r => r.name).join(', ')}
        </div>
      )}
      {viewMode !== 'class' && (
        <div className="text-blue-500">
          {cell.classrooms.map(c => c.name).join(', ')}
        </div>
      )}
      {cell.is_lab && (
        <span className="text-purple-600 text-xs">[Lab]</span>
      )}
    </td>
  )
}
```

---

## 11. Drag-Drop Swap Editor

```typescript
// pages/DragDropPage.tsx
// Uses @hello-pangea/dnd (maintained fork of react-beautiful-dnd)

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

export function DragDropPage() {
  const { id } = useParams()
  const [timetable, setTimetable] = useState<TimetableResult | null>(null)
  const [pendingSwap, setPendingSwap] = useState<SwapPending | null>(null)
  const [viewMode, setViewMode] = useState<'class'|'teacher'|'room'>('class')
  const [selectedEntity, setSelectedEntity] = useState('')

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const sourceSlot = parseDroppableId(result.draggableId)
    const destSlot = parseDroppableId(result.destination.droppableId)

    // Validate swap
    const check = await timetableApi.validateSwap(id!, sourceSlot, destSlot)

    if (check.violations.length > 0) {
      // Show violation dialog — swap not allowed
      setPendingSwap({ ...check, sourceSlot, destSlot, blocked: true })
    } else {
      // Apply swap immediately, optionally show warnings
      applySwap(sourceSlot, destSlot)
      if (check.warnings.length > 0) {
        toast.warning(`Swap applied with warnings: ${check.warnings.join(', ')}`)
      }
    }
  }

  const applySwap = (slotA: SlotRef, slotB: SlotRef) => {
    setTimetable(t => {
      if (!t) return t
      const newGrid = deepClone(t.grid)
      const cellA = newGrid[slotA.day][slotA.period]
      const cellB = newGrid[slotB.day][slotB.period]
      newGrid[slotA.day][slotA.period] = cellB
      newGrid[slotB.day][slotB.period] = cellA
      return { ...t, grid: newGrid }
    })
  }

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
        <EntitySelector
          mode={viewMode}
          timetable={timetable}
          selected={selectedEntity}
          onSelect={setSelectedEntity}
        />
        <button onClick={saveChanges} className="ml-auto px-4 py-2 bg-green-600 text-white rounded">
          Save Changes
        </button>
        <PDFExportButton timetable={timetable} />
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        {/* Render timetable grid with Draggable cells */}
        <DraggableTimetableGrid
          timetable={timetable}
          viewMode={viewMode}
          selectedEntity={selectedEntity}
        />
      </DragDropContext>

      {pendingSwap && (
        <SwapConfirmDialog
          swap={pendingSwap}
          onClose={() => setPendingSwap(null)}
        />
      )}
    </div>
  )
}
```

---

## 12. PDF Export

```typescript
// utils/pdf.ts
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export async function exportTimetablePDF(
  timetable: TimetableResult,
  options: {
    views: ('class' | 'teacher' | 'room')[]
    title: string
  }
) {
  const pdf = new jsPDF('landscape', 'mm', 'a4')
  let isFirstPage = true

  for (const viewMode of options.views) {
    const entities = viewMode === 'class'
      ? Object.keys(timetable.views.by_class)
      : viewMode === 'teacher'
      ? Object.keys(timetable.views.by_teacher)
      : Object.keys(timetable.views.by_room)

    for (const entity of entities) {
      if (!isFirstPage) pdf.addPage()
      isFirstPage = false

      // Render this view to an offscreen element
      const container = document.createElement('div')
      container.style.cssText = 'position:absolute;left:-9999px;background:white;padding:20px;width:1000px'
      container.innerHTML = renderTimetableHTML(timetable, viewMode, entity, options.title)
      document.body.appendChild(container)

      const canvas = await html2canvas(container, { scale: 1.5, useCORS: true })
      const imgData = canvas.toDataURL('image/png')

      // A4 landscape: 297mm × 210mm, margin 10mm
      pdf.addImage(imgData, 'PNG', 10, 10, 277, 185)

      // Header
      pdf.setFontSize(10)
      pdf.text(`${options.title} — ${viewMode.toUpperCase()}: ${entity}`, 10, 207)
      pdf.text(new Date().toLocaleDateString(), 267, 207, { align: 'right' })

      document.body.removeChild(container)
    }
  }

  pdf.save(`timetable_${options.title}_${Date.now()}.pdf`)
}
```

---

## package.json Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",
    "zustand": "^5.0.0",
    "axios": "^1.7.0",
    "@hello-pangea/dnd": "^16.6.0",
    "jspdf": "^2.5.2",
    "html2canvas": "^1.4.1",
    "react-hot-toast": "^2.4.1"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.20"
  }
}
```
