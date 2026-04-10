"""
genetic.py
==========
Genetic Algorithm engine for timetable scheduling.

Key design decisions
--------------------
1.  Greedy-random population init, sorted by placement difficulty.
2.  Timetable.copy() for elitism — no external chromosome copying.
3.  Fitness cached on Timetable.fitness; invalidated on any gene change.
    No external hash-map cache — avoids the memory-bloat problem.
4.  Three crossover operators (block-group, day-preserving, uniform)
    with adaptive selection probabilities.
5.  Three mutation operators (move, swap, day-swap) with adaptive rate.
6.  Adaptive mutation rate driven by stagnation counter.
7.  Early exit on fitness == 0 (perfect solution).
8.  Stagnation hard stop after configurable limit.
"""

from __future__ import annotations

import random
from time import time
from typing import Dict, List, Optional, Tuple

from structures import LessonBlock, Timetable
from constraints import ConstraintChecker


# ─────────────────────────────────────────────────────────────────────────────
# GA DEFAULT PARAMETERS
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_PARAMS: Dict[str, object] = {
    "population_size":         80,
    "max_generations":        250,
    "elite_size":               8,
    "tournament_size":          4,
    "base_mutation_rate":    0.30,
    "max_mutation_rate":     0.65,
    "stagnation_threshold":    10,    # gens without improvement before heating
    "stagnation_limit":        60,    # hard stop if stagnation reaches this
    "max_placement_attempts":  60,    # per block per individual at init
    "crossover_ops": {
        # operator_name: initial probability (will be renormed)
        "block_group": 0.60,
        "day_preserving": 0.25,
        "uniform": 0.15,
    },
    "mutation_ops": {
        "move": 0.60,
        "swap": 0.25,
        "day_swap": 0.15,
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# GENETIC SCHEDULER
# ─────────────────────────────────────────────────────────────────────────────

class GeneticScheduler:
    """
    Full GA engine. Construct once per generation request; call evolve().
    """

    def __init__(
        self,
        teachers:        dict,
        subjects:        dict,
        rooms:           dict,
        classes:         dict,
        blocks:          List[LessonBlock],
        break_mask:      int,
        days:            int,
        periods_per_day: int,
        checker:         ConstraintChecker,
        params:          Optional[Dict] = None,
        seed:            Optional[int]  = None,
    ):
        self.teachers        = teachers
        self.subjects        = subjects
        self.rooms           = rooms
        self.classes         = classes
        self.days            = days
        self.ppd             = periods_per_day
        self.break_mask      = break_mask
        self.checker         = checker

        # Merge params with defaults
        self.p = dict(DEFAULT_PARAMS)
        if params:
            self.p.update(params)

        # Crossover / mutation operator probabilities (mutable for adaptation)
        self._xo_probs = dict(self.p["crossover_ops"])
        self._mut_probs = dict(self.p["mutation_ops"])

        # Seeded RNG for reproducibility
        self._rng = random.Random(seed)

        # Separate locked vs free blocks
        self.locked_blocks = [b for b in blocks if b.is_locked]
        self.free_blocks   = [b for b in blocks if not b.is_locked]

        # Sort free blocks by difficulty (hardest first → better fill rate)
        # Difficulty = duration DESC, then teacher_count DESC, then class_count DESC
        self.free_blocks.sort(
            key=lambda b: (-b.duration, -len(b.teacher_ids), -len(b.class_ids))
        )

        # All blocks list (locked first, then free in difficulty order)
        self.all_blocks = self.locked_blocks + self.free_blocks

        # Adaptive mutation rate (mutable)
        self.mutation_rate = float(self.p["base_mutation_rate"])

        # Credit tracking for adaptive operator selection
        self._xo_credit  = {k: 0.0 for k in self._xo_probs}
        self._mut_credit = {k: 0.0 for k in self._mut_probs}
        self._adaptation_window = 20
        self._xo_calls   = {k: 0 for k in self._xo_probs}
        self._mut_calls  = {k: 0 for k in self._mut_probs}

    # ─────────────────────────────────────────────────────────────────────
    # POPULATION INITIALISATION
    # ─────────────────────────────────────────────────────────────────────

    def _new_timetable(self) -> Timetable:
        return Timetable(
            self.days, self.ppd,
            self.break_mask, self.locked_blocks,
        )

    def _make_individual(self) -> Timetable:
        """
        Greedy-random placement.
        1. Locked blocks are pre-assigned by Timetable._init_locked().
        2. Free blocks placed hardest-first with up to max_placement_attempts.
        """
        tt = self._new_timetable()
        attempts = int(self.p["max_placement_attempts"])
        rng = self._rng

        for block in self.free_blocks:
            for _ in range(attempts):
                day    = rng.randint(0, self.days - 1)
                period = rng.randint(0, self.ppd - block.duration)
                if tt.is_slot_free(block, day, period):
                    tt.assign(block, day, period)
                    break
        return tt

    def _init_population(self) -> List[Timetable]:
        """
        Three-strategy seeding:
          30% DSATUR greedy (most-constrained block first, min-conflict slot)
          40% greedy-random with shuffled block order
          30% pure random (any valid slot)
        Mix provides quality + diversity from generation 0.
        """
        pop_size = int(self.p["population_size"])
        n_dsatur = max(1, int(pop_size * 0.30))
        n_greedy = max(1, int(pop_size * 0.40))
        n_random = pop_size - n_dsatur - n_greedy

        population = []

        # DSATUR greedy individuals
        for _ in range(n_dsatur):
            population.append(self._make_dsatur_individual())

        # Greedy-random individuals (shuffled block order)
        for _ in range(n_greedy):
            population.append(self._make_shuffled_individual())

        # Pure-random individuals
        for _ in range(n_random):
            population.append(self._make_random_individual())

        return population

    def _make_dsatur_individual(self) -> Timetable:
        """
        DSATUR-inspired: place blocks in descending conflict-degree order,
        choosing the slot with the fewest existing conflicts.
        """
        tt = self._new_timetable()
        rng = self._rng

        for block in self.free_blocks:
            best_slot = None
            best_conflicts = float("inf")

            # Sample candidate slots
            candidates = []
            for day in range(self.days):
                for period in range(self.ppd - block.duration + 1):
                    if tt.is_slot_free(block, day, period):
                        candidates.append((day, period))

            if not candidates:
                continue

            # Score each candidate by resource overlap with already-placed blocks
            for day, period in candidates:
                start = day * self.ppd + period
                slot_mask = ((1 << block.duration) - 1) << start
                conflicts = 0
                for tid in block.teacher_ids:
                    conflicts += bin(tt.teacher_mask.get(tid, 0) & slot_mask).count("1")
                for cid in block.class_ids:
                    conflicts += bin(tt.class_mask.get(cid, 0) & slot_mask).count("1")

                if conflicts < best_conflicts:
                    best_conflicts = conflicts
                    best_slot = [(day, period)]
                elif conflicts == best_conflicts and best_slot is not None:
                    best_slot.append((day, period))

            if best_slot:
                day, period = rng.choice(best_slot)
                tt.assign(block, day, period)

        return tt

    def _make_shuffled_individual(self) -> Timetable:
        """Greedy-random with a shuffled block order for diversity."""
        tt  = self._new_timetable()
        rng = self._rng
        order = list(self.free_blocks)
        rng.shuffle(order)

        for block in order:
            for _ in range(int(self.p["max_placement_attempts"])):
                day    = rng.randint(0, self.days - 1)
                period = rng.randint(0, self.ppd - block.duration)
                if tt.is_slot_free(block, day, period):
                    tt.assign(block, day, period)
                    break
        return tt

    def _make_random_individual(self) -> Timetable:
        """Pure random: any structurally valid slot (may have resource conflicts)."""
        tt  = self._new_timetable()
        rng = self._rng

        for block in self.free_blocks:
            for _ in range(int(self.p["max_placement_attempts"])):
                day    = rng.randint(0, self.days - 1)
                period = rng.randint(0, self.ppd - block.duration)
                if tt.can_place(block, day, period):   # structural only
                    tt.assign(block, day, period)
                    break
        return tt

    # ─────────────────────────────────────────────────────────────────────
    # SELECTION
    # ─────────────────────────────────────────────────────────────────────

    def _tournament(self, scored: List[Tuple[Timetable, int]]) -> Timetable:
        k    = int(self.p["tournament_size"])
        pool = self._rng.sample(scored, k)
        return min(pool, key=lambda x: x[1])[0]

    # ─────────────────────────────────────────────────────────────────────
    # CROSSOVER OPERATORS
    # ─────────────────────────────────────────────────────────────────────

    def _crossover(self, p1: Timetable, p2: Timetable) -> Tuple[Timetable, str]:
        """Select crossover operator by current probability and apply."""
        op = self._weighted_choice(self._xo_probs)
        self._xo_calls[op] += 1
        if op == "block_group":
            child = self._xo_block_group(p1, p2)
        elif op == "day_preserving":
            child = self._xo_day_preserving(p1, p2)
        else:
            child = self._xo_uniform(p1, p2)
        return child, op

    def _xo_block_group(self, p1: Timetable, p2: Timetable) -> Timetable:
        """
        Block-group crossover (60% default probability).
        Split classes randomly between parents; blocks belonging to each
        class group inherit from the corresponding parent.
        Preserves classroom-level schedule coherence.
        """
        child = self._new_timetable()
        rng   = self._rng

        # Randomly assign each class to parent 1 or 2
        class_parent: Dict[str, int] = {}
        for cid in self.classes:
            class_parent[cid] = rng.choice((1, 2))

        for block in self.free_blocks:
            # Use the first class to decide donor
            primary_cid = block.class_ids[0] if block.class_ids else None
            donor = p1 if (primary_cid is None or class_parent.get(primary_cid, 1) == 1) else p2
            dp = donor.get_assignment(block.id)
            if dp:
                day, period = dp
                # Only assign if structurally valid in child
                if child.can_place(block, day, period):
                    child.assign(block, day, period)
        return child

    def _xo_day_preserving(self, p1: Timetable, p2: Timetable) -> Timetable:
        """
        Day-preserving crossover (25% default probability).
        Each day's lesson assignments are taken entirely from one parent.
        Preserves daily structure.
        """
        child = self._new_timetable()
        rng   = self._rng

        # For each day, choose a donor parent
        day_donor = [rng.choice((p1, p2)) for _ in range(self.days)]

        for block in self.free_blocks:
            # Find the best donor for this block: prefer the day-donor
            donor = None
            for d, parent in enumerate(day_donor):
                dp = parent.get_assignment(block.id)
                if dp and dp[0] == d:
                    donor = parent
                    break
            if donor is None:
                donor = rng.choice((p1, p2))

            dp = donor.get_assignment(block.id)
            if dp:
                day, period = dp
                if child.can_place(block, day, period):
                    child.assign(block, day, period)
        return child

    def _xo_uniform(self, p1: Timetable, p2: Timetable) -> Timetable:
        """
        Uniform crossover (15% default probability).
        Each gene independently taken from p1 or p2. Maximum diversity.
        """
        child = self._new_timetable()
        rng   = self._rng

        for block in self.free_blocks:
            donor = p1 if rng.random() < 0.5 else p2
            dp = donor.get_assignment(block.id)
            if dp:
                day, period = dp
                if child.can_place(block, day, period):
                    child.assign(block, day, period)
        return child

    # ─────────────────────────────────────────────────────────────────────
    # MUTATION OPERATORS
    # ─────────────────────────────────────────────────────────────────────

    def _mutate(self, tt: Timetable) -> Optional[str]:
        """Apply one mutation operator with probability = mutation_rate."""
        if not self.free_blocks or self._rng.random() >= self.mutation_rate:
            return None
        op = self._weighted_choice(self._mut_probs)
        self._mut_calls[op] += 1
        if op == "move":
            self._mut_move(tt)
        elif op == "swap":
            self._mut_swap(tt)
        else:
            self._mut_day_swap(tt)
        return op

    def _mut_move(self, tt: Timetable):
        """
        Move mutation (60% default).
        Pick one free block; try up to 20 random new slots; assign first valid.
        """
        block  = self._rng.choice(self.free_blocks)
        rng    = self._rng

        for _ in range(20):
            day    = rng.randint(0, self.days - 1)
            period = rng.randint(0, self.ppd - block.duration)
            if tt.is_slot_free(block, day, period):
                tt.assign(block, day, period)
                return

    def _mut_swap(self, tt: Timetable):
        """
        Swap mutation (25% default).
        Pick two free blocks of equal duration; swap slots if conflict-free.
        """
        if len(self.free_blocks) < 2:
            return
        rng = self._rng

        # Try a few times to find two blocks of equal duration
        for _ in range(10):
            b1, b2 = rng.sample(self.free_blocks, 2)
            if b1.duration != b2.duration:
                continue
            dp1 = tt.get_assignment(b1.id)
            dp2 = tt.get_assignment(b2.id)
            if not dp1 or not dp2:
                continue
            day1, p1 = dp1
            day2, p2 = dp2

            # Temporarily unassign both, then check the swap
            tt.unassign(b1)
            tt.unassign(b2)

            ok = (
                tt.is_slot_free(b1, day2, p2)
                and tt.is_slot_free(b2, day1, p1)
            )
            if ok:
                tt.assign(b1, day2, p2)
                tt.assign(b2, day1, p1)
            else:
                # Restore original
                tt.assign(b1, day1, p1)
                tt.assign(b2, day2, p2)
            return

    def _mut_day_swap(self, tt: Timetable):
        """
        Day-swap mutation (15% default).
        Pick two free blocks; swap only their day components, keep time-of-day.
        Useful when daily distribution is off but intra-day layout is good.
        """
        if len(self.free_blocks) < 2:
            return
        rng = self._rng

        for _ in range(10):
            b1, b2 = rng.sample(self.free_blocks, 2)
            if b1.duration != b2.duration:
                continue
            dp1 = tt.get_assignment(b1.id)
            dp2 = tt.get_assignment(b2.id)
            if not dp1 or not dp2:
                continue
            day1, period1 = dp1
            day2, period2 = dp2

            # Swap days, keep periods
            tt.unassign(b1)
            tt.unassign(b2)
            ok = (
                tt.is_slot_free(b1, day2, period1)
                and tt.is_slot_free(b2, day1, period2)
            )
            if ok:
                tt.assign(b1, day2, period1)
                tt.assign(b2, day1, period2)
            else:
                tt.assign(b1, day1, period1)
                tt.assign(b2, day2, period2)
            return

    # ─────────────────────────────────────────────────────────────────────
    # ADAPTIVE CONTROL
    # ─────────────────────────────────────────────────────────────────────

    def _adapt_mutation_rate(self, stagnation: int):
        """
        Increase mutation rate when stagnating; decay back to base otherwise.
        """
        base = float(self.p["base_mutation_rate"])
        cap  = float(self.p["max_mutation_rate"])
        thresh = int(self.p["stagnation_threshold"])

        if stagnation > thresh:
            self.mutation_rate = min(cap, self.mutation_rate * 1.15)
        else:
            self.mutation_rate = max(base, self.mutation_rate * 0.95)

    def _adapt_operators(self, gen: int, prev_best: int, new_best: int, last_op: Optional[str]):
        """
        Credit-based operator selection adaptation.
        Every adaptation_window gens, recompute probabilities from credits.
        """
        improvement = max(0, prev_best - new_best)
        if last_op and improvement > 0:
            if last_op in self._xo_credit:
                self._xo_credit[last_op] += improvement
            elif last_op in self._mut_credit:
                self._mut_credit[last_op] += improvement

        if gen > 0 and gen % self._adaptation_window == 0:
            # Recompute crossover probabilities with epsilon smoothing
            eps = 0.01
            total = sum(self._xo_credit.values()) + eps * len(self._xo_credit)
            for k in self._xo_probs:
                self._xo_probs[k] = (self._xo_credit[k] + eps) / total
            # Recompute mutation probabilities
            total = sum(self._mut_credit.values()) + eps * len(self._mut_credit)
            for k in self._mut_probs:
                self._mut_probs[k] = (self._mut_credit[k] + eps) / total
            # Reset credits
            self._xo_credit  = {k: 0.0 for k in self._xo_probs}
            self._mut_credit = {k: 0.0 for k in self._mut_probs}

    def _weighted_choice(self, probs: Dict[str, float]) -> str:
        """Pick a key from probs dict using its values as relative weights."""
        keys   = list(probs.keys())
        total  = sum(probs.values())
        r      = self._rng.random() * total
        cumul  = 0.0
        for k in keys:
            cumul += probs[k]
            if r <= cumul:
                return k
        return keys[-1]

    # ─────────────────────────────────────────────────────────────────────
    # MAIN EVOLUTION LOOP
    # ─────────────────────────────────────────────────────────────────────

    def evolve(self) -> Tuple[Timetable, List[int]]:
        """
        Run the GA.
        Returns (best_timetable, fitness_history).
        fitness_history[i] = best fitness at end of generation i.
        """
        pop_size   = int(self.p["population_size"])
        elite_size = int(self.p["elite_size"])
        max_gen    = int(self.p["max_generations"])
        stag_limit = int(self.p["stagnation_limit"])

        print(f"  [GA] Building initial population ({pop_size} individuals)...", flush=True)
        t0 = time()
        population = self._init_population()
        print(f"  [GA] Init done in {time() - t0:.1f}s", flush=True)

        history:    List[int]  = []
        stagnation: int        = 0
        prev_best:  int        = 10 ** 9
        last_xo_op: Optional[str] = None

        for gen in range(max_gen):
            # ── Score unevaluated individuals ─────────────────────────────
            for tt in population:
                if tt.fitness is None:
                    tt.fitness = self.checker.calculate_fitness(tt)

            # ── Sort ascending (lower = better) ──────────────────────────
            population.sort(key=lambda tt: tt.fitness)
            best = population[0].fitness
            history.append(best)

            # ── Logging ───────────────────────────────────────────────────
            if gen % 25 == 0 or best < prev_best:
                print(
                    f"  [GA] Gen {gen:>3} | fit={best:>8,} | "
                    f"mut={self.mutation_rate:.2f} | stag={stagnation}",
                    flush=True,
                )

            # ── Perfect solution ─────────────────────────────────────────
            if best == 0:
                print(f"  [GA] Perfect solution at gen {gen}!", flush=True)
                break

            # ── Stagnation tracking ───────────────────────────────────────
            stagnation = stagnation + 1 if best >= prev_best else 0

            # ── Adaptive controls ─────────────────────────────────────────
            self._adapt_mutation_rate(stagnation)
            self._adapt_operators(gen, prev_best, best, last_xo_op)

            if stagnation >= stag_limit:
                print(f"  [GA] Stagnation limit ({stag_limit}) at gen {gen}. Stopping.", flush=True)
                break

            prev_best = best

            # ── Build next generation ─────────────────────────────────────
            # Elites: direct copy (preserves best individuals)
            scored_elites = population[:elite_size]
            new_pop: List[Timetable] = [tt.copy() for tt in scored_elites]

            while len(new_pop) < pop_size:
                p1 = self._tournament([(tt, tt.fitness) for tt in population])
                p2 = self._tournament([(tt, tt.fitness) for tt in population])
                child, xo_op = self._crossover(p1, p2)
                last_xo_op = xo_op
                self._mutate(child)
                new_pop.append(child)

            population = new_pop

        # ── Final evaluation ─────────────────────────────────────────────
        for tt in population:
            if tt.fitness is None:
                tt.fitness = self.checker.calculate_fitness(tt)

        best_tt    = min(population, key=lambda tt: tt.fitness)
        best_score = best_tt.fitness
        print(f"  [GA] Done. Best fitness = {best_score:,}", flush=True)

        return best_tt, history
