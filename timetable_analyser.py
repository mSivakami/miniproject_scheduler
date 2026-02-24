# from collections import defaultdict


# def iter_mask(mask, periods_per_day):
#     """Convert bitmask to (day,period) tuples."""
#     while mask:
#         lsb = mask & -mask
#         idx = lsb.bit_length() - 1
#         yield idx // periods_per_day, idx % periods_per_day
#         mask ^= lsb


# class TimetableAnalyzer:

#     def __init__(self, tt, teachers, subjects, rooms, classes, lessons, checker):
#         self.tt = tt
#         self.teachers = teachers
#         self.subjects = subjects
#         self.rooms = rooms
#         self.classes = classes
#         self.lessons = lessons
#         self.checker = checker

#         self.days = tt.days
#         self.periods = tt.periods_per_day
#         self.day_names = ["Mon","Tue","Wed","Thu","Fri"]

#     # =========================================================
#     # SLOT MAP (unchanged logic)
#     # =========================================================

#     def build_slot_map(self):
#         slot_map = defaultdict(list)
#         for l in self.lessons:
#             ts = self.tt.get_assignment(l.id)
#             if not ts: continue
#             for p in ts.get_periods():
#                 slot_map[(ts.day,p)].append(l)
#         return slot_map

#     # =========================================================
#     # HARD CONSTRAINTS (unchanged)
#     # =========================================================

#     def hard_violations(self):

#         report = defaultdict(list)
#         slot_map = self.build_slot_map()

#         for (d,p), lessons in slot_map.items():

#             if self.tt.is_break(d,p):
#                 report["break_violation"].append(f"{self.day_names[d]} P{p+1}")

#             teacher_seen = defaultdict(list)
#             room_seen = defaultdict(list)
#             class_seen = defaultdict(list)

#             for l in lessons:
#                 teacher_seen[l.teacher_id].append(l)
#                 room_seen[l.room_id].append(l)
#                 class_seen[l.class_id].append(l)

#             for tid, ls in teacher_seen.items():
#                 if len(ls)>1:
#                     report["teacher_conflict"].append(self._format_slot(d,p,ls))

#             for rid, ls in room_seen.items():
#                 if len(ls)>1:
#                     report["room_conflict"].append(self._format_slot(d,p,ls))

#             for cid, ls in class_seen.items():
#                 if len(ls)>1:
#                     report["class_conflict"].append(self._format_slot(d,p,ls))

#         # locked violations
#         for l in self.lessons:
#             if not l.is_locked: continue
#             ts = self.tt.get_assignment(l.id)
#             if not ts or ts.day!=l.locked_timeslot.day or ts.start_period!=l.locked_timeslot.start_period:
#                 report["locked_violation"].append(l.id)

#         return report

#     # =========================================================
#     # TEACHER STRUCTURE (MASK VERSION)
#     # =========================================================

#     def teacher_structure(self):

#         teacher_days = defaultdict(lambda: defaultdict(list))

#         for tid, mask in self.tt.teacher_mask.items():
#             for d,p in iter_mask(mask, self.periods):
#                 teacher_days[tid][d].append(p)

#         report = defaultdict(list)
#         afternoon = self.periods//2

#         for tid, days in teacher_days.items():

#             first_hour=0

#             for d, periods in days.items():

#                 periods.sort()

#                 if not any(p>=afternoon for p in periods):
#                     report["no_afternoon"].append(self.teachers[tid].name)

#                 if 0 in periods:
#                     first_hour+=1

#                 streak=1
#                 for i in range(1,len(periods)):
#                     if periods[i]==periods[i-1]+1 and not self.tt.is_break(d,periods[i-1]):
#                         streak+=1
#                     else:
#                         if streak==2:
#                             report["two_consecutive"].append(self.teachers[tid].name)
#                         if streak>=3:
#                             report["three_consecutive"].append(self.teachers[tid].name)
#                         streak=1

#             if first_hour<2:
#                 report["no_first_hour"].append(self.teachers[tid].name)

#         return report

#     # =========================================================
#     # SUBJECT STRUCTURE (unchanged)
#     # =========================================================

#     def subject_structure(self):

#         report=defaultdict(list)
#         afternoon=self.periods//2
#         last=self.periods-1

#         for l in self.lessons:
#             ts=self.tt.get_assignment(l.id)
#             if not ts: continue
#             subj=self.subjects[l.subject_id]

#             for p in ts.get_periods():

#                 if subj.priority<=3 and p>=afternoon:
#                     report["core_afternoon"].append(self._format_lesson(l,ts,p))

#                 if subj.priority>=8 and p!=last:
#                     report["remedial_not_last"].append(self._format_lesson(l,ts,p))

#             if getattr(subj,"is_lab",False):
#                 if all(p<afternoon for p in ts.get_periods()):
#                     report["lab_not_afternoon"].append(self._format_lesson(l,ts,ts.start_period))

