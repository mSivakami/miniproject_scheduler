# -*- coding: utf-8 -*-
"""
ga_operators.py — Crossover & Mutation Operators
=================================================
Implements all genetic operators with proper locked-gene protection.

CROSSOVER OPERATORS (3 types per Sørensen & Dahms 2014):
  XO1: Block-Group Crossover  (primary, 60%)
       — Swap entire blocks that share a classroom between parents
       — Preserves classroom schedule coherence
       — Best for maintaining valid class-level timetables

  XO2: Day-Preserving Crossover  (25%)
       — Randomly assign each day's genes from one of the two parents
       — Preserves day-level structure (useful mid-evolution)

  XO3: Uniform Gene Crossover  (15%, diversity injection)
       — Each gene independently taken from p1 or p2 with 50% probability
       — Maximally disruptive — good for escaping local optima

MUTATION OPERATORS (5 types per Pillay 2010):
  M1: Slot Swap  (40%)
       — Swap (day, period) between two randomly selected non-locked genes
       — Most common; low disruption; fixes local clashes

  M2: Random Relocate  (25%)
       — Assign a gene to a completely new random valid slot
       — Medium disruption; helps escape local optima

  M3: Day Swap  (20%)
       — Swap only the day component between two genes (keep periods)
       — Useful when time-of-day is good but day distribution is off

  M4: Period Shift  (10%)
       — Shift a gene's start_period by ±1
       — Fine-grained adjustment; useful late in search

  M5: Block Cluster Relocate  (5%)
       — Move all occurrences of a block to different days
       — High disruption; used when block has persistent clashes

All operators: NEVER modify locked genes.
"""

from __future__ import annotations
import random
from typing import List, Optional
from ga_problem import ProblemData
from ga_fitness import Gene, Chromosome


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _pick_unlocked(chr_: Chromosome, data: ProblemData, rng: random.Random) -> Optional[int]:
    """Return index of a random unlocked gene, or None if all are locked."""
    unlocked = [i for i, g in enumerate(chr_.genes)
                if not data.blocks[g.block_idx].is_locked]
    return rng.choice(unlocked) if unlocked else None


def _pick_two_unlocked(
    chr_: Chromosome, data: ProblemData, rng: random.Random
) -> Optional[tuple]:
    """Return (idx_a, idx_b) of two distinct unlocked genes, or None."""
    unlocked = [i for i, g in enumerate(chr_.genes)
                if not data.blocks[g.block_idx].is_locked]
    if len(unlocked) < 2:
        return None
    a, b = rng.sample(unlocked, 2)
    return a, b


def _valid_slots_for_block(block_idx: int, data: ProblemData) -> List[tuple]:
    """Fast valid-slot enumeration (same logic as ga_init)."""
    block      = data.blocks[block_idx]
    if block.is_locked:
        return [(block.locked_day, block.locked_period)]
    periods    = data.periods
    working    = data.working_mask
    break_mask = data.break_mask
    valid      = []
    for day in range(data.days):
        for sp in range(periods - block.duration + 1):
            ok = True
            for off in range(block.duration):
                slot = day * periods + sp + off
                if not (working & (1 << slot)) or (break_mask & (1 << slot)):
                    ok = False; break
            if ok:
                valid.append((day, sp))
    return valid


def _copy_genes(genes: List[Gene]) -> List[Gene]:
    return [Gene(g.block_idx, g.occurrence, g.day, g.start_period) for g in genes]


# ──────────────────────────────────────────────────────────────────────────────
# XO1: Block-Group Crossover
# ──────────────────────────────────────────────────────────────────────────────

