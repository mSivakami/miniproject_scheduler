import random
from time import time
from structures import TimeSlot, Timetable
from constraints import ConstraintChecker


class GeneticTimetableScheduler:
    def __init__(
        self,
        teachers, subjects, rooms, classes, lesson_blocks,
        days=5, periods_per_day=7,
        breaks=None,
    ):
        self.teachers        = teachers
        self.subjects        = subjects
        self.rooms           = rooms
        self.classes         = classes
        self.lesson_blocks   = lesson_blocks
        self.days            = days
        self.periods_per_day = periods_per_day
        self.breaks          = breaks or {}

        self.locked_lessons = [l for l in lesson_blocks if l.is_locked]
        self.free_lessons   = [l for l in lesson_blocks if not l.is_locked]

        self.sorted_free_lessons = sorted(
            self.free_lessons,
            key=lambda l: -l.duration
        )

        self.checker = ConstraintChecker(
            teachers, subjects, rooms, classes, lesson_blocks
        )

        # GA hyper-parameters
        self.population_size    = 200
        self.generations        = 400
        self.elite_size         = 15
        self.tournament_size    = 4
        self.base_mutation_rate = 0.30
        self.mutation_rate      = self.base_mutation_rate

    # ── population ────────────────────────────────────────────────────────

    def _make_timetable(self) -> Timetable:
        tt = Timetable(
            self.days, self.periods_per_day,
            self.breaks, self.locked_lessons,
        )
        # Sort longest first — harder to place, so schedule first
        for lesson in self.sorted_free_lessons:  # ✅ Use pre-sorted:
            for _ in range(50):
                day   = random.randint(0, self.days - 1)
                start = random.randint(0, self.periods_per_day - lesson.duration)
                ts    = TimeSlot(day, start, lesson.duration)
                if (
                    tt.can_assign(lesson, ts)
                    and tt.are_teachers_free(lesson.teacher_ids, ts)
                    and tt.are_rooms_free(lesson.room_ids, ts)
                    and tt.are_classes_free(lesson.class_ids, ts)
                ):
                    tt.assign(lesson, ts)
                    break
        return tt

    # ── fitness ───────────────────────────────────────────────────────────

    def _score(self, tt: Timetable) -> int:
        if tt.fitness is None:
            tt.fitness = self.checker.calculate_fitness(tt)
        return tt.fitness

    # ── selection ─────────────────────────────────────────────────────────

    def _tournament(self, scored):
        pool = random.sample(scored, self.tournament_size)
        return min(pool, key=lambda x: x[1])[0]

    # ── crossover ─────────────────────────────────────────────────────────

    def _crossover(self, p1: Timetable, p2: Timetable) -> Timetable:
        child = Timetable(
            self.days, self.periods_per_day,
            self.breaks, self.locked_lessons,
        )
        for lesson in self.free_lessons:
            parent = p1 if random.random() < 0.5 else p2
            slot = parent.get_assignment(lesson.id)
            if slot:
                child.assign(lesson, slot.copy())
        return child

    # ── mutation ──────────────────────────────────────────────────────────

    def _mutate(self, tt: Timetable):
        if not self.free_lessons or random.random() >= self.mutation_rate:
            return
        if random.random() < 0.6:
            self._move(tt)
        else:
            self._swap(tt)

    def _move(self, tt: Timetable):
        lesson = random.choice(self.free_lessons)

        for _ in range(20):
            day = random.randint(0, self.days - 1)
            start = random.randint(0, self.periods_per_day - lesson.duration)
            new_ts = TimeSlot(day, start, lesson.duration)

            if (
                tt.can_assign(lesson, new_ts)
                and tt.are_teachers_free(lesson.teacher_ids, new_ts)
                and tt.are_rooms_free(lesson.room_ids, new_ts)
                and tt.are_classes_free(lesson.class_ids, new_ts)
            ):
                tt.assign(lesson, new_ts)
                return

    def _swap(self, tt: Timetable):
        if len(self.free_lessons) < 2:
            return

        l1, l2 = random.sample(self.free_lessons, 2)
        if l1.duration != l2.duration:
            return

        s1 = tt.get_assignment(l1.id)
        s2 = tt.get_assignment(l2.id)
        if not s1 or not s2:
            return

        if (
            tt.are_teachers_free(l1.teacher_ids, s2) and
            tt.are_teachers_free(l2.teacher_ids, s1) and
            tt.are_rooms_free(l1.room_ids, s2) and
            tt.are_rooms_free(l2.room_ids, s1) and
            tt.are_classes_free(l1.class_ids, s2) and
            tt.are_classes_free(l2.class_ids, s1)
        ):
            tt.assign(l1, s2)
            tt.assign(l2, s1)

    # ── adaptive mutation ─────────────────────────────────────────────────

    def _adapt(self, stagnation: int):
        if stagnation > 10:
            self.mutation_rate = min(0.6, self.mutation_rate * 1.15)
        else:
            self.mutation_rate = self.base_mutation_rate
            

    # ── main loop ─────────────────────────────────────────────────────────

    def evolve(self):
        print(f"  Building initial population ({self.population_size} timetables)...", flush=True)

        make_time = time()
        population = [self._make_timetable() for _ in range(self.population_size)]
        print(f"  Done in {time() - make_time:.1f}s", flush=True)


        history    = []
        stagnation = 0
        prev_best  = float("inf")
        total_scored = 0

        for gen in range(self.generations):
            start = time()

            # scored = [(tt, self._score(tt)) for tt in population]       # optimise this line
            # ✅ Cache fitness by timetable state hash
            if not hasattr(self, '_fitness_cache'):
                self._fitness_cache = {}

            scored = []
            for tt in population:
                # Create hash from assignments (frozenset is hashable)
                state_hash = hash(tuple(
                    (lid, ts.day, ts.start_period)
                    for lid, ts in sorted(tt.assignments.items())
                ))
                
                if state_hash in self._fitness_cache:
                    fitness = self._fitness_cache[state_hash]
                else:
                    fitness = self._score(tt)
                    self._fitness_cache[state_hash] = fitness
                
                scored.append((tt, fitness))

            # Clear cache every 10 generations to prevent memory bloat
            if gen % 10 == 0:
                self._fitness_cache.clear()

            print(f"  Scored generation {gen} in {time() - start:.1f}s", flush=True)
            total_scored += time() - start
            scored.sort(key=lambda x: x[1])

            best = scored[0][1]
            history.append(best)

            if gen % 25 == 0 or best < prev_best:
                print(
                    f"  Gen {gen:>3} | fitness={best:>8,} | "
                    f"mut={self.mutation_rate:.2f} | stagnation={stagnation}",
                    flush=True,
                )   

            if best == 0:
                print(f"  Perfect solution at generation {gen}!", flush=True)
                break

            stagnation = stagnation + 1 if best == prev_best else 0
            self._adapt(stagnation)
            prev_best = best

            # if stagnation > 60:
            #     print(f"  Early stopping at generation {gen} due to stagnation.", flush=True)
            #     break

            # next generation
            new_pop = [tt for tt, _ in scored[:self.elite_size]]
            while len(new_pop) < self.population_size:
                child = self._crossover(
                    self._tournament(scored),
                    self._tournament(scored),
                )
                self._mutate(child)
                new_pop.append(child)

            population = new_pop

        print(f"  Total scoring time: {total_scored:.1f}s", flush=True)

        final      = [(tt, self._score(tt)) for tt in population]
        best_tt    = min(final, key=lambda x: x[1])[0]
        best_score = min(f for _, f in final)
        print(f"  Done. Best fitness = {best_score:,}", flush=True)
        return best_tt, history