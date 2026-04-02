"""
ga_adaptive.py — Adaptive Parameter Control
============================================
Implements credit-based adaptive operator selection per Pillay (2010)
"Evolving Hyper-Heuristics for a Timetabling Problem."

Core idea:
  - Track how much fitness improvement each operator has contributed
  - Every `window` generations, recompute operator probabilities
    proportional to their average credit
  - Add a small epsilon to prevent any operator from reaching 0%

Also tracks:
  - Population diversity (Hamming distance on day assignments)
  - Stagnation (improvement rate over last window)
  - Adaptive mutation rate: increase if diversity low or stagnation detected
"""

from __future__ import annotations
import random
from typing import List
from ga_fitness import Chromosome
from ga_operators import (XO_BLOCK_GROUP, XO_DAY, XO_UNIFORM,
                           MU_SLOT_SWAP, MU_RANDOM_RELOCATE, MU_DAY_SWAP,
                           MU_PERIOD_SHIFT, MU_CLUSTER_RELOCATE)


# ──────────────────────────────────────────────────────────────────────────────
# Operator Statistics Tracker
# ──────────────────────────────────────────────────────────────────────────────

class OperatorStats:
    __slots__ = ("credit", "uses")

    def __init__(self):
        self.credit = 0.0
        self.uses   = 0

    def record(self, improvement: float):
        self.credit += max(0.0, improvement)   # only positive credit counts
        self.uses   += 1

    @property
    def avg_credit(self) -> float:
        return self.credit / self.uses if self.uses > 0 else 0.0

    def reset(self):
        self.credit = 0.0
        self.uses   = 0


# ──────────────────────────────────────────────────────────────────────────────
# Adaptive Controller
# ──────────────────────────────────────────────────────────────────────────────

class AdaptiveController:
    """
    Tracks operator performance and adapts selection probabilities.

    Crossover operators: [XO_BLOCK_GROUP, XO_DAY, XO_UNIFORM]
    Mutation operators:  [MU_SLOT_SWAP, MU_RANDOM_RELOCATE, MU_DAY_SWAP,
                          MU_PERIOD_SHIFT, MU_CLUSTER_RELOCATE]
    """

    # Initial operator probabilities (from 04_GA_LOGIC.md)
    INIT_CROSSOVER_RATES = [0.60, 0.25, 0.15]
    INIT_MUTATION_RATES  = [0.40, 0.25, 0.20, 0.10, 0.05]

    # Diversity and stagnation thresholds
    DIVERSITY_THRESHOLD   = 0.10   # < 10% day-assignment difference → low diversity
    STAGNATION_THRESHOLD  = 0.001  # < 0.1% improvement rate → stagnation

    # Mutation rate bounds
    MUT_RATE_BASE  = 0.02
    MUT_RATE_MIN   = 0.005
    MUT_RATE_MAX   = 0.15

    def __init__(self, adaptation_window: int = 50):
        self.window = adaptation_window

        # Crossover stats
        self.xo_stats = [OperatorStats() for _ in range(3)]
        self.xo_rates = list(self.INIT_CROSSOVER_RATES)

        # Mutation stats
        self.mu_stats = [OperatorStats() for _ in range(5)]
        self.mu_rates = list(self.INIT_MUTATION_RATES)

        # Stagnation tracking
        self._fitness_history: List[float] = []

        # Current mutation rate
        self.mutation_rate = self.MUT_RATE_BASE

    # ── Rate selection ──────────────────────────────────────────────────────

    def select_crossover_op(self, rng: random.Random) -> int:
        return _weighted_choice(self.xo_rates, rng)

    def select_mutation_op(self, rng: random.Random) -> int:
        return _weighted_choice(self.mu_rates, rng)

    # ── Credit recording ────────────────────────────────────────────────────

    def record_crossover(self, op: int, improvement: float):
        self.xo_stats[op].record(improvement)

    def record_mutation(self, op: int, improvement: float):
        self.mu_stats[op].record(improvement)

    # ── Adaptation ──────────────────────────────────────────────────────────

    def adapt(self, generation: int, best_fitness: float, population: List[Chromosome]):
        """Call once per generation. Updates rates every `window` generations."""
        self._fitness_history.append(best_fitness)

        if generation % self.window != 0 or generation == 0:
            return

        # ── Adapt crossover rates ─────────────────────────────────────────
        self.xo_rates = _normalize_credits(self.xo_stats, self.xo_rates)
        for s in self.xo_stats:
            s.reset()

        # ── Adapt mutation rates ──────────────────────────────────────────
        self.mu_rates = _normalize_credits(self.mu_stats, self.mu_rates)
        for s in self.mu_stats:
            s.reset()

        # ── Adapt mutation rate magnitude ─────────────────────────────────
        diversity       = _compute_diversity(population)
        improvement     = _compute_improvement_rate(self._fitness_history)

        if diversity < self.DIVERSITY_THRESHOLD:
            # Low diversity → inject mutations aggressively
            self.mutation_rate = min(self.MUT_RATE_MAX, self.mutation_rate * 3.0)
        elif improvement < self.STAGNATION_THRESHOLD:
            # Stagnating → mild mutation boost
            self.mutation_rate = min(self.MUT_RATE_MAX, self.mutation_rate * 1.5)
        else:
            # Good progress → decay back toward base rate
            self.mutation_rate = max(self.MUT_RATE_BASE,
                                     self.mutation_rate * 0.95)

        # Clamp
        self.mutation_rate = max(self.MUT_RATE_MIN,
                                 min(self.MUT_RATE_MAX, self.mutation_rate))

        # Keep only last 2*window fitness values
        if len(self._fitness_history) > 2 * self.window:
            self._fitness_history = self._fitness_history[-2 * self.window:]

    def summary(self) -> str:
        xo_names = ["BlockGroup", "Day", "Uniform"]
        mu_names = ["SlotSwap", "Relocate", "DaySwap", "PeriodShift", "Cluster"]
        lines = [
            f"  mutation_rate: {self.mutation_rate:.4f}",
            "  crossover rates: " + ", ".join(f"{n}={r:.2f}"
                                               for n, r in zip(xo_names, self.xo_rates)),
            "  mutation rates:  " + ", ".join(f"{n}={r:.2f}"
                                               for n, r in zip(mu_names, self.mu_rates)),
        ]
        return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# Internal utilities
