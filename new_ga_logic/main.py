"""
main.py
=======
Test harness for the GA timetable scheduler.

Usage:
    python main.py                        # run with defaults
    python main.py --mask 4095            # all soft constraints on
    python main.py --mask 135 --seed 42   # reproducible run
    python main.py --gens 500 --pop 120   # custom GA params
    python main.py --help                 # show all options

Output:
    - GA progress printed live
    - Per-class timetable grids (terminal)
    - Violation analysis report
    - Fitness convergence chart (ASCII)
    - Placement summary
"""

from __future__ import annotations

import argparse
import sys
import os
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

# ── ensure we can import from this directory ──────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from scheduler import generate, PreflightError
from structures import (
    Teacher, Subject, Room, Class, LessonBlock,
    make_multi_break_mask,
)
from constraints import decode_constraint_mask
from tt_cs import create_comprehensive_test_case, get_default_break_config


# ─────────────────────────────────────────────────────────────────────────────
# TERMINAL COLOURS  (degrades gracefully on Windows)
# ─────────────────────────────────────────────────────────────────────────────

def _supports_colour() -> bool:
    return hasattr(sys.stdout, "isatty") and sys.stdout.isatty()

USE_COLOUR = _supports_colour()

class C:
    RESET  = "\033[0m"   if USE_COLOUR else ""
    BOLD   = "\033[1m"   if USE_COLOUR else ""
    DIM    = "\033[2m"   if USE_COLOUR else ""
    RED    = "\033[91m"  if USE_COLOUR else ""
    GREEN  = "\033[92m"  if USE_COLOUR else ""
    YELLOW = "\033[93m"  if USE_COLOUR else ""
    BLUE   = "\033[94m"  if USE_COLOUR else ""
    CYAN   = "\033[96m"  if USE_COLOUR else ""
    MAGENTA= "\033[95m"  if USE_COLOUR else ""
    WHITE  = "\033[97m"  if USE_COLOUR else ""

def bold(s):   return f"{C.BOLD}{s}{C.RESET}"
def red(s):    return f"{C.RED}{s}{C.RESET}"
def green(s):  return f"{C.GREEN}{s}{C.RESET}"
def yellow(s): return f"{C.YELLOW}{s}{C.RESET}"
def cyan(s):   return f"{C.CYAN}{s}{C.RESET}"
def dim(s):    return f"{C.DIM}{s}{C.RESET}"
def blue(s):   return f"{C.BLUE}{s}{C.RESET}"
def magenta(s):return f"{C.MAGENTA}{s}{C.RESET}"


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

DAY_NAMES    = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAY_SHORT    = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

CELL_WIDTH   = 14   # characters per timetable cell
SEP_CHAR     = "─"
CROSS_CHAR   = "┼"
V_CHAR       = "│"
T_CHAR       = "┬"
B_CHAR       = "┴"
L_CHAR       = "├"
R_CHAR       = "┤"
TL_CHAR      = "┌"
TR_CHAR      = "┐"
BL_CHAR      = "└"
BR_CHAR      = "┘"


def _truncate(s: str, n: int) -> str:
    return s if len(s) <= n else s[:n-1] + "…"


def _center(s: str, width: int) -> str:
    return s.center(width)


def _hrule(cols: int, left, mid, right, fill=SEP_CHAR) -> str:
    cell = fill * CELL_WIDTH
    return left + (mid + cell) * cols + right


def _subject_short(block: LessonBlock, subjects: Dict[str, Subject]) -> str:
    """Best short display name for a block."""
    if block.subject_name:
        name = block.subject_name
    elif block.subject_ids:
        sid = block.subject_ids[0]
        subj = subjects.get(sid)
        name = subj.name if subj else sid
    else:
        name = "?"
    # Shorten common long words
    for old, new in [("Operating Systems", "Op Systems"), ("Database Management Systems", "DBMS"),
                     ("Computer Organization and Architecture", "COA"),
                     ("Hardware and Web Systems", "HW & Web"),
                     ("Intellectual Property Rights", "IPR"),
                     ("Advanced Algorithms", "Adv Algorithms"),
                     ("Industrial Economics and Financial Decisions", "Ind Eco & Fin"),
                     ("Comprehensive Course Work", "CCW"),
                     ("Comprehensive Viva", "Comp Viva"),
                     ("Distributed Computing", "Dist Computing"),
                     ("Compiler Design", "Compiler Des."),
                     ("Computer Graphics", "Comp Graphics"),
                     ("Networking Lab", "Net Lab"),
                     ("Mini Project", "Mini Proj"),
                     ("Major Project", "Major Proj"),
                     ("IT Workshop", "IT Workshop")]:
        name = name.replace(old, new)
    return _truncate(name, CELL_WIDTH - 2)


