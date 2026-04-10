# -*- coding: utf-8 -*-
"""
ga_timetable.py — Timetable Builder & View Generator
=====================================================
Converts a GA result (Chromosome + ProblemData) into human-readable and
machine-readable timetable structures.

Provides three view types:
  - by_class   : for each class, a day×period grid
  - by_teacher : for each teacher, a day×period grid
  - by_room    : for each room, a day×period grid

Each cell in a grid is a TimetableCell (or None for empty/break).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from ga_fitness  import Chromosome, Gene
from ga_problem  import ProblemData
from ga_engine   import GAResult


# ──────────────────────────────────────────────────────────────────────────────
# Timetable Cell
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class TimetableCell:
    """
    A single cell in a timetable grid.

    day          : 0-indexed day
    period       : 0-indexed period (start period of block)
    span         : how many periods this cell occupies (1, 2, or 3)
    block_id     : original LessonBlock ID
    subject_id   : subject being taught
    subject_name : human-readable subject name
    teacher_ids  : list of teacher IDs
    teacher_names: list of teacher names
    class_ids    : list of class IDs
    room_ids     : list of room IDs
    is_lab       : True if this is a lab block
    is_locked    : True if this is a locked/pinned block
    """
    day:           int
    period:        int
    span:          int
    block_id:      str
    subject_id:    str
    subject_name:  str
    teacher_ids:   List[str]
    teacher_names: List[str]
    class_ids:     List[str]
    room_ids:      List[str]
    is_lab:        bool
    is_locked:     bool

    def short_label(self) -> str:
        """Compact display label for terminal/grid display."""
        return self.subject_name[:14] if self.subject_name else self.subject_id[:14]

    def teacher_label(self) -> str:
        names = self.teacher_names or self.teacher_ids
        return ", ".join(names) if names else "—"

    def room_label(self) -> str:
        return ", ".join(self.room_ids) if self.room_ids else "—"


@dataclass
class TimetableGrid:
    """
    A day × period grid of TimetableCell (or None).

    grid[day][period] = TimetableCell or None
    """
    entity_id:   str
    entity_name: str
    entity_type: str   # "class" | "teacher" | "room"
    days:        int
    periods:     int
    grid:        List[List[Optional[TimetableCell]]]  # [day][period]

    def get_cell(self, day: int, period: int) -> Optional[TimetableCell]:
        if 0 <= day < self.days and 0 <= period < self.periods:
            return self.grid[day][period]
        return None


@dataclass
class Timetable:
    """
    Complete timetable with all view types.
    """
    fitness:         float
    hard_violations: int
    soft_violations: int
    generations:     int
    time_ms:         int
    status:          str

    by_class:   Dict[str, TimetableGrid] = field(default_factory=dict)
    by_teacher: Dict[str, TimetableGrid] = field(default_factory=dict)
    by_room:    Dict[str, TimetableGrid] = field(default_factory=dict)

    # Flat list of all cells (for JSON export)
    all_cells:  List[TimetableCell] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────────────
# Builder
# ──────────────────────────────────────────────────────────────────────────────

def build_timetable(result: GAResult, data: ProblemData) -> Timetable:
    """
    Convert a GAResult into a structured Timetable with all views.
    """
    days    = data.days
    periods = data.periods
    chr_    = result.chromosome

    # ── Build all cells from genes ────────────────────────────────────────────
    all_cells: List[TimetableCell] = []

    for gene in chr_.genes:
        block = data.blocks[gene.block_idx]

        teacher_ids   = [data.teachers[ti].id   for ti in block.teacher_indices]
        teacher_names = [data.orig_teachers[tid].name
                         for tid in teacher_ids
                         if tid in data.orig_teachers]
        class_ids = [data.classes[ci].id for ci in block.class_indices]
        room_ids  = [data.rooms[ri].id   for ri in block.room_indices]

        cell = TimetableCell(
            day=gene.day,
            period=gene.start_period,
            span=block.duration,
            block_id=block.id,
            subject_id=block.subject_id,
            subject_name=block.subject_name,
            teacher_ids=teacher_ids,
            teacher_names=teacher_names,
            class_ids=class_ids,
            room_ids=room_ids,
            is_lab=block.is_lab,
            is_locked=block.is_locked,
        )
        all_cells.append(cell)

    # ── Build view grids ──────────────────────────────────────────────────────
    by_class   = _build_views_for("class",   data, all_cells, days, periods)
    by_teacher = _build_views_for("teacher", data, all_cells, days, periods)
    by_room    = _build_views_for("room",    data, all_cells, days, periods)

    return Timetable(
        fitness=result.fitness,
        hard_violations=result.hard_violations,
        soft_violations=result.soft_violations,
        generations=result.generations,
        time_ms=result.time_ms,
        status=result.status,
        by_class=by_class,
        by_teacher=by_teacher,
        by_room=by_room,
        all_cells=all_cells,
    )


def _build_views_for(
    view_type: str,
    data: ProblemData,
    all_cells: List[TimetableCell],
    days: int,
    periods: int,
) -> Dict[str, TimetableGrid]:
    """Build grids for a given view type: 'class', 'teacher', or 'room'."""
    grids: Dict[str, TimetableGrid] = {}

    # Get all entity IDs and names for this view type
    if view_type == "class":
        entities = [(c.id, data.orig_classes.get(c.id, type('', (), {'name': c.id})()).name
                     if c.id in data.orig_classes else c.id)
                    for c in data.classes]
    elif view_type == "teacher":
        entities = [(t.id, data.orig_teachers[t.id].name if t.id in data.orig_teachers else t.id)
                    for t in data.teachers]
    else:  # room
        entities = [(r.id, data.orig_rooms[r.id].name if r.id in data.orig_rooms else r.id)
                    for r in data.rooms]

    for eid, ename in entities:
        # Empty grid
        grid = [[None] * periods for _ in range(days)]

        # Fill cells
        for cell in all_cells:
            if view_type == "class"   and eid not in cell.class_ids:   continue
            if view_type == "teacher" and eid not in cell.teacher_ids:  continue
            if view_type == "room"    and eid not in cell.room_ids:     continue

            day = cell.day
            sp  = cell.period
            # Fill all periods spanned by this block
            for off in range(cell.span):
                p = sp + off
                if 0 <= p < periods:
                    grid[day][p] = cell

        grids[eid] = TimetableGrid(
            entity_id=eid,
            entity_name=ename,
            entity_type=view_type,
            days=days,
            periods=periods,
            grid=grid,
        )

    return grids