#         return report

#     # =========================================================
#     # GAPS (unchanged)
#     # =========================================================

#     def gap_report(self):

#         report=[]
#         for cid in self.classes:

#             day_map=defaultdict(list)
#             for l in self.lessons:
#                 if l.class_id!=cid: continue
#                 ts=self.tt.get_assignment(l.id)
#                 if not ts: continue
#                 for p in ts.get_periods():
#                     day_map[ts.day].append(p)

#             for d, periods in day_map.items():
#                 periods=sorted(periods)
#                 for i in range(periods[0],periods[-1]):
#                     if i not in periods and not self.tt.is_break(d,i):
#                         report.append(f"{self.classes[cid].name} gap {self.day_names[d]} P{i+1}")

#         return report

#     # =========================================================
#     # HELPERS
#     # =========================================================

#     def _format_slot(self,d,p,lessons):
#         s=f"{self.day_names[d]} P{p+1}\n"
#         for l in lessons:
#             s+=f"   {self.classes[l.class_id].name} | {self.subjects[l.subject_id].name} | {self.teachers[l.teacher_id].name}\n"
#         return s

#     def _format_lesson(self,l,ts,p):
#         return f"{self.classes[l.class_id].name} {self.subjects[l.subject_id].name} {self.day_names[ts.day]} P{p+1}"

#     # =========================================================
#     # MASTER REPORT
#     # =========================================================

#     def full_diagnostic(self):

#         print("\n========== HARD ==========")
#         for k,v in self.hard_violations().items():
#             print(k,len(v))
#             for x in v: print(x)

#         print("\n========== TEACHERS ==========")
#         for k,v in self.teacher_structure().items():
#             print(k,len(v))
#             for x in v: print(x)

#         print("\n========== SUBJECTS ==========")
#         for k,v in self.subject_structure().items():
#             print(k,len(v))
#             for x in v: print(x)

#         print("\n========== GAPS ==========")
#         for x in self.gap_report():
#             print(x)

#         print("\nFitness =",self.checker.calculate_fitness(self.tt))

"""
timetable_analyser.py
=====================
Comprehensive diagnostic and display engine for generated timetables.
Extracts every meaningful insight and presents it in a clean,
well-structured terminal report.
"""

from collections import defaultdict
from typing import Dict, List, Tuple


# ─────────────────────────────────────────────────────────────────────────────
# DISPLAY HELPERS
# ─────────────────────────────────────────────────────────────────────────────

DAY_NAMES  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
DAY_SHORT  = ["Mon", "Tue", "Wed", "Thu", "Fri"]
PERIOD_CHAR = "█"
FREE_CHAR   = "░"
BREAK_CHAR  = "▒"

def _bar(filled, total, width=20, fill="█", empty="░"):
    n = round(filled / total * width) if total else 0
    return fill * n + empty * (width - n)

def _hdr(title, width=72):
    pad  = max(0, width - len(title) - 2)
    left = pad // 2
    return f"\n{'═'*left} {title} {'═'*(pad-left)}"

def _sub(title, width=72):
    return f"\n  ── {title} {'─'*(width - len(title) - 6)}"

def _row(label, value, width=30):
    return f"  {label:<{width}} {value}"

def _ok(x):   return f"\033[92m{x}\033[0m"
def _warn(x): return f"\033[93m{x}\033[0m"
def _err(x):  return f"\033[91m{x}\033[0m"
def _bold(x): return f"\033[1m{x}\033[0m"
def _dim(x):  return f"\033[2m{x}\033[0m"

def _quality(score):
    if score == 0:      return _ok("PERFECT")
    if score < 1_000:   return _ok("EXCELLENT")
    if score < 5_000:   return _ok("VERY GOOD")
    if score < 20_000:  return _warn("GOOD")
    if score < 60_000:  return _warn("ACCEPTABLE")
    return _err("NEEDS IMPROVEMENT")


# ─────────────────────────────────────────────────────────────────────────────
# UTILITIES
# ─────────────────────────────────────────────────────────────────────────────

def iter_mask(mask, periods_per_day):
    while mask:
        lsb = mask & -mask
        idx = lsb.bit_length() - 1
        yield idx // periods_per_day, idx % periods_per_day
        mask ^= lsb


def _consecutive_runs(periods: List[int]) -> List[int]:
    """Return run lengths from a sorted list of period indices."""
    if not periods:
        return []
    runs, run = [], 1
    for i in range(1, len(periods)):
        if periods[i] == periods[i - 1] + 1:
            run += 1
        else:
            runs.append(run)
            run = 1
    runs.append(run)
    return runs


def _is_lab(lesson, subjects):
    return getattr(subjects.get(lesson.subject_id), "is_lab", False)


# ─────────────────────────────────────────────────────────────────────────────
# ANALYSER
# ─────────────────────────────────────────────────────────────────────────────