def _teacher_short(block: LessonBlock, teachers: Dict[str, Teacher]) -> str:
    parts = []
    for tid in block.teacher_ids[:2]:
        t = teachers.get(tid)
        if t:
            # use name directly if short_name is still default "X"
            display = t.name[:6] if t.short_name == "X" else t.short_name
        else:
            display = tid[:4]
        parts.append(display)
    s = "/".join(parts)
    if len(block.teacher_ids) > 2:
        s += f"+{len(block.teacher_ids)-2}"
    return _truncate(s, CELL_WIDTH - 2)


# ─────────────────────────────────────────────────────────────────────────────
# TIMETABLE GRID PRINTER
# ─────────────────────────────────────────────────────────────────────────────

def print_timetable(
    result,
    teachers:  Dict[str, Teacher],
    subjects:  Dict[str, Subject],
    classes:   Dict[str, Class],
    days:      int,
    ppd:       int,
    break_periods: List[int],
):
    tt = result.timetable

    # Build lookup: (class_id, day, period) → block
    cell: Dict[Tuple[str, int, int], LessonBlock] = {}
    cont: Dict[Tuple[str, int, int], bool] = {}  # continuation periods of a multi-block

    for block_id, gene in result.genes_export.items():
        if gene is None:
            continue
        day    = gene["day"]
        period = gene["period"]
        dur    = gene["duration"]
        # find the block object
        block  = next((b for b in tt.locked_lessons if b.id == block_id), None)
        # fallback: search checker blocks
        if block is None:
            continue

        for cid in block.class_ids:
            cell[(cid, day, period)] = block
            for dp in range(1, dur):
                cont[(cid, day, period + dp)] = True

    # Rebuild cell lookup from raw genes + original blocks list
    # (locked_lessons only has locked ones; we need all)
    return  # will be rewritten below — see _print_timetable_impl


def _build_cell_map(result, blocks_list: List[LessonBlock]):
    """
    Returns:
        cell_map  {(cid, day, period): LessonBlock}
        cont_map  {(cid, day, period): True}  — continuation slot of multi-period block
    """
    block_by_id = {b.id: b for b in blocks_list}
    cell_map: Dict[Tuple[str, int, int], LessonBlock] = {}
    cont_map: Dict[Tuple[str, int, int], bool] = {}

    for block_id, gene in result.genes_export.items():
        if gene is None:
            continue
        block = block_by_id.get(block_id)
        if block is None:
            continue
        day    = gene["day"]
        period = gene["period"]
        dur    = gene["duration"]

        for cid in block.class_ids:
            cell_map[(cid, day, period)] = block
            for dp in range(1, dur):
                cont_map[(cid, day, period + dp)] = True

    return cell_map, cont_map