# ──────────────────────────────────────────────────────────────────────────────

EPSILON = 0.01   # prevents any rate from hitting 0


def _normalize_credits(stats: List[OperatorStats], current_rates: List[float]) -> List[float]:
    """
    Recompute operator rates proportional to average credit.
    If all credits are 0 (no improvement from any operator), keep current rates.
    Uses epsilon smoothing so no operator reaches 0.
    """
    credits = [s.avg_credit + EPSILON for s in stats]
    total   = sum(credits)
    new_rates = [c / total for c in credits]
    return new_rates


def _weighted_choice(rates: List[float], rng: random.Random) -> int:
    """Select an index based on probability weights."""
    r    = rng.random()
    cumsum = 0.0
    for i, rate in enumerate(rates):
        cumsum += rate
        if r <= cumsum:
            return i
    return len(rates) - 1  # fallback to last


def _compute_diversity(population: List[Chromosome]) -> float:
    """
    Estimate population diversity by sampling 20 pairs.
    Returns average fraction of genes with different day assignments.
    """
    if len(population) < 2:
        return 1.0

    sample_size = min(20, len(population))
    indices     = list(range(len(population)))
    pairs_tried = 0
    total_diff  = 0
    n_genes     = len(population[0].genes)

    if n_genes == 0:
        return 0.0

    # Use deterministic sampling for reproducibility
    for i in range(0, min(sample_size * 2, len(indices) - 1), 2):
        ia = indices[i]
        ib = indices[i + 1]
        ca = population[ia]
        cb = population[ib]
        diff = sum(1 for j in range(min(len(ca.genes), len(cb.genes)))
                   if ca.genes[j].day != cb.genes[j].day)
        total_diff += diff
        pairs_tried += 1

    return (total_diff / (pairs_tried * n_genes)) if pairs_tried > 0 else 0.0


def _compute_improvement_rate(history: List[float]) -> float:
    """
    Compute improvement rate over the last half of the history window.
    Returns relative improvement (fraction of current fitness).
    """
    if len(history) < 10:
        return 1.0   # assume improving early on

    recent   = history[-5:]
    older    = history[-10:-5]
    recent_best  = max(recent)
    older_best   = max(older)

    if older_best <= 0:
        return 1.0

    return abs(recent_best - older_best) / abs(older_best)