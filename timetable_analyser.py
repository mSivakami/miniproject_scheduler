from collections import defaultdict


def iter_mask(mask, periods_per_day):
    """Convert bitmask to (day,period) tuples."""
    while mask:
        lsb = mask & -mask
        idx = lsb.bit_length() - 1
        yield idx // periods_per_day, idx % periods_per_day
        mask ^= lsb


class TimetableAnalyzer:

    def __init__(self, tt, teachers, subjects, rooms, classes, lessons, checker):
        self.tt = tt
        self.teachers = teachers
        self.subjects = subjects
        self.rooms = rooms
        self.classes = classes
        self.lessons = lessons
        self.checker = checker

        self.days = tt.days
        self.periods = tt.periods_per_day
        self.day_names = ["Mon","Tue","Wed","Thu","Fri"]

    # =========================================================
    # SLOT MAP (unchanged logic)
    # =========================================================

    def build_slot_map(self):
        slot_map = defaultdict(list)
        for l in self.lessons:
            ts = self.tt.get_assignment(l.id)
            if not ts: continue
            for p in ts.get_periods():
                slot_map[(ts.day,p)].append(l)
        return slot_map

    # =========================================================
    # HARD CONSTRAINTS (unchanged)
    # =========================================================

    def hard_violations(self):

        report = defaultdict(list)
        slot_map = self.build_slot_map()

        for (d,p), lessons in slot_map.items():

            if self.tt.is_break(d,p):
                report["break_violation"].append(f"{self.day_names[d]} P{p+1}")

            teacher_seen = defaultdict(list)
            room_seen = defaultdict(list)
            class_seen = defaultdict(list)

            for l in lessons:
                teacher_seen[l.teacher_id].append(l)
                room_seen[l.room_id].append(l)
                class_seen[l.class_id].append(l)

            for tid, ls in teacher_seen.items():
                if len(ls)>1:
                    report["teacher_conflict"].append(self._format_slot(d,p,ls))

            for rid, ls in room_seen.items():
                if len(ls)>1:
                    report["room_conflict"].append(self._format_slot(d,p,ls))

            for cid, ls in class_seen.items():
                if len(ls)>1:
                    report["class_conflict"].append(self._format_slot(d,p,ls))

        # locked violations
        for l in self.lessons:
            if not l.is_locked: continue
            ts = self.tt.get_assignment(l.id)
            if not ts or ts.day!=l.locked_timeslot.day or ts.start_period!=l.locked_timeslot.start_period:
                report["locked_violation"].append(l.id)

        return report

    # =========================================================
    # TEACHER STRUCTURE (MASK VERSION)
    # =========================================================

    def teacher_structure(self):

        teacher_days = defaultdict(lambda: defaultdict(list))

        for tid, mask in self.tt.teacher_mask.items():
            for d,p in iter_mask(mask, self.periods):
                teacher_days[tid][d].append(p)

        report = defaultdict(list)
        afternoon = self.periods//2

        for tid, days in teacher_days.items():

            first_hour=0

            for d, periods in days.items():

                periods.sort()

                if not any(p>=afternoon for p in periods):
                    report["no_afternoon"].append(self.teachers[tid].name)

                if 0 in periods:
                    first_hour+=1

                streak=1
                for i in range(1,len(periods)):
                    if periods[i]==periods[i-1]+1 and not self.tt.is_break(d,periods[i-1]):
                        streak+=1
                    else:
                        if streak==2:
                            report["two_consecutive"].append(self.teachers[tid].name)
                        if streak>=3:
                            report["three_consecutive"].append(self.teachers[tid].name)
                        streak=1

            if first_hour<2:
                report["no_first_hour"].append(self.teachers[tid].name)

        return report

    # =========================================================
    # SUBJECT STRUCTURE (unchanged)
    # =========================================================

    def subject_structure(self):

        report=defaultdict(list)
        afternoon=self.periods//2
        last=self.periods-1

        for l in self.lessons:
            ts=self.tt.get_assignment(l.id)
            if not ts: continue
            subj=self.subjects[l.subject_id]

            for p in ts.get_periods():

                if subj.priority<=3 and p>=afternoon:
                    report["core_afternoon"].append(self._format_lesson(l,ts,p))

                if subj.priority>=8 and p!=last:
                    report["remedial_not_last"].append(self._format_lesson(l,ts,p))

            if getattr(subj,"is_lab",False):
                if all(p<afternoon for p in ts.get_periods()):
                    report["lab_not_afternoon"].append(self._format_lesson(l,ts,ts.start_period))

        return report

    # =========================================================
    # GAPS (unchanged)
    # =========================================================

    def gap_report(self):

        report=[]
        for cid in self.classes:

            day_map=defaultdict(list)
            for l in self.lessons:
                if l.class_id!=cid: continue
                ts=self.tt.get_assignment(l.id)
                if not ts: continue
                for p in ts.get_periods():
                    day_map[ts.day].append(p)

            for d, periods in day_map.items():
                periods=sorted(periods)
                for i in range(periods[0],periods[-1]):
                    if i not in periods and not self.tt.is_break(d,i):
                        report.append(f"{self.classes[cid].name} gap {self.day_names[d]} P{i+1}")

        return report

    # =========================================================
    # HELPERS
    # =========================================================

    def _format_slot(self,d,p,lessons):
        s=f"{self.day_names[d]} P{p+1}\n"
        for l in lessons:
            s+=f"   {self.classes[l.class_id].name} | {self.subjects[l.subject_id].name} | {self.teachers[l.teacher_id].name}\n"
        return s

    def _format_lesson(self,l,ts,p):
        return f"{self.classes[l.class_id].name} {self.subjects[l.subject_id].name} {self.day_names[ts.day]} P{p+1}"

    # =========================================================
    # MASTER REPORT
    # =========================================================

    def full_diagnostic(self):

        print("\n========== HARD ==========")
        for k,v in self.hard_violations().items():
            print(k,len(v))
            for x in v: print(x)

        print("\n========== TEACHERS ==========")
        for k,v in self.teacher_structure().items():
            print(k,len(v))
            for x in v: print(x)

        print("\n========== SUBJECTS ==========")
        for k,v in self.subject_structure().items():
            print(k,len(v))
            for x in v: print(x)

        print("\n========== GAPS ==========")
        for x in self.gap_report():
            print(x)

        print("\nFitness =",self.checker.calculate_fitness(self.tt))