def print_class_timetable(
    class_id:      str,
    class_name:    str,
    cell_map,
    cont_map,
    teachers:      Dict[str, Teacher],
    subjects:      Dict[str, Subject],
    days:          int,
    ppd:           int,
    break_mask:    int,
):
    print()
    title = f"  📅  {class_name}  "
    print(bold(cyan(f"{'═' * 4} {title} {'═' * max(0, 72 - len(title))} ")))

    col_w = CELL_WIDTH
    n_cols = days

    # Header row
    period_label_w = 6

    # Top border
    top = " " * period_label_w + TL_CHAR
    for d in range(days):
        top += SEP_CHAR * col_w
        top += TR_CHAR if d == days - 1 else T_CHAR
    print(dim(top))

    # Day name row
    row = " " * period_label_w + V_CHAR
    for d in range(days):
        label = _truncate(DAY_SHORT[d], col_w)
        row += bold(_center(label, col_w)) + V_CHAR
    print(row)

    # Sub-header separator
    sub = " " * period_label_w + L_CHAR
    for d in range(days):
        sub += SEP_CHAR * col_w
        sub += CROSS_CHAR if d < days - 1 else R_CHAR
    print(dim(sub))

    for p in range(ppd):
        # Line 1: subject name / break
        row1 = f" P{p+1:2d}  " + V_CHAR
        # Line 2: teacher name / break
        row2 = " " * period_label_w + V_CHAR

        for d in range(days):
            # Check if this specific (day, period) is a break
            slot = d * ppd + p
            is_break = bool(break_mask & (1 << slot))

            if is_break:
                row1 += dim(_center("── BREAK ──", col_w)) + V_CHAR
                row2 += dim(_center("", col_w)) + V_CHAR
                continue

            key = (class_id, d, p)

            if key in cont_map:
                # continuation of multi-period block started above
                row1 += dim(_center("╧", col_w)) + V_CHAR
                row2 += dim(_center("", col_w)) + V_CHAR

            elif key in cell_map:
                block = cell_map[key]
                subj_str = _subject_short(block, subjects)
                tchr_str = _teacher_short(block, teachers)

                # colour: lab=magenta, difficult=yellow, locked=blue, normal=white
                if block.is_locked:
                    colour = blue
                    tag = "🔒"
                elif block.is_lab:
                    colour = magenta
                    tag = "⚗"
                elif block.is_difficult:
                    colour = yellow
                    tag = "★"
                else:
                    colour = green
                    tag = " "

                dur_tag = f"×{block.duration}" if block.duration > 1 else "  "
                s1 = _center(f"{tag}{subj_str}", col_w)
                s2 = _center(f"{tchr_str}{dur_tag}", col_w)
                row1 += colour(s1) + V_CHAR
                row2 += dim(s2) + V_CHAR

            else:
                # empty
                row1 += dim(_center("·", col_w)) + V_CHAR
                row2 += dim(_center("", col_w)) + V_CHAR

        print(row1)
        print(row2)

        # row separator
        if p < ppd - 1:
            sep = " " * period_label_w + L_CHAR
            for d in range(days):
                sep += SEP_CHAR * col_w
                sep += CROSS_CHAR if d < days - 1 else R_CHAR
            print(dim(sep))

    # Bottom border
    bot = " " * period_label_w + BL_CHAR
    for d in range(days):
        bot += SEP_CHAR * col_w
        bot += BR_CHAR if d == days - 1 else B_CHAR
    print(dim(bot))

    # Legend
    print(f"  {blue('🔒 Locked')}  {magenta('⚗ Lab')}  {yellow('★ Difficult')}  {green('● Normal')}  {dim('· Empty')}")


# ─────────────────────────────────────────────────────────────────────────────
# VIOLATION ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────

HARD_LABELS = {
    "unassigned":          ("UNASSIGNED BLOCKS",      "Lesson blocks that could not be placed"),
    "locked_violation":    ("LOCKED MOVED",           "Pinned lessons moved from their fixed slot"),
    "break_violation":     ("BREAK SLOT USED",        "Lessons placed during break periods"),
    "teacher_conflict":    ("TEACHER DOUBLE-BOOKED",  "Teacher assigned to 2+ lessons simultaneously"),
    "room_conflict":       ("ROOM DOUBLE-BOOKED",     "Room assigned to 2+ lessons simultaneously"),
    "class_conflict":      ("CLASS DOUBLE-BOOKED",    "Class in 2+ lessons simultaneously"),
    "teacher_unavailable": ("TEACHER UNAVAILABLE",    "Teacher assigned when marked unavailable"),
    "room_unavailable":    ("ROOM UNAVAILABLE",       "Room used when marked unavailable"),
    "two_labs_same_day":   ("TWO LABS SAME DAY",      "Class has 2+ lab sessions on the same day"),
}

NT_LABELS = {
    "NT1_first_period":    ("NT1 FIRST PERIOD EMPTY", "Class has no lesson in period 1 on a day"),
    "NT2_teacher_all_day": ("NT2 TEACHER IDLE DAY",   "Teacher has a completely free day"),
    "NT3_class_gaps":      ("NT3 CLASS GAPS",         "Free slot between two occupied periods for a class"),
    "NT4_consec_blocks":   ("NT4 3+ CONSECUTIVE",     "Teacher has 3+ lesson blocks back-to-back"),
}

SOFT_LABELS = {
    "teacher_gap":         "Teacher gap preference violated",
    "lab_time_pref":       "Lab not at preferred time of day",
    "lab_avoid_monday":    "Lab scheduled on avoided Monday",
    "lab_avoid_friday":    "Lab scheduled on avoided Friday",
    "max_classes_per_day": "Teacher exceeded max classes/day",
    "difficult_morning":   "Difficult subject not in morning",
    "subject_dist":        "Subject not well distributed across week",
    "first_period_equal":  "Unequal first-period load among teachers",
    "no_repeat_subject":   "Same subject repeated on same day",
}


