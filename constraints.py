from collections import defaultdict

# ============================================================
# HELPER BIT OPERATIONS
# ============================================================

def popcount(x: int) -> int:
    return x.bit_count()

def iter_bits(mask: int):
    """Yield indexes of set bits."""
    while mask:
        lsb = mask & -mask
        yield lsb.bit_length() - 1
        mask ^= lsb

def variance5(values):
    """Manual variance (faster than numpy for small lists)"""
    mean = sum(values) / len(values)
    return int(sum((v - mean) * (v - mean) for v in values) / len(values))


# ============================================================
# CONSTRAINT CHECKER
# ============================================================

class ConstraintChecker:

    HARD = {
        "teacher_conflict":    10_000,
        "room_conflict":       10_000,
        "class_conflict":      10_000,
        "teacher_unavailable": 10_000,
        "break_violation":     20_000,
        "locked_violation":    50_000,
        "unassigned":          15_000,
    }

    SOFT = {
        "difficult_last":  20,
        "subject_repeat":  15,
        "gap":             10,
        "class_balance":    5,
        "teacher_balance":  5,
    }

    STRUCTURAL = {
        "three_consecutive": 800,
        "two_consecutive":   100,
        "no_afternoon":      200,
        "lab_not_afternoon": 150,
        "core_afternoon":     40,
        "no_first_hour":      20,
        "remedial_not_last":  20,
    }

    # --------------------------------------------------------

    def __init__(self, teachers, subjects, rooms, classes, lesson_blocks):
        self.teachers      = teachers
        self.subjects      = subjects
        self.rooms         = rooms
        self.classes       = classes
        self.lesson_blocks = lesson_blocks

        self.difficult_subjects = {sid for sid, s in subjects.items() if s.is_difficult}
        self.lab_subjects = {sid for sid, s in subjects.items() if getattr(s, "is_lab", False)}
        self.core_subjects = {sid for sid, s in subjects.items() if getattr(s, "priority", 10) <= 3}
        self.remedial_subjects = {sid for sid, s in subjects.items() if getattr(s, "priority", 0) >= 8}

        self.teacher_unavailable = {tid: set(t.unavailable_slots) for tid, t in teachers.items()}

    # ============================================================
    # MAIN FITNESS
    # ============================================================

    def calculate_fitness(self, tt):
        days = tt.days
        ppd = tt.periods_per_day
        total_slots = days * ppd

        # slot occupancy counters
        teacher_slot = [defaultdict(int) for _ in range(total_slots)]
        class_slot   = [defaultdict(int) for _ in range(total_slots)]
        room_slot    = [defaultdict(int) for _ in range(total_slots)]

        class_day_load = defaultdict(lambda: defaultdict(int))
        teacher_day_load = defaultdict(lambda: defaultdict(int))
        class_subject_day = defaultdict(lambda: defaultdict(int))

        teacher_day_bits = defaultdict(lambda: defaultdict(int))
        teacher_week_bits = defaultdict(int)
        subject_slots = []

        teacher_conflicts = 0
        room_conflicts = 0
        class_conflicts = 0
        teacher_unavailable = 0
        break_violations = 0
        locked_violations = 0
        unassigned = 0
        difficult_last = 0

        # =====================================================
        # SINGLE PASS OVER LESSONS
        # =====================================================

        for lesson in self.lesson_blocks:

            ts = tt.get_assignment(lesson.id)
            if ts is None:
                unassigned += 1
                continue

            # locked check
            if lesson.is_locked and lesson.locked_timeslot:
                lt = lesson.locked_timeslot
                if ts.day != lt.day or ts.start_period != lt.start_period:
                    locked_violations += 1

            for p in ts.get_periods():

                if not (0 <= ts.day < days and 0 <= p < ppd):
                    continue

                idx = ts.day * ppd + p

                teacher_slot[idx][lesson.teacher_id] += 1
                class_slot[idx][lesson.class_id] += 1
                room_slot[idx][lesson.room_id] += 1

                if teacher_slot[idx][lesson.teacher_id] > 1: teacher_conflicts += 1
                if class_slot[idx][lesson.class_id] > 1: class_conflicts += 1
                if room_slot[idx][lesson.room_id] > 1: room_conflicts += 1

                if tt.is_break(ts.day, p):
                    break_violations += 1

                if (ts.day, p) in self.teacher_unavailable.get(lesson.teacher_id, set()):
                    teacher_unavailable += 1

                if lesson.subject_id in self.difficult_subjects and p == ppd - 1:
                    difficult_last += 1

                # structural tracking
                bit = 1 << p
                teacher_day_bits[lesson.teacher_id][ts.day] |= bit
                teacher_week_bits[lesson.teacher_id] |= (1 << idx)
                subject_slots.append((lesson.subject_id, ts.day, p))

            class_day_load[lesson.class_id][ts.day] += lesson.duration
            teacher_day_load[lesson.teacher_id][ts.day] += lesson.duration
            class_subject_day[(lesson.class_id, lesson.subject_id)][ts.day] += 1

        # =====================================================
        # POST PROCESS
        # =====================================================

        subject_repeat = sum(
            max(0, cnt - 1)
            for day_map in class_subject_day.values()
            for cnt in day_map.values()
        )

        class_balance = sum(variance5([load.get(d, 0) for d in range(days)]) for load in class_day_load.values())
        teacher_balance = sum(variance5([load.get(d, 0) for d in range(days)]) for load in teacher_day_load.values())

        gaps = self._compute_gaps_bitwise(class_slot, days, ppd)

        three, two = self._sequence_penalties_bits(teacher_day_bits)

        no_afternoon = sum(
            1 for tid in self.teachers
            if not any(p >= ppd//2 for (_,p) in [(i//ppd, i%ppd) for i in iter_bits(teacher_week_bits.get(tid,0))])
        )

        no_first = sum(1 for tid in self.teachers if not (teacher_week_bits.get(tid,0) & 1))

        core_afternoon = sum(1 for sid,_,p in subject_slots if sid in self.core_subjects and p >= ppd//2)
        lab_not_afternoon = sum(1 for sid,_,p in subject_slots if sid in self.lab_subjects and p < ppd//2)
        remedial_not_last = sum(1 for sid,_,p in subject_slots if sid in self.remedial_subjects and p != ppd-1)

        # =====================================================
        # FINAL SCORE
        # =====================================================

        p = 0
        p += teacher_conflicts * self.HARD["teacher_conflict"]
        p += room_conflicts * self.HARD["room_conflict"]
        p += class_conflicts * self.HARD["class_conflict"]
        p += teacher_unavailable * self.HARD["teacher_unavailable"]
        p += break_violations * self.HARD["break_violation"]
        p += locked_violations * self.HARD["locked_violation"]
        p += unassigned * self.HARD["unassigned"]

        p += difficult_last * self.SOFT["difficult_last"]
        p += subject_repeat * self.SOFT["subject_repeat"]
        p += gaps * self.SOFT["gap"]
        p += class_balance * self.SOFT["class_balance"]
        p += teacher_balance * self.SOFT["teacher_balance"]

        p += three * self.STRUCTURAL["three_consecutive"]
        p += two * self.STRUCTURAL["two_consecutive"]
        p += no_afternoon * self.STRUCTURAL["no_afternoon"]
        p += no_first * self.STRUCTURAL["no_first_hour"]
        p += core_afternoon * self.STRUCTURAL["core_afternoon"]
        p += lab_not_afternoon * self.STRUCTURAL["lab_not_afternoon"]
        p += remedial_not_last * self.STRUCTURAL["remedial_not_last"]

        return p

    # ============================================================
    # GAP DETECTION (BITWISE)
    # ============================================================

    def _compute_gaps_bitwise(self, class_slot, days, ppd):
        penalty = 0
        for cid in self.classes:
            for day in range(days):
                mask = 0
                for p in range(ppd):
                    idx = day*ppd+p
                    if class_slot[idx].get(cid,0)>0:
                        mask |= 1<<p
                if mask==0:
                    continue
                first = (mask & -mask).bit_length()-1
                last = mask.bit_length()-1
                segment=((1<<(last-first+1))-1)<<first
                gaps = segment & ~mask
                penalty+=gaps.bit_count()
        return penalty

    # ============================================================
    # CONSECUTIVE PERIODS
    # ============================================================

    def _sequence_penalties_bits(self,teacher_day_bits):
        three=two=0
        for tid,dmap in teacher_day_bits.items():
            for day,mask in dmap.items():
                run=0
                for p in range(64):
                    if mask&(1<<p):
                        run+=1
                    else:
                        if run>=3: three+=1
                        elif run==2: two+=1
                        run=0
                if run>=3: three+=1
                elif run==2: two+=1
        return three,two