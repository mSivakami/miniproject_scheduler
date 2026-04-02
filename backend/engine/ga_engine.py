"""
ga_engine.py — ChromaSchedule Genetic Algorithm Engine
=======================================================
Orchestrates the complete GA pipeline:

  1. Pre-flight validation
  2. Population initialization (DSATUR greedy + shuffled + random)
  3. Generational evolution loop:
     a. Evaluate all dirty chromosomes
     b. Elitism — preserve top chromosomes unchanged
     c. Tournament selection → crossover → mutation
     d. Adaptive operator selection (Pillay 2010)
     e. Adaptive mutation rate (diversity & stagnation tracking)
     f. Progress reporting via callback
  4. Hill climbing post-pass (Schaerf 1999)
  5. Result serialization

Configuration:
  GAConfig dataclass controls all hyperparameters.
  Sensible defaults provided for the ChromaSchedule use case.

Usage:
  from ga_engine import GAEngine, GAConfig
  engine = GAEngine(data, config, constraints)
  result = engine.run(progress_callback=my_fn)
"""

from __future__ import annotations
import random
import time
from dataclasses import dataclass, field
from typing import List, Callable, Optional, Dict, Any

from ga_problem  import ProblemData
from ga_fitness  import Chromosome, ConstraintSettings, evaluate, get_violation_details
from ga_init     import initialize_population
from ga_operators import (apply_crossover, apply_mutation,
                           XO_BLOCK_GROUP, XO_DAY, XO_UNIFORM,
                           MU_SLOT_SWAP, MU_RANDOM_RELOCATE, MU_DAY_SWAP,
                           MU_PERIOD_SHIFT, MU_CLUSTER_RELOCATE)
from ga_adaptive import AdaptiveController
from ga_preflight import preflight_check, hill_climb


# ──────────────────────────────────────────────────────────────────────────────
# GA Configuration
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class GAConfig:
    """
    All tunable hyperparameters for the GA.

    Defaults are tuned for the ChromaSchedule college timetabling problem
    with 50–100 lesson blocks and 5×8 (40-slot) grid.
    """
    population_size:    int   = 200
    max_generations:    int   = 2000
    time_limit_seconds: float = 120.0
    elite_count:        int   = 15
    tournament_size:    int   = 5
    crossover_rate:     float = 0.85   # probability of crossover vs clone
    base_mutation_rate: float = 0.02
    stagnation_limit:   int   = 200    # stop if best fitness doesn't improve
    adaptation_window:  int   = 50

    # Initialization mix
    greedy_pct:  float = 0.30
    shuffled_pct: float = 0.40
    # remainder = random

    # Hill climbing
    hill_climb_enabled:   bool = True
    hill_climb_time_ms:   int  = 5000

    # Progress reporting
    progress_every:  int  = 25   # report every N generations
    verbose:         bool = True

    # Seed (None = random)
    seed: Optional[int] = None

    # Fast mode: skip soft constraints in early generations
    fast_mode_generations: int = 0  # set > 0 to use hard-only fitness for first N gens


# ──────────────────────────────────────────────────────────────────────────────
# GA Result
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class GAResult:
    """
    The output of a GA run.
    """
    # The best chromosome found
    chromosome:      Chromosome

    # Quality metrics
    fitness:         float
    hard_violations: int
    soft_violations: int

    # Run statistics
    generations:     int
    time_ms:         int
    status:          str     # "optimal" | "time_limit" | "stagnation" | "preflight_failed"

    # Pre-flight report
    preflight_ok:    bool
    preflight_errors: List[str] = field(default_factory=list)
    preflight_warnings: List[str] = field(default_factory=list)

    # Violation details (populated on request)
    violation_details: List[dict] = field(default_factory=list)

    # Convergence history: list of (generation, best_fitness, hard_violations)
    history:         List[tuple] = field(default_factory=list)

    @property
    def is_feasible(self) -> bool:
        return self.hard_violations == 0


# ──────────────────────────────────────────────────────────────────────────────
# GA Engine
# ──────────────────────────────────────────────────────────────────────────────