def print_violation_report(result, constraint_mask: int):
    vd = result.violation_detail

    print()
    print(bold(f"{'═' * 72}"))
    print(bold(f"  VIOLATION ANALYSIS REPORT"))
    print(bold(f"{'═' * 72}"))

    # ── Summary bar ──────────────────────────────────────────────────────
    feasible = result.is_feasible
    status   = green("✔  FEASIBLE") if feasible else red("✘  INFEASIBLE  (hard violations present)")
    print(f"\n  Status : {bold(status)}")
    print(f"  Fitness: {bold(str(result.fitness)):>12}  (lower = better, 0 = perfect)")
    print(f"  Hard ✘ : {bold(red(str(result.hard_violations))):>12}  violation(s)")
    print(f"  Soft ⚠ : {bold(yellow(str(result.soft_violations))):>12}  violation(s)")
    print(f"  Time   : {result.elapsed_seconds:.1f}s over {result.generations_run} generations")

    # ── Hard constraints ──────────────────────────────────────────────────
    print(f"\n{bold('── HARD CONSTRAINTS ─────────────────────────────────────────────────')}")
    any_hard = False
    for key, (label, desc) in HARD_LABELS.items():
        count = vd.get(key, 0)
        weight = {
            "unassigned": 15_000, "locked_violation": 50_000,
            "break_violation": 20_000, "teacher_conflict": 10_000,
            "room_conflict": 10_000, "class_conflict": 10_000,
            "teacher_unavailable": 10_000, "room_unavailable": 5_000,
            "two_labs_same_day": 25_000,
        }.get(key, 0)
        penalty = count * weight
        if count:
            any_hard = True
            print(f"  {red('✘')} {label:<30} {red(str(count)):>4} violations  "
                  f"  penalty {red(f'+{penalty:,}')}")
            print(f"    {dim(desc)}")
        else:
            print(f"  {green('✔')} {label:<30} {dim('  OK')}")
    if not any_hard:
        print(f"\n  {green('All hard constraints satisfied.')}")

    # ── Non-toggleable soft constraints ───────────────────────────────────
    print(f"\n{bold('── NON-TOGGLEABLE SOFT CONSTRAINTS (NT1–NT4) ──────────────────────')}")
    any_nt = False
    for key, (label, desc) in NT_LABELS.items():
        count = vd.get(key, 0)
        weight = {"NT1_first_period": 100, "NT2_teacher_all_day": 100,
                  "NT3_class_gaps": 80, "NT4_consec_blocks": 60}.get(key, 0)
        penalty = count * weight
        if count:
            any_nt = True
            print(f"  {yellow('⚠')} {label:<30} {yellow(str(count)):>4} violations  "
                  f"  penalty {yellow(f'+{penalty:,}')}")
            print(f"    {dim(desc)}")
        else:
            print(f"  {green('✔')} {label:<30} {dim('  OK')}")
    if not any_nt:
        print(f"\n  {green('All NT constraints satisfied.')}")

    # ── Toggleable soft constraints ───────────────────────────────────────
    decoded = decode_constraint_mask(constraint_mask)
    active  = {k: v for k, v in decoded.items() if v}

    print(bold(f"\n── TOGGLEABLE SOFT CONSTRAINTS (mask=0b{constraint_mask:012b} / {constraint_mask}) ──"))
    if not active:
        print(f"  {dim('No toggleable soft constraints active (mask=0).')}")
    else:
        for key, mode in active.items():
            label  = SOFT_LABELS.get(key, key)
            count  = vd.get(key, 0)
            mode_s = f"mode={mode}" if mode > 1 else "on"
            if count:
                print(f"  {yellow('⚠')} [{mode_s}] {label:<40} {yellow(str(count))} violations")
            else:
                print(f"  {green('✔')} [{mode_s}] {label:<40} {dim('OK')}")

    # ── Warnings ──────────────────────────────────────────────────────────
    if result.warnings:
        print(f"\n{bold('── WARNINGS ────────────────────────────────────────────────────────')}")
        for w in result.warnings:
            print(f"  {yellow('⚠')}  {w}")


# ─────────────────────────────────────────────────────────────────────────────
# PLACEMENT SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