def crossover_block_group(
    p1: Chromosome, p2: Chromosome, data: ProblemData, rng: random.Random
) -> Chromosome:
    """
    Partition classes randomly; genes for classes in set-A come from p1,
    genes for classes in set-B come from p2.
    Locked genes always from p1 (canonical source).
    """
    n_classes = len(data.classes)
    if n_classes == 0:
        return crossover_uniform(p1, p2, data, rng)

    # Randomly split classes between two parents
    class_indices = list(range(n_classes))
    rng.shuffle(class_indices)
    split = max(1, n_classes // 2)
    from_p1_classes = set(class_indices[:split])

    child_genes = []
    for i, g1 in enumerate(p1.genes):
        g2    = p2.genes[i]
        block = data.blocks[g1.block_idx]

        if block.is_locked:
            child_genes.append(Gene(g1.block_idx, g1.occurrence, g1.day, g1.start_period))
            continue

        # Use p1 if the block's primary class is in from_p1_classes
        use_p1 = any(ci in from_p1_classes for ci in block.class_indices)
        src    = g1 if use_p1 else g2
        child_genes.append(Gene(src.block_idx, src.occurrence, src.day, src.start_period))

    return Chromosome(genes=child_genes)


# ──────────────────────────────────────────────────────────────────────────────
# XO2: Day-Preserving Crossover
# ──────────────────────────────────────────────────────────────────────────────

def crossover_day(
    p1: Chromosome, p2: Chromosome, data: ProblemData, rng: random.Random
) -> Chromosome:
    """
    Randomly select which days' assignments come from p1 vs p2.
    Each day independently flipped with 50% probability.
    """
    day_from_p1 = [rng.random() < 0.5 for _ in range(data.days)]

    child_genes = []
    for i, g1 in enumerate(p1.genes):
        g2    = p2.genes[i]
        block = data.blocks[g1.block_idx]

        if block.is_locked:
            child_genes.append(Gene(g1.block_idx, g1.occurrence, g1.day, g1.start_period))
            continue

        # Use gene from the parent that "owns" the day in p1
        if day_from_p1[g1.day]:
            child_genes.append(Gene(g1.block_idx, g1.occurrence, g1.day, g1.start_period))
        else:
            child_genes.append(Gene(g2.block_idx, g2.occurrence, g2.day, g2.start_period))

    return Chromosome(genes=child_genes)


# ──────────────────────────────────────────────────────────────────────────────
# XO3: Uniform Gene Crossover
# ──────────────────────────────────────────────────────────────────────────────

def crossover_uniform(
    p1: Chromosome, p2: Chromosome, data: ProblemData, rng: random.Random
) -> Chromosome:
    """
    Each gene independently taken from p1 (50%) or p2 (50%).
    Most disruptive crossover — maximum diversity injection.
    """
    child_genes = []
    for i, g1 in enumerate(p1.genes):
        g2    = p2.genes[i]
        block = data.blocks[g1.block_idx]

        if block.is_locked:
            child_genes.append(Gene(g1.block_idx, g1.occurrence, g1.day, g1.start_period))
            continue

        src = g1 if rng.random() < 0.5 else g2
        child_genes.append(Gene(src.block_idx, src.occurrence, src.day, src.start_period))

    return Chromosome(genes=child_genes)


# ──────────────────────────────────────────────────────────────────────────────
# M1: Slot Swap Mutation
# ──────────────────────────────────────────────────────────────────────────────

def mutate_slot_swap(chr_: Chromosome, data: ProblemData, rng: random.Random) -> None:
    """
    Swap the (day, start_period) of two randomly selected unlocked genes.
    Both genes must satisfy their new positions (duration fit check).
    Only performs the swap if both positions are valid for both blocks.
    """
    pair = _pick_two_unlocked(chr_, data, rng)
    if pair is None:
        return
    ia, ib = pair
    ga, gb = chr_.genes[ia], chr_.genes[ib]
    ba = data.blocks[ga.block_idx]
    bb = data.blocks[gb.block_idx]

    # Check: ga's block fits at gb's slot
    if gb.start_period + ba.duration > data.periods:
        return
    # Check: gb's block fits at ga's slot
    if ga.start_period + bb.duration > data.periods:
        return

    # Validate no break crossing for each
    def valid_placement(block_idx, day, sp):
        block = data.blocks[block_idx]
        for off in range(block.duration):
            slot = day * data.periods + sp + off
            bit  = 1 << slot
            if not (data.working_mask & bit) or (data.break_mask & bit):
                return False
        return True

    if not valid_placement(ga.block_idx, gb.day, gb.start_period):
        return
    if not valid_placement(gb.block_idx, ga.day, ga.start_period):
        return

    # Perform swap
    ga.day, gb.day = gb.day, ga.day
    ga.start_period, gb.start_period = gb.start_period, ga.start_period
    chr_.dirty = True


# ──────────────────────────────────────────────────────────────────────────────
# M2: Random Relocate Mutation
# ──────────────────────────────────────────────────────────────────────────────

def mutate_random_relocate(chr_: Chromosome, data: ProblemData, rng: random.Random) -> None:
    """
    Assign a randomly selected unlocked gene to a completely random valid slot.
    """
    idx = _pick_unlocked(chr_, data, rng)
    if idx is None:
        return

    gene  = chr_.genes[idx]
    valid = _valid_slots_for_block(gene.block_idx, data)
    if not valid:
        return

    day, sp       = rng.choice(valid)
    gene.day      = day
    gene.start_period = sp
    chr_.dirty = True


# ──────────────────────────────────────────────────────────────────────────────
# M3: Day Swap Mutation
# ──────────────────────────────────────────────────────────────────────────────

def mutate_day_swap(chr_: Chromosome, data: ProblemData, rng: random.Random) -> None:
    """
    Swap only the day of two randomly selected unlocked genes.
    Keep their start_period unchanged (same time-of-day, different day).
    Validates that both new placements are legal.
    """
    pair = _pick_two_unlocked(chr_, data, rng)
    if pair is None:
        return
    ia, ib = pair
    ga, gb = chr_.genes[ia], chr_.genes[ib]

    def valid_placement(block_idx, day, sp):
        block = data.blocks[block_idx]
        if sp + block.duration > data.periods:
            return False
        for off in range(block.duration):
            slot = day * data.periods + sp + off
            bit  = 1 << slot
            if not (data.working_mask & bit) or (data.break_mask & bit):
                return False
        return True

    if not valid_placement(ga.block_idx, gb.day, ga.start_period):
        return
    if not valid_placement(gb.block_idx, ga.day, gb.start_period):
        return

    ga.day, gb.day = gb.day, ga.day
    chr_.dirty = True


# ──────────────────────────────────────────────────────────────────────────────
# M4: Period Shift Mutation
# ──────────────────────────────────────────────────────────────────────────────

def mutate_period_shift(chr_: Chromosome, data: ProblemData, rng: random.Random) -> None:
    """
    Shift a gene's start_period by ±1 (or ±2 with 10% chance).
    Validates the new position is fully legal.
    """
    idx = _pick_unlocked(chr_, data, rng)
    if idx is None:
        return

    gene  = chr_.genes[idx]
    block = data.blocks[gene.block_idx]
    shift = rng.choice([-2, -1, 1, 2]) if rng.random() < 0.1 else rng.choice([-1, 1])

    new_sp = gene.start_period + shift
    if new_sp < 0 or new_sp + block.duration > data.periods:
        return

    # Validate no break crossing
    for off in range(block.duration):
        slot = gene.day * data.periods + new_sp + off
        bit  = 1 << slot
        if not (data.working_mask & bit) or (data.break_mask & bit):
            return

    gene.start_period = new_sp
    chr_.dirty = True


# ──────────────────────────────────────────────────────────────────────────────
# M5: Block Cluster Relocate Mutation
# ──────────────────────────────────────────────────────────────────────────────

def mutate_cluster_relocate(chr_: Chromosome, data: ProblemData, rng: random.Random) -> None:
    """
    Select a random unlocked block and move ALL its occurrences to new random days.
    The periods (time-of-day) are preserved; only days are changed.
    Spreads a heavily-clashing block across the week.
    """
    # Find unlocked block indices
    unlocked_blocks = list({g.block_idx for g in chr_.genes
                            if not data.blocks[g.block_idx].is_locked})
    if not unlocked_blocks:
        return

    target_block = rng.choice(unlocked_blocks)
    block        = data.blocks[target_block]

    # Get available days for this block's period positions
    def valid_day(day, sp):
        for off in range(block.duration):
            slot = day * data.periods + sp + off
            bit  = 1 << slot
            if not (data.working_mask & bit) or (data.break_mask & bit):
                return False
        return True

    # Reassign all occurrences to new days
    for gene in chr_.genes:
        if gene.block_idx != target_block:
            continue
        valid_days = [d for d in range(data.days) if valid_day(d, gene.start_period)]
        if valid_days:
            gene.day = rng.choice(valid_days)
            chr_.dirty = True


# ──────────────────────────────────────────────────────────────────────────────
# Operator Dispatch
# ──────────────────────────────────────────────────────────────────────────────

# Crossover operator IDs
XO_BLOCK_GROUP = 0
XO_DAY         = 1
XO_UNIFORM     = 2

# Mutation operator IDs
MU_SLOT_SWAP         = 0
MU_RANDOM_RELOCATE   = 1
MU_DAY_SWAP          = 2
MU_PERIOD_SHIFT      = 3
MU_CLUSTER_RELOCATE  = 4


def apply_crossover(
    p1: Chromosome, p2: Chromosome,
    op: int,
    data: ProblemData,
    rng: random.Random,
) -> Chromosome:
    if op == XO_BLOCK_GROUP:
        return crossover_block_group(p1, p2, data, rng)
    elif op == XO_DAY:
        return crossover_day(p1, p2, data, rng)
    else:
        return crossover_uniform(p1, p2, data, rng)


def apply_mutation(
    chr_: Chromosome,
    op:   int,
    data: ProblemData,
    rng:  random.Random,
) -> None:
    if op == MU_SLOT_SWAP:
        mutate_slot_swap(chr_, data, rng)
    elif op == MU_RANDOM_RELOCATE:
        mutate_random_relocate(chr_, data, rng)
    elif op == MU_DAY_SWAP:
        mutate_day_swap(chr_, data, rng)
    elif op == MU_PERIOD_SHIFT:
        mutate_period_shift(chr_, data, rng)
    else:
        mutate_cluster_relocate(chr_, data, rng)