class GAEngine:
    """
    Main GA engine. Instantiate, configure, then call .run().
    """

    def __init__(
        self,
        data:        ProblemData,
        config:      GAConfig,
        constraints: ConstraintSettings,
    ):
        self.data        = data
        self.config      = config
        self.constraints = constraints
        self.rng         = random.Random(config.seed)

    def run(
        self,
        progress_callback: Optional[Callable[[int, float, int, int], None]] = None,
    ) -> GAResult:
        """
        Execute the full GA pipeline.

        progress_callback(generation, best_fitness, hard_violations, generations_total)
        Called every `config.progress_every` generations.

        Returns GAResult.
        """
        cfg  = self.config
        data = self.data
        cs   = self.constraints

        start_time = time.perf_counter()

        # ── Step 1: Pre-flight check ──────────────────────────────────────────
        pf = preflight_check(data)
        if cfg.verbose:
            pf.print_report()

        if not pf.feasible:
            return GAResult(
                chromosome=Chromosome(genes=[]),
                fitness=0.0,
                hard_violations=-1,
                soft_violations=-1,
                generations=0,
                time_ms=0,
                status="preflight_failed",
                preflight_ok=False,
                preflight_errors=pf.errors,
                preflight_warnings=pf.warnings,
            )

        # ── Step 2: Initialize population ─────────────────────────────────────
        if cfg.verbose:
            print(f"\n  Initializing population ({cfg.population_size} chromosomes)...")
            print(f"  Blocks: {len(data.blocks)}, Genes per chromosome: {data.gene_count}")

        # Use hard-only constraints for fast-mode initialization
        init_cs = ConstraintSettings.all_hard_only() if cfg.fast_mode_generations > 0 else cs

        population = initialize_population(
            data=data,
            cs=init_cs,
            population_size=cfg.population_size,
            greedy_pct=cfg.greedy_pct,
            shuffled_pct=cfg.shuffled_pct,
            rng=self.rng,
            evaluate_now=True,
        )

        # ── Step 3: Evolution loop ────────────────────────────────────────────
        adaptive    = AdaptiveController(adaptation_window=cfg.adaptation_window)
        best_chr    = population[0].copy()
        best_fitness_ever = population[0].fitness
        stagnation  = 0
        generation  = 0
        status      = "max_generations"  # default status
        history     = [(0, population[0].fitness, population[0].hard_violations)]

        if cfg.verbose:
            _log_gen(0, population[0], cfg.max_generations)

        while generation < cfg.max_generations:
            # Time check
            elapsed_s = time.perf_counter() - start_time
            if elapsed_s >= cfg.time_limit_seconds:
                status = "time_limit"
                break

            # Switch to full constraints after fast-mode warmup
            active_cs = cs
            if cfg.fast_mode_generations > 0 and generation == cfg.fast_mode_generations:
                if cfg.verbose:
                    print(f"  Gen {generation}: switching to full constraint evaluation")
                for chr_ in population:
                    chr_.dirty = True

            # ── Evaluate dirty chromosomes ────────────────────────────────────
            for chr_ in population:
                if chr_.dirty:
                    chr_.fitness = evaluate(chr_, data, active_cs)

            # ── Sort by fitness (best first) ──────────────────────────────────
            population.sort(key=lambda c: c.fitness, reverse=True)

            current_best = population[0]

            # Update global best
            if current_best.fitness > best_fitness_ever + 0.01:
                best_fitness_ever = current_best.fitness
                best_chr = current_best.copy()
                stagnation = 0
            else:
                stagnation += 1

            # Progress reporting
            if generation % cfg.progress_every == 0:
                if cfg.verbose:
                    _log_gen(generation, current_best, cfg.max_generations)
                history.append((generation, current_best.fitness,
                                 current_best.hard_violations))
                if progress_callback:
                    progress_callback(generation, current_best.fitness,
                                      current_best.hard_violations,
                                      cfg.max_generations)

            # Termination: perfect solution (only after at least 1 full generation)
            if generation > 0 and current_best.hard_violations == 0 and current_best.soft_violations == 0:
                status = "optimal"
                break

            # Termination: stagnation
            if stagnation >= cfg.stagnation_limit:
                status = "stagnation"
                break

            # ── Adaptive parameter update ────────────────────────────────────
            adaptive.adapt(generation, current_best.fitness, population)
            mutation_rate = adaptive.mutation_rate

            # ── Build next generation ─────────────────────────────────────────
            next_pop: List[Chromosome] = []

            # Elitism
            elite_count = min(cfg.elite_count, len(population))
            for i in range(elite_count):
                next_pop.append(population[i].copy())

            # Fill via crossover + mutation
            while len(next_pop) < cfg.population_size:
                # Tournament selection
                p1 = _tournament_select(population, cfg.tournament_size, self.rng)
                p2 = _tournament_select(population, cfg.tournament_size, self.rng)

                # Crossover
                if self.rng.random() < cfg.crossover_rate:
                    xo_op = adaptive.select_crossover_op(self.rng)
                    child = apply_crossover(p1, p2, xo_op, data, self.rng)
                    # Evaluate child to get its fitness after crossover
                    child.fitness = evaluate(child, data, active_cs)
                    prev_fitness  = child.fitness
                    adaptive.record_crossover(xo_op,
                                              prev_fitness - (p1.fitness + p2.fitness) / 2)
                else:
                    child = p1.copy()
                    prev_fitness = child.fitness

                # Mutation — always re-evaluate if mutation was applied
                if self.rng.random() < mutation_rate:
                    mu_op = adaptive.select_mutation_op(self.rng)
                    apply_mutation(child, mu_op, data, self.rng)

                    if child.dirty:
                        # apply_mutation set dirty=True, so re-evaluate
                        child.fitness = evaluate(child, data, active_cs)
                        adaptive.record_mutation(mu_op, child.fitness - prev_fitness)
                    # If dirty is still False, mutation was a no-op; fitness unchanged

                next_pop.append(child)

            population = next_pop
            generation += 1

        # ── Final evaluation ──────────────────────────────────────────────────
        # Secondary evaluate function currently disabled to save execution time
        for chr_ in population:
            pass

        population.sort(key=lambda c: c.fitness, reverse=True)
        if population[0].fitness > best_chr.fitness:
            best_chr = population[0].copy()

        # Re-evaluate best with full constraints to get final counts
        best_chr.fitness = evaluate(best_chr, data, cs)

        time_ms = int((time.perf_counter() - start_time) * 1000)

        if cfg.verbose:
            print(f"\n  {'─'*60}")
            print(f"  GA complete: {status} @ gen {generation}")
            print(f"  Best fitness: {best_chr.fitness:.1f} | "
                  f"Hard: {best_chr.hard_violations} | "
                  f"Soft: {best_chr.soft_violations} | "
                  f"Time: {time_ms}ms")
            print(f"  {'─'*60}\n")
            if cfg.adaptation_window:
                print(f"  Adaptive controller final state:")
                print(adaptive.summary())

        # ── Step 4: Hill climbing ─────────────────────────────────────────────
        if cfg.hill_climb_enabled and best_chr.hard_violations == 0:
            if cfg.verbose:
                print(f"\n  Running hill climbing (budget: {cfg.hill_climb_time_ms}ms)...")
            pre_hc = best_chr.fitness
            best_chr, swaps = hill_climb(
                best_chr, data, cs,
                time_limit_ms=cfg.hill_climb_time_ms,
                verbose=cfg.verbose,
            )
            if cfg.verbose:
                print(f"  Hill climbing: {swaps} improvements, "
                      f"fitness {pre_hc:.1f} → {best_chr.fitness:.1f}")

        # ── Step 5: Gather violation details ─────────────────────────────────
        violation_details = get_violation_details(best_chr, data, cs)

        return GAResult(
            chromosome=best_chr,
            fitness=best_chr.fitness,
            hard_violations=best_chr.hard_violations,
            soft_violations=best_chr.soft_violations,
            generations=generation,
            time_ms=time_ms,
            status=status,
            preflight_ok=True,
            preflight_errors=pf.errors,
            preflight_warnings=pf.warnings,
            violation_details=violation_details,
            history=history,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _tournament_select(
    population: List[Chromosome],
    tournament_size: int,
    rng: random.Random,
) -> Chromosome:
    """Return the best chromosome from a random tournament."""
    k = min(tournament_size, len(population))
    contestants = rng.sample(population, k)
    return max(contestants, key=lambda c: c.fitness)


def _log_gen(generation: int, best: Chromosome, max_gen: int):
    bar_len = 20
    pct     = generation / max_gen if max_gen > 0 else 0
    filled  = int(bar_len * pct)
    bar     = "█" * filled + "░" * (bar_len - filled)
    print(f"  Gen {generation:>5} [{bar}] "
          f"fit={best.fitness:>10.1f}  "
          f"hard={best.hard_violations:>3}  "
          f"soft={best.soft_violations:>3}")