def print_placement_summary(result, blocks_list: List[LessonBlock], subjects: Dict[str, Subject]):
    total     = len(blocks_list)
    placed    = sum(1 for v in result.genes_export.values() if v is not None)
    unplaced  = total - placed
    locked_p  = sum(1 for b in blocks_list if b.is_locked
                    and result.genes_export.get(b.id) is not None)

    print()
    print(bold(f"{'═' * 72}"))
    print(bold("  PLACEMENT SUMMARY"))
    print(bold(f"{'═' * 72}"))
    print(f"  Total lesson blocks : {bold(str(total))}")
    print(f"  Placed              : {bold(green(str(placed)))}")
    print(f"  Unplaced            : {bold(red(str(unplaced)) if unplaced else green('0'))}")
    print(f"  Locked (placed)     : {bold(str(locked_p))}")

    # Per-class breakdown
    print(f"\n  {'Class':<20} {'Blocks':>7} {'Placed':>7} {'Periods':>8} {'Utilisation':>12}")
    print(f"  {'-'*20} {'-'*7} {'-'*7} {'-'*8} {'-'*12}")

    class_blocks: Dict[str, List] = defaultdict(list)
    for b in blocks_list:
        for cid in b.class_ids:
            class_blocks[cid].append(b)

    for cid, cblocks in sorted(class_blocks.items()):
        cplaced  = sum(1 for b in cblocks if result.genes_export.get(b.id) is not None)
        cperiods = sum(b.duration for b in cblocks if result.genes_export.get(b.id) is not None)
        ctotal_p = sum(b.duration for b in cblocks)
        util     = f"{cperiods/ctotal_p*100:.0f}%" if ctotal_p else "—"
        ok = cplaced == len(cblocks)
        row = f"  {cid:<20} {len(cblocks):>7} {cplaced:>7} {cperiods:>8} {util:>12}"
        print(green(row) if ok else yellow(row))

    # List unplaced blocks
    if unplaced:
        print(f"\n  {bold(red('Unplaced blocks:'))}")
        for b in blocks_list:
            if result.genes_export.get(b.id) is None:
                sid  = b.subject_ids[0] if b.subject_ids else "?"
                subj = subjects.get(sid)
                name = subj.name if subj else sid
                print(f"    {red('✘')} {b.id}  {name:<30}  "
                      f"classes:{b.class_ids}  dur={b.duration}  "
                      f"{'[LOCKED]' if b.is_locked else ''}")


# ─────────────────────────────────────────────────────────────────────────────
# FITNESS CONVERGENCE CHART  (ASCII)
# ─────────────────────────────────────────────────────────────────────────────

def print_fitness_chart(history: List[int], width: int = 68, height: int = 16):
    if not history:
        return

    print()
    print(bold(f"{'═' * 72}"))
    print(bold("  FITNESS CONVERGENCE"))
    print(bold(f"{'═' * 72}"))

    mn, mx = min(history), max(history)
    if mn == mx:
        print(f"  Flat line at {mn:,}  (no change over {len(history)} generations)")
        return

    # Downsample if needed
    n = len(history)
    if n > width:
        step  = n / width
        sampled = [history[min(int(i * step), n - 1)] for i in range(width)]
    else:
        sampled = history

    # Normalise to height
    def norm(v):
        return int((mx - v) / (mx - mn) * (height - 1))

    rows = [[" "] * len(sampled) for _ in range(height)]
    for col, val in enumerate(sampled):
        r = norm(val)
        rows[r][col] = "█"
        # fill downward from r to height-1 with lighter shade
        for rr in range(r + 1, height):
            rows[rr][col] = "░"

    # Print y-axis + chart
    label_w = 10
    for r, row in enumerate(rows):
        if r == 0:
            lbl = f"{mx:>{label_w},}"
        elif r == height // 2:
            lbl = f"{(mx+mn)//2:>{label_w},}"
        elif r == height - 1:
            lbl = f"{mn:>{label_w},}"
        else:
            lbl = " " * label_w
        print(f"  {dim(lbl)} {''.join(row)}")

    # x-axis
    print(f"  {' ' * label_w} {'─' * len(sampled)}")
    gen_label = f"Gen 1{' ' * (len(sampled) - 12)}Gen {len(history)}"
    print(f"  {' ' * label_w} {dim(gen_label)}")

    # Stats
    improvement = mx - mn
    pct = improvement / mx * 100 if mx else 0
    print(f"\n  Initial fitness : {bold(f'{mx:,}'):>12}")
    print(f"  Final fitness   : {bold(green(f'{mn:,}')):>12}")
    print(f"  Improvement     : {bold(f'{improvement:,}'):>12}  ({pct:.1f}%)")
    print(f"  Generations     : {bold(str(len(history))):>12}")