class TimetableAnalyzer:

    def __init__(self, tt, teachers, subjects, rooms, classes, lessons, checker):
        self.tt       = tt
        self.teachers = teachers
        self.subjects = subjects
        self.rooms    = rooms
        self.classes  = classes
        self.lessons  = lessons
        self.checker  = checker

        self.days   = tt.days
        self.ppd    = tt.periods_per_day
        self.days_n = DAY_NAMES[:self.days]
        self.days_s = DAY_SHORT[:self.days]

        self._build_indexes()

    # =========================================================================
    # INDEX
    # =========================================================================

    def _build_indexes(self):
        self.slot_map         = defaultdict(list)          # (day,period) → [lesson]
        self.teacher_lessons  = defaultdict(list)          # tid → [(lesson,ts)]
        self.class_lessons    = defaultdict(list)          # cid → [(lesson,ts)]
        self.room_lessons     = defaultdict(list)          # rid → [(lesson,ts)]
        self.subject_lessons  = defaultdict(list)          # sid → [(lesson,ts)]
        self.assigned         = []
        self.unassigned       = []

        for lesson in self.lessons:
            ts = self.tt.get_assignment(lesson.id)
            if ts is None:
                self.unassigned.append(lesson)
                continue
            self.assigned.append((lesson, ts))
            for p in ts.get_periods():
                self.slot_map[(ts.day, p)].append(lesson)
            for tid in lesson.teacher_ids:
                self.teacher_lessons[tid].append((lesson, ts))
            for cid in lesson.class_ids:
                self.class_lessons[cid].append((lesson, ts))
            for rid in lesson.room_ids:
                self.room_lessons[rid].append((lesson, ts))
            self.subject_lessons[lesson.subject_id].append((lesson, ts))

        # teacher → {day: sorted period list} (teaching only, breaks excluded)
        self.teacher_day_periods = defaultdict(lambda: defaultdict(list))
        for tid, entries in self.teacher_lessons.items():
            for lesson, ts in entries:
                for p in ts.get_periods():
                    if not self.tt.is_break(ts.day, p):
                        self.teacher_day_periods[tid][ts.day].append(p)
        for tid in self.teacher_day_periods:
            for day in self.teacher_day_periods[tid]:
                self.teacher_day_periods[tid][day] = sorted(set(self.teacher_day_periods[tid][day]))

    # =========================================================================
    # SECTION 1 — OVERVIEW
    # =========================================================================

    def _section_overview(self):
        fv    = self.checker.calculate_fitness(self.tt)
        score = fv if isinstance(fv, int) else fv[0]

        total_l   = len(self.lessons)
        asgn_l    = len(self.assigned)
        unasgn_l  = len(self.unassigned)
        total_p   = sum(l.duration for l in self.lessons)
        asgn_p    = sum(l.duration for l, _ in self.assigned)
        usable    = self.days * (self.ppd - 1) * len(self.classes)

        print(_hdr("TIMETABLE ANALYSIS REPORT"))
        print()
        print(_row("Fitness score",     f"{score:,}  {_quality(score)}"))
        print(_row("Lessons assigned",  f"{asgn_l}/{total_l}  [{_bar(asgn_l, total_l)}]"))
        print(_row("Periods assigned",  f"{asgn_p}/{total_p}"))
        print(_row("Slot utilisation",  f"{asgn_p/usable*100:.1f}%  [{_bar(asgn_p, usable)}]"))
        print(_row("Classes",           str(len(self.classes))))
        print(_row("Teachers",          str(len(self.teachers))))
        print(_row("Subjects",          str(len(self.subjects))))
        print(_row("Rooms",             str(len(self.rooms))))
        print(_row("Days × Periods",    f"{self.days} × {self.ppd}"))

        # Break map
        bmap = defaultdict(list)
        for (d, p) in self.tt.breaks:
            bmap[d].append(p + 1)
        print(_row("Breaks", "  ".join(
            f"{self.days_s[d]}:P{',P'.join(str(x) for x in sorted(ps))}"
            for d, ps in sorted(bmap.items())
        )))

        if unasgn_l:
            print(f"\n  {_err('✗ Unassigned lessons:')}")
            for l in self.unassigned:
                subj  = self.subjects.get(l.subject_id)
                cname = "/".join(self.classes[c].name for c in l.class_ids if c in self.classes)
                print(f"    • {subj.name if subj else l.subject_id}  ({cname})")

    # =========================================================================
    # SECTION 2 — HARD VIOLATIONS
    # =========================================================================

    def _section_hard_violations(self):
        print(_hdr("HARD CONSTRAINT VIOLATIONS"))

        v = defaultdict(list)

        for (d, p), lessons in self.slot_map.items():
            # break slot used
            if self.tt.is_break(d, p):
                for l in lessons:
                    v["Break slot used"].append(
                        f"{self.days_s[d]} P{p+1}  {self.subjects[l.subject_id].name}")

            t_seen = defaultdict(list)
            c_seen = defaultdict(list)
            r_seen = defaultdict(list)
            for l in lessons:
                for tid in l.teacher_ids: t_seen[tid].append(l)
                for cid in l.class_ids:   c_seen[cid].append(l)
                for rid in l.room_ids:    r_seen[rid].append(l)

            for tid, ls in t_seen.items():
                if len(ls) > 1:
                    v["Teacher double-booked"].append(
                        f"{self.teachers[tid].name}  {self.days_s[d]} P{p+1}  "
                        f"[{' + '.join(self.subjects[x.subject_id].name for x in ls)}]")
            for cid, ls in c_seen.items():
                if len(ls) > 1:
                    v["Class double-booked"].append(
                        f"{self.classes[cid].name}  {self.days_s[d]} P{p+1}  "
                        f"[{' + '.join(self.subjects[x.subject_id].name for x in ls)}]")
            for rid, ls in r_seen.items():
                if len(ls) > 1:
                    rname = self.rooms[rid].name if rid in self.rooms else rid
                    v["Room double-booked"].append(
                        f"{rname}  {self.days_s[d]} P{p+1}  "
                        f"[{' + '.join(self.subjects[x.subject_id].name for x in ls)}]")

        # unavailability
        unavail = {tid: set(t.unavailable_slots) for tid, t in self.teachers.items()}
        for tid, entries in self.teacher_lessons.items():
            for lesson, ts in entries:
                for p in ts.get_periods():
                    if (ts.day, p) in unavail.get(tid, set()):
                        v["Teacher teaching when unavailable"].append(
                            f"{self.teachers[tid].name}  {self.days_s[ts.day]} P{p+1}  "
                            f"({self.subjects[lesson.subject_id].name})")

        # locked
        for lesson in self.lessons:
            if not lesson.is_locked or not lesson.locked_timeslot: continue
            ts = self.tt.get_assignment(lesson.id)
            lt = lesson.locked_timeslot
            if not ts or ts.day != lt.day or ts.start_period != lt.start_period:
                subj = self.subjects.get(lesson.subject_id)
                v["Locked lesson moved"].append(
                    f"{subj.name if subj else lesson.subject_id}  "
                    f"expected {self.days_s[lt.day]} P{lt.start_period+1}")

        if not v:
            print(f"\n  {_ok('✓ No hard constraint violations detected.')}")
        else:
            for cat, items in v.items():
                print(f"\n  {_err('✗')} {_bold(cat)}  ({len(items)})")
                for item in items:
                    print(f"      {item}")

    # =========================================================================
    # SECTION 3 — LOAD SUMMARY TABLE
    # =========================================================================

    def _section_load_summary(self):
        print(_hdr("WEEKLY LOAD SUMMARY"))

        for label, entity_dict, lesson_map in [
            ("Teacher", self.teachers, self.teacher_lessons),
            ("Class",   self.classes,  self.class_lessons),
        ]:
            print(_sub(f"{label} Periods per Day"))
            print()
            print(f"  {label:<22}", end="")
            for d in self.days_s:
                print(f"  {d:>5}", end="")
            print(f"  {'Total':>7}  {'Avg':>6}")
            print(f"  {'─'*22}", end="")
            for _ in self.days_s:
                print(f"  {'─'*5}", end="")
            print(f"  {'─'*7}  {'─'*6}")

            for eid, entity in entity_dict.items():
                day_loads = defaultdict(int)
                for lesson, ts in lesson_map.get(eid, []):
                    day_loads[ts.day] += lesson.duration
                total = sum(day_loads.values())
                avg   = total / self.days
                name  = entity.name
                print(f"  {name:<22}", end="")
                for d in range(self.days):
                    load = day_loads.get(d, 0)
                    col  = _ok if load <= 4 else _warn if load <= 5 else _err
                    print(f"  {col(f'{load:>5}')}", end="")
                print(f"  {total:>7}  {avg:>6.1f}")
            print()

    # =========================================================================
    # SECTION 4 — CLASS TIMETABLE GRIDS
    # =========================================================================

    def _section_classes(self):
        print(_hdr("CLASS-WISE TIMETABLES & ANALYSIS"))

        for cid, cls in self.classes.items():
            entries = self.class_lessons.get(cid, [])
            print(_sub(cls.name))

            # visual grid
            col = 9
            print(f"\n  {'Period':<8}", end="")
            for d in self.days_n:
                print(f"  {d:<{col}}", end="")
            print()
            print(f"  {'─'*8}", end="")
            for _ in self.days_n:
                print(f"  {'─'*col}", end="")
            print()

            for p in range(self.ppd):
                print(f"  P{p+1:<7}", end="")
                for d in range(self.days):
                    if self.tt.is_break(d, p):
                        print(f"  {_dim('─BREAK─'):<{col+7}}", end="")
                        continue
                    ls = [l for l in self.slot_map.get((d, p), []) if cid in l.class_ids]
                    if ls:
                        subj = self.subjects.get(ls[0].subject_id)
                        name = subj.name[:col-1] if subj else ls[0].subject_id[:col-1]
                        marker = _warn(name) if (subj and subj.is_lab) else name
                        print(f"  {marker:<{col}}", end="")
                    else:
                        print(f"  {'---':<{col}}", end="")
                print()

            # stats
            day_loads     = defaultdict(int)
            day_periods   = defaultdict(set)
            subj_day      = defaultdict(set)
            for lesson, ts in entries:
                day_loads[ts.day] += lesson.duration
                for p in ts.get_periods():
                    if not self.tt.is_break(ts.day, p):
                        day_periods[ts.day].add(p)
                subj_day[lesson.subject_id].add(ts.day)

            # gap detection
            gaps = []
            for d in range(self.days):
                ps = sorted(day_periods[d])
                if len(ps) < 2: continue
                for i in range(ps[0], ps[-1]):
                    if i not in day_periods[d] and not self.tt.is_break(d, i):
                        gaps.append(f"{self.days_s[d]} P{i+1}")

            # same-day subject repeat
            repeats = [
                self.subjects[sid].name
                for sid, dset in subj_day.items()
                if len(dset) < sum(1 for l, _ in entries if l.subject_id == sid)
            ]

            loads = [day_loads.get(d, 0) for d in range(self.days)]
            spread = max(loads) - min(loads)

            print(f"\n  Daily load : " +
                  "  ".join(f"{self.days_s[d]}={day_loads.get(d,0)}p" for d in range(self.days)))
            print(f"  Balance    : " +
                  (_ok(f"Good (spread={spread})") if spread <= 2 else _warn(f"Uneven (spread={spread})")))
            print(f"  Gaps       : " +
                  (_ok("None") if not gaps else _warn(f"{len(gaps)} — " + ", ".join(gaps))))
            print(f"  Repeats    : " +
                  (_ok("None") if not repeats else _warn(", ".join(set(repeats)))))

    # =========================================================================
    # SECTION 5 — TEACHER ANALYSIS
    # =========================================================================

    def _section_teachers(self):
        print(_hdr("TEACHER-WISE SCHEDULE & ANALYSIS"))

        afternoon = self.ppd // 2

        for tid, teacher in self.teachers.items():
            entries = self.teacher_lessons.get(tid, [])
            print(_sub(teacher.name))

            if not entries:
                print(f"  {_dim('No lessons assigned.')}")
                continue

            # visual strip: row=day, col=period
            legend = f"  {PERIOD_CHAR}=teaching  L=lab  {BREAK_CHAR}=break  {FREE_CHAR}=free"
            print(f"\n{legend}")
            print(f"\n  {'Day':<6}", end="")
            for p in range(self.ppd):
                print(f" P{p+1}", end="")
            print()

            day_loads     = defaultdict(int)
            first_count   = 0
            afternoon_count = 0

            for d in range(self.days):
                periods = self.teacher_day_periods.get(tid, {}).get(d, [])
                print(f"  {self.days_s[d]:<6}", end="")
                for p in range(self.ppd):
                    if self.tt.is_break(d, p):
                        print(f" {BREAK_CHAR} ", end="")
                    elif p in periods:
                        ls = [l for l in self.slot_map.get((d, p), [])
                              if tid in l.teacher_ids]
                        ch = "L" if (ls and _is_lab(ls[0], self.subjects)) else PERIOD_CHAR
                        print(f" {ch} ", end="")
                    else:
                        print(f" {FREE_CHAR} ", end="")
                print()

                day_loads[d] = len(periods)
                if periods and 0 in periods:
                    first_count += 1
                if any(p >= afternoon for p in periods):
                    afternoon_count += 1

            # consecutive run analysis
            # A run of 2 is fine if it's ONE 2-period block (lab/double).
            # A run of 3 is fine if it's ONE 3-period block (triple lab).
            # Multiple single-period lessons stacked = problematic.
            problem_runs = []
            for d in range(self.days):
                periods = self.teacher_day_periods.get(tid, {}).get(d, [])
                if not periods: continue
                runs = _consecutive_runs(periods)
                for run_len in runs:
                    lessons_day = [(l, ts) for l, ts in entries if ts.day == d]
                    # is there a single block that covers this entire run?
                    covered_by_single = any(ts.duration >= run_len for _, ts in lessons_day)
                    if not covered_by_single and run_len >= 3:
                        problem_runs.append(f"{self.days_s[d]}({run_len}p)")
                    elif not covered_by_single and run_len >= 4:
                        problem_runs.append(f"{self.days_s[d]}({run_len}p)")

            # stats
            total_p     = sum(l.duration for l, _ in entries)
            classes_set = {cid for l, _ in entries for cid in l.class_ids}
            subjs_set   = {l.subject_id for l, _ in entries}
            loads       = [day_loads[d] for d in range(self.days)]
            free_days   = [self.days_s[d] for d in range(self.days) if loads[d] == 0]

            print(f"\n  Periods/week    : {total_p}")
            print(f"  Classes taught  : " +
                  ", ".join(self.classes[c].name for c in classes_set if c in self.classes))
            print(f"  Subjects        : " +
                  ", ".join(self.subjects[s].name for s in subjs_set if s in self.subjects))
            print(f"  Daily load      : " +
                  "  ".join(f"{self.days_s[d]}={day_loads[d]}" for d in range(self.days)))
            print(f"  Load spread     : " +
                  (_ok("Good") if max(loads)-min(loads) <= 2 else _warn("Uneven")) +
                  f" (max-min={max(loads)-min(loads)})")
            print(f"  First periods   : {first_count}/{self.days} days  " +
                  (_ok("✓ Fair share") if first_count >= 1 else _warn("No first periods")))
            print(f"  Afternoon days  : {afternoon_count}/{self.days}  " +
                  (_ok("✓") if afternoon_count >= 1 else _warn("No afternoon classes")))
            print(f"  Problematic runs: " +
                  (_ok("None") if not problem_runs else _warn(", ".join(problem_runs))))
            if free_days:
                print(f"  Free days       : " + _dim(", ".join(free_days)))

    # =========================================================================
    # SECTION 6 — ROOM UTILISATION
    # =========================================================================

    def _section_rooms(self):
        print(_hdr("ROOM UTILISATION"))

        break_periods = len(set(p for _, p in self.tt.breaks))
        total_usable  = self.days * (self.ppd - break_periods)

        for rid, room in self.rooms.items():
            entries = self.room_lessons.get(rid, [])
            used    = sum(l.duration for l, _ in entries)
            pct     = used / total_usable * 100 if total_usable else 0

            label  = "LAB" if room.is_lab else "CLS"
            status = _ok(f"{pct:.0f}%") if pct <= 85 else _warn(f"{pct:.0f}% ← high")

            print(f"\n  [{label}]  {_bold(room.name)}")
            print(f"  Used      : {used}/{total_usable} periods  {status}  [{_bar(used,total_usable)}]")

            day_use = defaultdict(int)
            for lesson, ts in entries:
                day_use[ts.day] += lesson.duration
            if day_use:
                peak = max(day_use.items(), key=lambda x: x[1])
                low  = min(day_use.items(), key=lambda x: x[1])
                print(f"  Peak day  : {self.days_s[peak[0]]} ({peak[1]}p)  |  "
                      f"Lightest: {self.days_s[low[0]]} ({low[1]}p)")

            subj_c = defaultdict(int)
            for lesson, _ in entries:
                subj_c[lesson.subject_id] += 1
            subj_str = ", ".join(
                f"{self.subjects[s].name}({n})"
                for s, n in sorted(subj_c.items(), key=lambda x: -x[1])
                if s in self.subjects
            )
            print(f"  Subjects  : {subj_str if subj_str else _dim('none')}")

    # =========================================================================
    # SECTION 7 — SUBJECT ANALYSIS
    # =========================================================================

    def _section_subjects(self):
        print(_hdr("SUBJECT ANALYSIS"))

        afternoon = self.ppd // 2
        last      = self.ppd - 1

        for sid, subj in self.subjects.items():
            entries = self.subject_lessons.get(sid, [])
            if not entries: continue

            tags = []
            if subj.is_difficult: tags.append("DIFFICULT")
            if subj.is_lab:       tags.append("LAB")
            tag_str = f"  [{' | '.join(tags)}]" if tags else ""

            total_p   = sum(l.duration for l, _ in entries)
            days_map  = defaultdict(int)
            positions = []

            for lesson, ts in entries:
                days_map[ts.day] += 1
                for p in ts.get_periods():
                    positions.append(p)

            avg_p  = sum(positions) / len(positions) if positions else 0
            timing = ("Early" if avg_p < self.ppd / 3 else
                      "Mid"   if avg_p < 2 * self.ppd / 3 else "Late")

            issues = []
            if subj.is_difficult and any(p == last for p in positions):
                issues.append(_warn("in last period"))
            if subj.is_lab and all(p < afternoon for p in positions):
                issues.append(_warn("lab in morning only"))
            if subj.priority <= 3 and any(p >= afternoon for p in positions):
                issues.append(_warn("core subject in afternoon"))

            # same-day repeat per class
            csd = defaultdict(lambda: defaultdict(int))
            for lesson, ts in entries:
                for cid in lesson.class_ids:
                    csd[cid][ts.day] += 1
            repeats = [
                f"{self.classes[c].name}({self.days_s[d]})"
                for c, dm in csd.items()
                for d, cnt in dm.items()
                if cnt > 1 and c in self.classes
            ]

            print(f"\n  {_bold(subj.name)}{tag_str}  priority={subj.priority}")
            print(f"    Periods/week : {total_p}  |  avg period : {timing} (≈P{avg_p+1:.1f})")
            print(f"    Day spread   : " +
                  "  ".join(f"{self.days_s[d]}×{n}" for d, n in sorted(days_map.items())))
            if repeats:
                print(f"    Same-day rep : {_warn(', '.join(repeats))}")
            if issues:
                print(f"    Issues       : " + "  |  ".join(issues))
            elif not repeats:
                print(f"    Issues       : {_ok('None')}")

    # =========================================================================
    # SECTION 8 — STRUCTURAL ANALYSIS
    # =========================================================================

    def _section_structural(self):
        print(_hdr("STRUCTURAL ANALYSIS"))

        afternoon = self.ppd // 2

        # ── First-period fairness ──────────────────────────────────────────
        print(_sub("First-Period Duty Distribution"))
        first_counts = {
            tid: sum(1 for d in range(self.days)
                     if 0 in self.teacher_day_periods.get(tid, {}).get(d, []))
            for tid in self.teachers
        }
        total_fp  = sum(first_counts.values())
        fair      = total_fp / len(self.teachers) if self.teachers else 0

        print(f"\n  Total first-period slots : {total_fp}  |  Fair share : {fair:.1f}/teacher")
        print()
        print(f"  {'Teacher':<22} {'Days':>5}  {'Bar':<22}  {'Status'}")
        print(f"  {'─'*22} {'─'*5}  {'─'*22}  {'─'*10}")
        for tid, count in sorted(first_counts.items(), key=lambda x: -x[1]):
            bar    = _bar(count, max(self.days, 1))
            diff   = count - fair
            status = (_ok("✓ fair") if abs(diff) <= 1 else
                      _warn(f"↑ +{diff:.1f}") if diff > 0 else _warn(f"↓ {diff:.1f}"))
            print(f"  {self.teachers[tid].name:<22} {count:>5}  [{bar}]  {status}")

        # ── Afternoon presence ─────────────────────────────────────────────
        print(_sub("Afternoon Teaching Presence"))
        print()
        print(f"  {'Teacher':<22} {'Aft. days':>10}  {'Bar':<22}  Status")
        print(f"  {'─'*22} {'─'*10}  {'─'*22}  {'─'*10}")
        for tid, teacher in self.teachers.items():
            aft = sum(1 for d in range(self.days)
                      if any(p >= afternoon
                             for p in self.teacher_day_periods.get(tid, {}).get(d, [])))
            bar    = _bar(aft, self.days)
            status = _ok("✓") if aft >= 1 else _warn("No afternoon classes")
            print(f"  {teacher.name:<22} {aft:>10}  [{bar}]  {status}")

        # ── Consecutive run table ──────────────────────────────────────────
        print(_sub("Consecutive Period Analysis (per teacher)"))
        print()
        print(f"  {'Teacher':<22} {'MaxRun':>7}  {'2-consec':>9}  {'3+consec':>9}  Note")
        print(f"  {'─'*22} {'─'*7}  {'─'*9}  {'─'*9}  {'─'*20}")

        for tid, teacher in self.teachers.items():
            r2 = r3 = 0
            mx = 0
            for d in range(self.days):
                periods = self.teacher_day_periods.get(tid, {}).get(d, [])
                if not periods: continue
                runs = _consecutive_runs(periods)
                lessons_day = [(l, ts) for l, ts in self.teacher_lessons.get(tid, [])
                               if ts.day == d]
                for run_len in runs:
                    mx = max(mx, run_len)
                    # check if covered by a single multi-period block
                    single = any(ts.duration >= run_len for _, ts in lessons_day)
                    if not single:
                        if run_len == 2:   r2 += 1
                        elif run_len >= 3: r3 += 1

            note = (_err(f"{r3} long run(s)!") if r3 > 0 else
                    _warn("several 2-runs") if r2 > 3 else _ok("OK"))
            print(f"  {teacher.name:<22} {mx:>7}  {r2:>9}  {r3:>9}  {note}")

        # ── Placement checks ───────────────────────────────────────────────
        print(_sub("Subject Placement Checks"))
        print()

        last         = self.ppd - 1
        diff_last    = []
        lab_morn     = []
        core_aft     = []

        for lesson, ts in self.assigned:
            subj = self.subjects.get(lesson.subject_id)
            if not subj: continue
            cname = "/".join(self.classes[c].name for c in lesson.class_ids if c in self.classes)
            for p in ts.get_periods():
                if subj.is_difficult and p == last:
                    diff_last.append(f"{subj.name} ({cname}) {self.days_s[ts.day]} P{p+1}")
                if subj.priority <= 3 and p >= afternoon:
                    core_aft.append(f"{subj.name} ({cname}) {self.days_s[ts.day]} P{p+1}")
            if subj.is_lab and all(p < afternoon for p in ts.get_periods()):
                lab_morn.append(f"{subj.name} ({cname}) {self.days_s[ts.day]}")

        def _chk(label, items, good):
            if items:
                print(f"  {_warn('⚠')}  {label} — {len(items)} occurrence(s)")
                for item in items[:5]:
                    print(f"      {item}")
                if len(items) > 5:
                    print(f"      … and {len(items)-5} more")
            else:
                print(f"  {_ok('✓')}  {label} — {good}")

        _chk("Difficult subjects in last period", diff_last,  "none in last slot")
        _chk("Core subjects in afternoon",        core_aft,   "all core subjects in morning")
        _chk("Lab subjects in morning only",      lab_morn,   "labs have afternoon slots")

    # =========================================================================
    # SECTION 9 — SUMMARY SCORECARD
    # =========================================================================

    def _section_scorecard(self):
        print(_hdr("SUMMARY SCORECARD"))
        print()

        fv    = self.checker.calculate_fitness(self.tt)
        score = fv if isinstance(fv, int) else fv[0]

        hard  = sum(
            1 for (d, p), ls in self.slot_map.items()
            for l in ls
            if self.tt.is_break(d, p)
        )
        # teacher/class/room conflicts
        for (d, p), ls in self.slot_map.items():
            ts = defaultdict(int); cs = defaultdict(int); rs = defaultdict(int)
            for l in ls:
                for tid in l.teacher_ids: ts[tid] += 1
                for cid in l.class_ids:   cs[cid] += 1
                for rid in l.room_ids:    rs[rid]  += 1
            hard += sum(1 for v in ts.values() if v > 1)
            hard += sum(1 for v in cs.values() if v > 1)
            hard += sum(1 for v in rs.values() if v > 1)

        gaps    = self._count_gaps()
        repeats = self._count_repeats()
        unasgn  = len(self.unassigned)
        no_aft  = sum(
            1 for tid in self.teachers
            if not any(p >= self.ppd // 2
                       for d in range(self.days)
                       for p in self.teacher_day_periods.get(tid, {}).get(d, []))
        )

        rows = [
            ("Overall fitness",            f"{score:,}",   _quality(score)),
            ("Hard violations",            str(hard),       _ok("✓ clear") if hard == 0 else _err(f"✗ {hard} found")),
            ("Unassigned lessons",         str(unasgn),     _ok("✓ all placed") if unasgn == 0 else _err(f"✗ {unasgn} missing")),
            ("Class schedule gaps",        str(gaps),       _ok("✓ none") if gaps == 0 else _warn(f"⚠ {gaps} gaps")),
            ("Subject same-day repeats",   str(repeats),    _ok("✓ none") if repeats == 0 else _warn(f"⚠ {repeats}")),
            ("Teachers without afternoon", str(no_aft),     _ok("✓ all covered") if no_aft == 0 else _warn(f"⚠ {no_aft} teachers")),
        ]

        for label, value, status in rows:
            print(f"  {label:<35} {value:<8}  {status}")

    def _count_gaps(self):
        total = 0
        for cid in self.classes:
            for d in range(self.days):
                ps = sorted(
                    p for lesson, ts in self.class_lessons.get(cid, [])
                    if ts.day == d
                    for p in ts.get_periods()
                    if not self.tt.is_break(d, p)
                )
                if len(ps) < 2: continue
                for i in range(ps[0], ps[-1]):
                    if i not in ps and not self.tt.is_break(d, i):
                        total += 1
        return total

    def _count_repeats(self):
        total = 0
        csd = defaultdict(lambda: defaultdict(set))
        for lesson, ts in self.assigned:
            for cid in lesson.class_ids:
                csd[(lesson.subject_id, cid)][ts.day].add(lesson.id)
        for _, day_map in csd.items():
            for _, ids in day_map.items():
                if len(ids) > 1:
                    total += len(ids) - 1
        return total

    # =========================================================================
    # MASTER ENTRY POINT
    # =========================================================================

    def full_diagnostic(self):
        W = 72
        print("\n" + "█" * W)
        print("█" + " " * 20 + "TIMETABLE FULL DIAGNOSTIC REPORT" + " " * 19 + "█")
        print("█" * W)

        self._section_overview()
        self._section_hard_violations()
        self._section_load_summary()
        self._section_classes()
        self._section_teachers()
        self._section_rooms()
        self._section_subjects()
        self._section_structural()
        self._section_scorecard()

        print("\n" + "═" * W)
        print("  End of diagnostic report.")
        print("═" * W + "\n")