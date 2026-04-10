/**
 * Local Genetic Algorithm Timetable Scheduler
 * Runs entirely in the browser — no backend required.
 */

import type { Subject, Teacher, Class, Classroom, Lesson, AppSettings, TimetableEntry, Break } from '../store/useStore';

// ─── Internal types ───────────────────────────────────────────────────────

interface SlotKey { day: number; period: number }

interface ScheduledEntry {
  lessonId: string;
  subjectId: string;
  teacherIds: string[];
  classIds: string[];
  day: number;
  startPeriod: number;
  duration: number;
  roomId: string;
  locked: boolean;
}

type Chromosome = ScheduledEntry[];

interface GaConfig {
  populationSize: number;
  maxGenerations: number;
  mutationRate: number;
  eliteCount: number;
}

const DEFAULT_CONFIG: GaConfig = {
  populationSize: 60,
  maxGenerations: 200,
  mutationRate: 0.15,
  eliteCount: 4,
};

export interface SchedulerConstraints {
  noConsecutivePeriods: boolean;
  noConsecutivePeriodsWeight: number;
  difficultNotLast: boolean;
  difficultNotLastWeight: number;
  avoidMorningLab: boolean;
  avoidMorningLabWeight: number;
  noSameSubjectTwicePerDay: boolean;
  noSameSubjectTwicePerDayWeight: number;
}