# ─────────────────────────────────────────────────────────────────────────────
# ACTIVE CONSTRAINT SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

def print_constraint_config(constraint_mask: int):
    decoded = decode_constraint_mask(constraint_mask)
    print()
    print(bold(f"{'═' * 72}"))
    print(bold(f"  CONSTRAINT CONFIGURATION  (mask={constraint_mask} / 0b{constraint_mask:012b})"))
    print(bold(f"{'═' * 72}"))

    gap_modes  = {0: "off", 1: "minimize gaps", 2: "allow gaps", 3: "avoid back-to-back"}
    lab_modes  = {0: "none", 1: "prefer beginning", 2: "prefer end"}
    dist_modes = {0: "off", 1: "evenly distributed", 2: "high priority early in week"}

    rows = [
        ("Bits 0–1", "Teacher gap handling",              gap_modes.get(decoded["teacher_gap"], "?")),
        ("Bits 2–3", "Lab time preference",               lab_modes.get(decoded["lab_time_pref"], "?")),
        ("Bit  4",   "Lab avoid Monday",                  "on" if decoded["lab_avoid_monday"] else "off"),
        ("Bit  5",   "Lab avoid Friday",                  "on" if decoded["lab_avoid_friday"] else "off"),
        ("Bit  6",   "Limit max classes/day (teacher)",   "on" if decoded["max_classes_per_day"] else "off"),
        ("Bit  7",   "Difficult subject in morning",      "on" if decoded["difficult_morning"] else "off"),
        ("Bits 8–9", "Subject distribution",              dist_modes.get(decoded["subject_dist"], "?")),
        ("Bit  10",  "Equal first-period distribution",   "on" if decoded["first_period_equal"] else "off"),
        ("Bit  11",  "Avoid same subject twice/day",      "on" if decoded["no_repeat_subject"] else "off"),
    ]

    print(f"\n  {'Bits':<10} {'Constraint':<40} {'Setting'}")
    print(f"  {'-'*10} {'-'*40} {'-'*20}")
    for bits, name, setting in rows:
        active = setting not in ("off", "none")
        s_col  = green(setting) if active else dim(setting)
        print(f"  {dim(bits):<10} {name:<40} {s_col}")

    print(f"\n  Non-toggleable (always active): NT1 First-period lesson | "
          f"NT2 Teacher all day | NT3 Class gaps | NT4 3+ consecutive blocks")


# ─────────────────────────────────────────────────────────────────────────────
# ARGUMENT PARSER
# ─────────────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(
        description="GA Timetable Scheduler — test harness",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Constraint mask bits (12-bit integer 0–4095):
  Bits 0–1  Teacher gap  : 1=minimize  2=allow  3=avoid back-to-back
  Bits 2–3  Lab time     : 4=beginning 8=end
  Bit  4    Lab no Mon   : 16
  Bit  5    Lab no Fri   : 32
  Bit  6    Max cls/day  : 64
  Bit  7    Diff morning : 128
  Bits 8–9  Subj dist    : 256=even  512=high-priority early
  Bit  10   1st per eq   : 1024
  Bit  11   No repeat    : 2048

