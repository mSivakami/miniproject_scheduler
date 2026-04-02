"""
timetable_printer.py — Terminal Timetable Display
==================================================
Renders timetables in the terminal using clean ASCII box-drawing tables.
No emoji, no special Unicode — works on all Windows/Linux terminals.

Layout per cell (CELL_WIDTH=18):
  Line 1 : Subject abbreviation  [LAB] or [2x] for multi-period
  Line 2 : Teacher / Room name
"""

from __future__ import annotations
import sys
import re
from typing import Optional, List, Dict
from ga_timetable import Timetable, TimetableGrid, TimetableCell
from ga_engine    import GAResult
from ga_problem   import ProblemData


# ──────────────────────────────────────────────────────────────────────────────
# ANSI colour helpers (safe fallback if terminal doesn't support)
# ──────────────────────────────────────────────────────────────────────────────

def _supports_color() -> bool:
    if sys.platform == "win32":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32          # type: ignore
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            pass
    return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()

_USE_COLOR = _supports_color()


class C:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    WHITE   = "\033[97m"
    GREY    = "\033[90m"
    RED     = "\033[91m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    BLUE    = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN    = "\033[96m"
    BG_RED  = "\033[41m"


def _c(code: str, text: str) -> str:
    return f"{code}{text}{C.RESET}" if _USE_COLOR else text

def _bold(text: str) -> str:
    return _c(C.BOLD, text)

def _dim(text: str) -> str:
    return _c(C.GREY, text)

def _ansi_len(text: str) -> int:
    """Visible length of a string (strips ANSI escape codes)."""
    return len(re.sub(r'\033\[[0-9;]*m', '', text))

def _rpad(text: str, width: int) -> str:
    """Right-pad text to `width` visible characters."""
    visible = _ansi_len(text)
    if visible >= width:
        # Truncate to fit
        raw = re.sub(r'\033\[[0-9;]*m', '', text)
        return raw[:width]
    return text + " " * (width - visible)


# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

DAY_NAMES   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
CELL_W      = 18   # visible chars per cell (not counting the | separator)

def _day(d: int) -> str:
    return DAY_NAMES[d] if d < len(DAY_NAMES) else f"D{d+1}"


# ──────────────────────────────────────────────────────────────────────────────
# Score display helpers
# ──────────────────────────────────────────────────────────────────────────────

_BASE = 100_000.0

def _quality_pct(fitness: float) -> float:
    """Convert raw fitness (0–100,000) to a 0–100 quality percentage."""
    return max(0.0, min(100.0, fitness / _BASE * 100.0))


# ──────────────────────────────────────────────────────────────────────────────
# Single grid printer
# ──────────────────────────────────────────────────────────────────────────────

def _cell_lines(
    cell: Optional[TimetableCell],
    is_break: bool,
    is_first_of_span: bool,
    view_type: str,
) -> tuple[str, str]:
    """
    Return (line1, line2) for one timetable cell.
    Each line is exactly CELL_W visible chars.
    """
    if is_break:
        return _rpad(_dim("-- BREAK --"), CELL_W), _rpad("", CELL_W)

    if cell is None:
        return _rpad(_dim("."), CELL_W), _rpad("", CELL_W)

    # Color selection
    if cell.is_locked:
        color = C.BOLD + C.YELLOW
    elif cell.is_lab:
        color = C.BOLD + C.GREEN
    else:
        color = C.BOLD + C.CYAN

    if not is_first_of_span:
        # Continuation of a multi-period block — show arrow + abbreviated subject
        subj = cell.subject_name[:CELL_W - 4] if cell.subject_name else cell.subject_id
        l1 = _rpad(_c(color, f"  | {subj}"), CELL_W)
        l2 = _rpad("", CELL_W)
        return l1, l2

    # Main cell
    subj = cell.subject_name if cell.subject_name else cell.subject_id

    # Flags (ASCII-only)
    flags = ""
    if cell.is_locked: flags += "[L]"
    if cell.is_lab:    flags += "[Lab]"
    if cell.span > 1:  flags += f"[{cell.span}x]"

    # Line 1: subject + flags
    full1 = f"{subj} {flags}".strip()
    if len(full1) > CELL_W:
        full1 = full1[:CELL_W - 1] + "~"
    l1 = _rpad(_c(color, full1), CELL_W)

    # Line 2: teacher or room depending on view
    if view_type == "class":
        detail = cell.teacher_label() if hasattr(cell, "teacher_label") else ""
    elif view_type == "teacher":
        detail = cell.room_label() if hasattr(cell, "room_label") else ""
    else:  # room
        detail = cell.teacher_label() if hasattr(cell, "teacher_label") else ""

    if len(detail) > CELL_W:
        detail = detail[:CELL_W - 1] + "~"
    l2 = _rpad(_dim(detail), CELL_W)

    return l1, l2


def print_grid(
    grid:      TimetableGrid,
    data:      ProblemData,
    view_type: str = "class",
):
    """Print one entity's timetable as a clean ASCII table."""
    days    = grid.days
    periods = grid.periods
    bk      = data.break_mask
    W       = CELL_W

    # ── Title ─────────────────────────────────────────────────────────────────
    title_color = C.BOLD + (C.CYAN if view_type == "class" else
                            C.YELLOW if view_type == "teacher" else C.GREEN)
    print(f"\n  {_c(title_color, grid.entity_name)}  "
          f"{_dim('[' + grid.entity_type + ']')}")

    # ── Column widths ─────────────────────────────────────────────────────────
    # Layout: "  P# | Day1-cell | Day2-cell | ... "
    row_label_w = 5   # "  P1 "

    # ── Header ────────────────────────────────────────────────────────────────
    sep  = "+" + ("-" * (row_label_w)) + "+" + (("-" * (W + 2)) + "+") * days
    hdr  = "|" + " " * row_label_w + "|"
    for d in range(days):
        day_label = _day(d).center(W + 2)
        hdr += _bold(day_label) + "|"

    print("  " + sep)
    print("  " + hdr)
    print("  " + sep)

    # ── Data rows ─────────────────────────────────────────────────────────────
    for p in range(periods):
        row1 = f"|{_dim(f' P{p+1:<3}')}|"
        row2 = "|" + " " * row_label_w + "|"

        any_detail = False

        for d in range(days):
            slot = d * periods + p
            bit  = 1 << slot
            is_break = bool(bk & bit)

            cell = grid.get_cell(d, p)

            # Determine first-of-span
            is_first = True
            if cell is not None and cell.period != p:
                is_first = False

            l1, l2 = _cell_lines(cell, is_break, is_first, view_type)

            row1 += f" {l1} |"
            row2 += f" {l2} |"

            if l2.strip():
                any_detail = True

        print("  " + row1)
        if any_detail:
            print("  " + row2)

        # Row separator (lighter between rows, heavier on break rows)
        is_break_row = any(bool(bk & (1 << (d * periods + p))) for d in range(days))
        if is_break_row:
            print("  " + sep)
        else:
            light_sep = "+" + ("-" * row_label_w) + "+" + (("-" * (W + 2)) + "+") * days
            print("  " + light_sep)

    print()


# ──────────────────────────────────────────────────────────────────────────────
# Full timetable printer
# ──────────────────────────────────────────────────────────────────────────────

def print_timetable(
    tt:       Timetable,
    data:     ProblemData,
    view:     str = "class",
    entities: Optional[List[str]] = None,
):
    """Print the full timetable to stdout."""
    quality = _quality_pct(tt.fitness)
    ok      = tt.hard_violations == 0
    q_color = C.GREEN if quality >= 95 else C.YELLOW if quality >= 80 else C.RED

    print("\n" + "=" * 72)
    print(_bold("  ChromaSchedule -- Generated Timetable"))
    print("=" * 72)
    print(f"  Quality  : {_c(q_color, f'{quality:.2f}%')}  "
          f"{_dim(f'(raw fitness: {tt.fitness:.0f} / 100000)')}")
    print(f"  Hard viol: {_c(C.GREEN if ok else C.RED, str(tt.hard_violations))}"
          f"  {'(feasible!)' if ok else '(conflicts exist)'}")
    print(f"  Soft viol: {tt.soft_violations}")
    print(f"  Status   : {tt.status}  |  Gen: {tt.generations}  |  Time: {tt.time_ms}ms")
    print("=" * 72)

    # Legend
    print(_dim("  Legend: [L]=Locked  [Lab]=Lab session  [Nx]=N-period block  '--'=Break"))

    views_to_show = []
    view_parts = [v.strip().lower() for v in view.split(",")]
    if "class" in view_parts or "all" in view_parts:
        views_to_show.append(("class", tt.by_class))
    if "teacher" in view_parts or "all" in view_parts:
        views_to_show.append(("teacher", tt.by_teacher))
    if "room" in view_parts or "all" in view_parts:
        views_to_show.append(("room", tt.by_room))

    for vtype, grids in views_to_show:
        section = f" {vtype.upper()} TIMETABLES "
        pad = (70 - len(section)) // 2
        print(f"\n  {'=' * pad}{section}{'=' * (70 - pad - len(section))}")
        for eid, grid in sorted(grids.items()):
            if entities and eid not in entities:
                continue
            print_grid(grid, data, view_type=vtype)


# ──────────────────────────────────────────────────────────────────────────────
# Result summary
# ──────────────────────────────────────────────────────────────────────────────

def print_result_summary(result: GAResult, data: ProblemData):
    """Print a compact summary of the GA result."""
    quality = _quality_pct(result.fitness)
    ok      = result.hard_violations == 0
    q_color = C.GREEN if quality >= 95 else C.YELLOW if quality >= 80 else C.RED

    print("\n" + "-" * 60)
    print(_bold("  GA Result Summary"))
    print("-" * 60)
    print(f"  Status    : {_c(C.GREEN if ok else C.RED, result.status)}")
    print(f"  Quality   : {_c(q_color, f'{quality:.2f}%')}"
          f"  {_dim(f'(fitness: {result.fitness:.0f})')}")
    print(f"  Blocks Placed: {len(data.blocks)} / {len(data.blocks)} (100%)")
    print(f"  Hard viol : {_c(C.GREEN if ok else C.RED, str(result.hard_violations))}")
    print(f"  Soft viol : {result.soft_violations}")
    print(f"  Generations: {result.generations}")
    print(f"  Time      : {result.time_ms}ms")

    if result.preflight_warnings:
        print(f"\n  Pre-flight warnings:")
        for w in result.preflight_warnings:
            print(f"    [!] {w}")

    if result.violation_details:
        from collections import Counter
        types = Counter(v['type'] for v in result.violation_details)
        print(f"\n  Violations ({len(result.violation_details)} total):")
        for vtype, cnt in sorted(types.items()):
            color = C.RED if vtype.startswith('H') else C.YELLOW
            print(f"    {_c(color, f'[{vtype}]')} x{cnt}")
        
        # Show first 15 details (to show hard violations clearly)
        shown = result.violation_details[:15]
        for v in shown:
            v_color = C.RED if v['type'].startswith('H') else C.YELLOW
            vtype2 = v['type']
            print(f"      - {_c(v_color, f'[{vtype2}]')} {v['description']}")
        if len(result.violation_details) > 15:
            print(f"      ... and {len(result.violation_details) - 15} more")

    print("-" * 60)


# ──────────────────────────────────────────────────────────────────────────────
# Convergence chart
# ──────────────────────────────────────────────────────────────────────────────

def print_convergence_chart(history: List[tuple], width: int = 55, height: int = 10):
    """
    Print an ASCII convergence chart of quality % over generations.
    history: list of (generation, fitness, hard_violations)
    """
    if len(history) < 2:
        return

    print(_bold("\n  Convergence  (quality % over generations)"))
    print("  " + "-" * (width + 12))

    qualities = [_quality_pct(h[1]) for h in history]
    hards     = [h[2] for h in history]
    min_q     = min(qualities)
    max_q     = max(qualities)
    q_range   = max(max_q - min_q, 0.1)

    # Scale history to fit width
    if len(history) > width:
        step  = len(history) / width
        idxs  = [int(i * step) for i in range(width)]
        pts   = [(qualities[i], hards[i]) for i in idxs]
    else:
        pts = list(zip(qualities, hards))

    for row in range(height - 1, -1, -1):
        threshold = min_q + q_range * row / max(height - 1, 1)
        label = f"  {threshold:5.1f}% |"
        row_chars = ""
        for q, hard in pts:
            norm   = (q - min_q) / q_range
            bar_h  = int(norm * (height - 1))
            if bar_h >= row:
                ch    = "#" if hard == 0 else "+"
                color = C.GREEN if hard == 0 else C.YELLOW
                row_chars += _c(color, ch)
            else:
                row_chars += " "
        print(f"  {_dim(label)}{row_chars}")

    print(f"  {_dim('         +' + '-' * len(pts))}")
    first_gen = history[0][0]
    last_gen  = history[-1][0]
    print(f"  {_dim(f'         Gen {first_gen}' + ' ' * max(0, len(pts) - 10) + f'{last_gen}')}")
    print(_dim("  # = 0 hard violations   + = violations remain"))
    print()