export interface GaResult {
  entries: TimetableEntry[];
  fitness: number;
  generationTime: number;
  timetableId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function rand(n: number) { return Math.floor(Math.random() * n); }

function isBreak(day: number, period: number, breaks: Break[]): boolean {
  return breaks.some(b => b.day === day && b.period === period);
}

function getAvailableSlots(numDays: number, numPeriods: number, breaks: Break[], duration: number): SlotKey[] {
  const slots: SlotKey[] = [];
  for (let d = 0; d < numDays; d++) {
    for (let p = 0; p <= numPeriods - duration; p++) {
      let blocked = false;
      for (let k = 0; k < duration; k++) {
        if (isBreak(d, p + k, breaks)) { blocked = true; break; }
      }
      if (!blocked) slots.push({ day: d, period: p });
    }
  }
  return slots;
}

// ─── Chromosome builder ───────────────────────────────────────────────────

interface TaskItem {
  lessonId: string;
  subjectId: string;
  teacherIds: string[];
  classIds: string[];
  preferredRoomIds: string[];
  duration: number;
  isLab: boolean;
  lockedDay: number | null;
  lockedStartPeriod: number | null;
}

function expandLessons(lessons: Lesson[], subjects: Subject[]): TaskItem[] {
  const tasks: TaskItem[] = [];
  for (const lesson of lessons) {
    const subject = subjects.find(s => s.id === lesson.subject_id);
    const isLab = subject?.is_lab ?? false;
    const sessions = lesson.sessions.length > 0 ? lesson.sessions : [{ duration: 1 as 1, count: 1 }];
    const hasMatchingLockedDuration = lesson.locked_duration !== null
      ? sessions.some(session => session.duration === lesson.locked_duration)
      : false;
    let lockConsumed = false;

    for (const session of sessions) {
      for (let i = 0; i < session.count; i++) {
        const shouldLockOccurrence = (
          lesson.is_locked &&
          !lockConsumed &&
          lesson.locked_day !== null &&
          lesson.locked_start_period !== null &&
          (
            lesson.locked_duration === null ||
            session.duration === lesson.locked_duration ||
            !hasMatchingLockedDuration
          )
        );

        tasks.push({
          lessonId: lesson.id,
          subjectId: lesson.subject_id,
          teacherIds: lesson.teacher_ids,
          classIds: lesson.class_ids,
          preferredRoomIds: lesson.room_ids,
          duration: session.duration,
          isLab,
          lockedDay: shouldLockOccurrence ? lesson.locked_day : null,
          lockedStartPeriod: shouldLockOccurrence ? lesson.locked_start_period : null,
        });

        if (shouldLockOccurrence) lockConsumed = true;
      }
    }
  }
  return tasks;
}

function buildTeacherAvailabilityMap(teachers: Teacher[]): Map<string, Set<string>> {
  return new Map(
    teachers.map(teacher => [
      teacher.id,
      new Set((teacher.unavailable_slots ?? []).map(slot => `${slot.day}_${slot.period}`)),
    ]),
  );
}

function teachersAvailable(
  teacherIds: string[],
  day: number,
  startPeriod: number,
  duration: number,
  availability: Map<string, Set<string>>,
): boolean {
  for (const teacherId of teacherIds) {
    const unavailable = availability.get(teacherId);
    if (!unavailable) continue;

    for (let offset = 0; offset < duration; offset++) {
      if (unavailable.has(`${day}_${startPeriod + offset}`)) return false;
    }
  }

  return true;
}

function buildChromosome(
  tasks: TaskItem[],
  numDays: number,
  numPeriods: number,
  breaks: Break[],
  classrooms: Classroom[],
  teachers: Teacher[],
): Chromosome {
  const availability = buildTeacherAvailabilityMap(teachers);

  return tasks.map(task => {
    const candidateSlots = task.lockedDay !== null && task.lockedStartPeriod !== null
      ? [{ day: task.lockedDay, period: task.lockedStartPeriod }]
      : getAvailableSlots(numDays, numPeriods, breaks, task.duration);
    const slots = candidateSlots.filter(slot =>
      slot.period + task.duration <= numPeriods &&
      teachersAvailable(task.teacherIds, slot.day, slot.period, task.duration, availability),
    );
    const slot = slots.length > 0 ? slots[rand(slots.length)] : { day: 0, period: 0 };

    let roomId = '';
    if (task.preferredRoomIds.length > 0) {
      roomId = task.preferredRoomIds[rand(task.preferredRoomIds.length)];
    } else {
      const eligible = classrooms.filter(r => task.isLab ? r.is_lab : !r.is_lab);
      const pool = eligible.length > 0 ? eligible : classrooms;
      roomId = pool.length > 0 ? pool[rand(pool.length)].id : '';
    }

    return {
      lessonId: task.lessonId,
      subjectId: task.subjectId,
      teacherIds: task.teacherIds,
      classIds: task.classIds,
      day: slot.day,
      startPeriod: slot.period,
      duration: task.duration,
      roomId,
      locked: task.lockedDay !== null && task.lockedStartPeriod !== null,
    };
  });
}

// ─── Fitness function ─────────────────────────────────────────────────────

function calcFitness(
  chrom: Chromosome,
  numPeriods: number,
  subjects: Subject[],
  uc: Partial<SchedulerConstraints>,
): number {
  let penalty = 0;

  // Build slot grid: "day_period" -> entries occupying that slot
  const grid = new Map<string, ScheduledEntry[]>();
  for (const e of chrom) {
    for (let k = 0; k < e.duration; k++) {
      const key = `${e.day}_${e.startPeriod + k}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(e);
    }
  }

  // Hard: teacher / room / class conflicts
  for (const entries of grid.values()) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i], b = entries[j];
        if (a.teacherIds.some(t => b.teacherIds.includes(t))) penalty += 100;
        if (a.roomId && a.roomId === b.roomId)                 penalty += 80;
        if (a.classIds.some(c => b.classIds.includes(c)))      penalty += 100;
      }
    }
  }

  // Soft: teacher consecutive periods (>2)
  if (uc.noConsecutivePeriods !== false) {
    const w = ((uc.noConsecutivePeriodsWeight ?? 70) / 100) * 30;
    if (w > 0) {
      const teacherDayPeriods = new Map<string, Set<number>>();
      for (const e of chrom) {
        for (const tid of e.teacherIds) {
          const k = `${tid}_${e.day}`;
          if (!teacherDayPeriods.has(k)) teacherDayPeriods.set(k, new Set());
          for (let p = e.startPeriod; p < e.startPeriod + e.duration; p++) {
            teacherDayPeriods.get(k)!.add(p);
          }
        }
      }
      for (const periods of teacherDayPeriods.values()) {
        const sorted = Array.from(periods).sort((a, b) => a - b);
        let run = 1;
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i] === sorted[i - 1] + 1) { run++; if (run > 2) penalty += w; }
          else run = 1;
        }
      }
    }
  }

  // Soft: difficult subject not in last period
  if (uc.difficultNotLast !== false) {
    const w = ((uc.difficultNotLastWeight ?? 60) / 100) * 20;
    if (w > 0) {
      for (const e of chrom) {
        const sub = subjects.find(s => s.id === e.subjectId);
        if (sub?.is_difficult && e.startPeriod + e.duration - 1 === numPeriods - 1) penalty += w;
      }
    }
  }

  // Soft: avoid morning labs (period 0 or 1)
  if (uc.avoidMorningLab === true) {
    const w = ((uc.avoidMorningLabWeight ?? 50) / 100) * 15;
    if (w > 0) {
      for (const e of chrom) {
        const sub = subjects.find(s => s.id === e.subjectId);
        if (sub?.is_lab && e.startPeriod <= 1) penalty += w;
      }
    }
  }

  // Soft: same subject not twice on same day per class
  if (uc.noSameSubjectTwicePerDay !== false) {
    const w = ((uc.noSameSubjectTwicePerDayWeight ?? 80) / 100) * 25;
    if (w > 0) {
      const seen = new Map<string, number>();
      for (const e of chrom) {
        for (const cid of e.classIds) {
          const k = `${cid}_${e.subjectId}_${e.day}`;
          seen.set(k, (seen.get(k) ?? 0) + 1);
        }
      }
      for (const count of seen.values()) {
        if (count > 1) penalty += w * (count - 1);
      }
    }
  }

  return penalty;
}

// ─── Genetic operators ────────────────────────────────────────────────────

function tournamentSelect(pop: Chromosome[], fitness: number[], k = 4): Chromosome {
  let best = rand(pop.length);
  for (let i = 1; i < k; i++) {
    const idx = rand(pop.length);
    if (fitness[idx] < fitness[best]) best = idx;
  }
  return pop[best];
}

function crossover(a: Chromosome, b: Chromosome): Chromosome {
  if (a.length === 0) return [...b];
  const point = rand(a.length);
  return [...a.slice(0, point), ...b.slice(point)];
}

function mutate(
  chrom: Chromosome,
  numDays: number,
  numPeriods: number,
  breaks: Break[],
  classrooms: Classroom[],
  teachers: Teacher[],
  rate: number,
): Chromosome {
  const availability = buildTeacherAvailabilityMap(teachers);

  return chrom.map(e => {
    if (e.locked || Math.random() > rate) return e;

    const slots = getAvailableSlots(numDays, numPeriods, breaks, e.duration).filter(slot =>
      teachersAvailable(e.teacherIds, slot.day, slot.period, e.duration, availability),
    );
    const slot = slots.length > 0 ? slots[rand(slots.length)] : { day: e.day, period: e.startPeriod };

    let roomId = e.roomId;
    if (Math.random() < 0.3 && classrooms.length > 0) {
      roomId = classrooms[rand(classrooms.length)].id;
    }

    return { ...e, day: slot.day, startPeriod: slot.period, roomId };
  });
}

// ─── Main GA entry point ──────────────────────────────────────────────────

export function runGA(
  lessons: Lesson[],
  subjects: Subject[],
  teachers: Teacher[],
  _classes: Class[],
  classrooms: Classroom[],
  settings: AppSettings,
  userConstraints?: Partial<SchedulerConstraints>,
  config: GaConfig = DEFAULT_CONFIG,
): GaResult {
  const t0 = performance.now();
  const numDays    = parseInt(settings.numberOfDays) || 5;
  const numPeriods = parseInt(settings.periodsPerDay) || 7;
  const breaks     = settings.breaks ?? [];

  const tasks = expandLessons(lessons, subjects);

  if (tasks.length === 0) {
    return { entries: [], fitness: 0, generationTime: 0, timetableId: crypto.randomUUID() };
  }

  // Initialise population
  let population: Chromosome[] = Array.from({ length: config.populationSize }, () =>
    buildChromosome(tasks, numDays, numPeriods, breaks, classrooms, teachers)
  );

  let bestChrom = population[0];
  let bestFit = Infinity;

  for (let gen = 0; gen < config.maxGenerations; gen++) {
    const fitness = population.map(c => calcFitness(c, numPeriods, subjects, userConstraints ?? {}));

    for (let i = 0; i < fitness.length; i++) {
      if (fitness[i] < bestFit) { bestFit = fitness[i]; bestChrom = [...population[i]]; }
    }

    if (bestFit === 0) break;

    // Elitism
    const indexed = fitness.map((f, i) => ({ f, i })).sort((a, b) => a.f - b.f);
    const elite   = indexed.slice(0, config.eliteCount).map(x => [...population[x.i]]);

    const next: Chromosome[] = [...elite];
    while (next.length < config.populationSize) {
      const p1 = tournamentSelect(population, fitness);
      const p2 = tournamentSelect(population, fitness);
      let child = crossover(p1, p2);
      child = mutate(child, numDays, numPeriods, breaks, classrooms, teachers, config.mutationRate);
      next.push(child);
    }
    population = next;
  }

  // Convert to TimetableEntry[]
  const entries: TimetableEntry[] = bestChrom.map((e, idx) => {
    const subject = subjects.find(s => s.id === e.subjectId);
    return {
      id:           `entry_${idx}_${e.lessonId}_${e.day}_${e.startPeriod}`,
      lesson_id:    e.lessonId,
      day:          e.day,
      start_period: e.startPeriod,
      duration:     e.duration,
      subject_id:   e.subjectId,
      subject_name: subject?.name ?? 'Unknown',
      teacher_ids:  e.teacherIds,
      class_ids:    e.classIds,
      room_ids:     e.roomId ? [e.roomId] : [],
    };
  });

  return {
    entries,
    fitness: bestFit,
    generationTime: (performance.now() - t0) / 1000,
    timetableId: crypto.randomUUID(),
  };
}