Examples:
  python main.py --mask 0        # hard + NT constraints only
  python main.py --mask 4095     # everything on
  python main.py --mask 128      # difficult subject in morning only
  python main.py --mask 135 --seed 42 --gens 300
        """,
    )
    p.add_argument("--mask",  type=int, default=0,
                   help="12-bit constraint mask 0–4095 (default: 0)")
    p.add_argument("--seed",  type=int, default=None,
                   help="Random seed for reproducibility")
    p.add_argument("--gens",  type=int, default=None,
                   help="Override max_generations")
    p.add_argument("--pop",   type=int, default=None,
                   help="Override population_size")
    p.add_argument("--days",  type=int, default=5,
                   help="School days per week (default: 5)")
    p.add_argument("--ppd",   type=int, default=7,
                   help="Periods per day (default: 7)")
    p.add_argument("--break-periods", type=str, default=None,
                   help="Comma-separated break period indices 0-based (blocked every day). "
                        "If omitted, the default college break preset is used (P4 every day, P5 Fri).")
    p.add_argument("--no-timetable", action="store_true",
                   help="Skip printing per-class timetable grids")
    p.add_argument("--no-chart",     action="store_true",
                   help="Skip fitness convergence chart")
    return p.parse_args()


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    if args.break_periods is not None:
        break_periods = [int(x.strip()) for x in args.break_periods.split(",") if x.strip()]
        resolved_break_mask = None # will be built from periods
    else:
        # Default college breaks: P4 every day, P5 Friday
        break_periods = None
        resolved_break_mask = get_default_break_config(args.days, args.ppd)

    # ── Banner ────────────────────────────────────────────────────────────
    print()
    print(bold(cyan("╔══════════════════════════════════════════════════════════════════════╗")))
    print(bold(cyan("║          GA TIMETABLE SCHEDULER — TEST HARNESS                      ║")))
    print(bold(cyan("╚══════════════════════════════════════════════════════════════════════╝")))
    print(f"  Days: {args.days}  |  Periods/day: {args.ppd}  |  "
          f"Breaks: {'Default Preset' if break_periods is None else break_periods}  |  "
          f"Mask: {args.mask}  |  Seed: {args.seed}")
    print()

    # ── Load test case ────────────────────────────────────────────────────
    print(bold("── Loading test case (tt_cs.py) ─────────────────────────────────────"))
    teachers, subjects, rooms, classes, blocks = create_comprehensive_test_case()
    print(f"  Teachers : {len(teachers)}")
    print(f"  Subjects : {len(subjects)}")
    print(f"  Rooms    : {len(rooms)}")
    print(f"  Classes  : {len(classes)}")
    print(f"  Blocks   : {len(blocks)}  "
          f"({sum(1 for b in blocks if b.is_locked)} locked, "
          f"{sum(1 for b in blocks if not b.is_locked)} free)")

    # ── Show constraint config ────────────────────────────────────────────
    print_constraint_config(args.mask)

    # ── GA params ────────────────────────────────────────────────────────
    ga_params = {}
    if args.gens: ga_params["max_generations"] = args.gens
    if args.pop:  ga_params["population_size"] = args.pop

    # ── Run ───────────────────────────────────────────────────────────────
    # ── Run (simulating backend dynamic unpack) ──────────────────────────
    print()
    print(bold("── Running GA ───────────────────────────────────────────────────────"))
    
    # Pack the request body like a backend would
    request_params = {
        "teachers":        teachers,
        "subjects":        subjects,
        "rooms":           rooms,
        "classes":         classes,
        "blocks":          blocks,
        "days":            args.days,
        "periods_per_day": args.ppd,
        "break_periods":   break_periods,
        "break_mask":      resolved_break_mask,
        "constraint_mask": args.mask,
        "ga_params":       ga_params if ga_params else None,
        "seed":            args.seed,
    }
    
    try:
        # Unpack and call generate (flexible for any backend body structure)
        result = generate(**request_params)
    except PreflightError as e:
        print(red(f"\n  Pre-flight validation failed:"))
        for err in e.errors:
            print(red(f"    ✘  {err}"))
        sys.exit(1)
    except Exception as e:
        print(red(f"\n  Error: {e}"))
        raise

    # ── Reports ───────────────────────────────────────────────────────────
    print_placement_summary(result, blocks, subjects)
    print_violation_report(result, args.mask)

    if not args.no_chart:
        print_fitness_chart(result.fitness_history)

    # ── Timetable grids ───────────────────────────────────────────────────
    if not args.no_timetable:
        cell_map, cont_map = _build_cell_map(result, blocks)
        for cid, cls in sorted(classes.items()):
            print_class_timetable(
                class_id      = cid,
                class_name    = cls.name,
                cell_map      = cell_map,
                cont_map      = cont_map,
                teachers      = teachers,
                subjects      = subjects,
                days          = args.days,
                ppd           = args.ppd,
                break_mask    = result.timetable.break_mask,
            )

    print()
    print(bold(cyan("═" * 72)))
    status = green("FEASIBLE ✔") if result.is_feasible else red("INFEASIBLE ✘")
    print(bold(f"  Final result: {status}   fitness={result.fitness:,}   "
               f"time={result.elapsed_seconds:.1f}s"))
    print(bold(cyan("═" * 72)))
    print()


if __name__ == "__main__":
    main()