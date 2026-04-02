from structures import Teacher, Subject, Room, Class, LessonBlock, LockedLessonBuilder

# ── Timetable layout (0-indexed internally) ───────────────────────────────────
#
#  7 periods per day, 5 days (Mon=0 .. Fri=4)
#  Break slots (0-indexed period):
#    Mon–Thu (days 0–3) : period 3  (= "4th period" in human speech)
#    Fri     (day  4)   : period 4  (= "5th period" in human speech) — not period 3!
#
#  Valid teaching periods (0-indexed):
#    Mon–Thu : 0,1,2  |break|  3,4,5       (3 before + 3 after = 6/day)
#    Fri     : 0,1,2,3  |break|  4,5      (4 before + 2 after = 6/day)
#
#  Total working slots per entity: 6 × 5 = 30 per week.
#  Locked-lesson periods below are 0-indexed.
# ──────────────────────────────────────────────────────────────────────────────

def create_comprehensive_test_case():
    # ── Teachers ─────────────────────────────────────────────────────────
    teachers = {
        "T01": Teacher("T01", "Jithin"),
        "T02": Teacher("T02", "Vipin"),
        "T03": Teacher("T03", "Soni"),
        "T04": Teacher("T04", "Anusree"),
        "T05": Teacher("T05", "Rajan"),
        "T06": Teacher("T06", "Rahmathulla"),
        "T07": Teacher("T07", "Bisna"),
        "T08": Teacher("T08", "Dilesh"),
        "T09": Teacher("T09", "Panchami"),
        "T10": Teacher("T10", "Minors Coordinator"),
        "T11": Teacher("T11", "Ezhudeen"),
        "T12": Teacher("T12", "Soumya"),
        "T13": Teacher("T13", "Shehin"),
        "T14": Teacher("T14", "Joby"),
        "T15": Teacher("T15", "George"),
        "T16": Teacher("T16", "Nitha"),
        "T17": Teacher("T17", "Ali-Akbar"),
        "T18": Teacher("T18", "Dhanusree"),
    }

    # ── Subjects ──────────────────────────────────────────────────────────
    subjects = {
        # ── Semester 2 ─────────────────────────────────────────────
        "S2_SCI":  Subject("S2_SCI",  "Science",                      is_difficult=False, priority=1),
        "S2_PHY":  Subject("S2_PHY",  "Physics",                      is_difficult=True,  priority=2),
        "S2_WEB":  Subject("S2_WEB",  "Hardware and Web Systems",     is_difficult=True,  priority=3),
        "S2_CP":   Subject("S2_CP",   "C Programming",                is_difficult=True,  priority=4),
        "S2_DM":   Subject("S2_DM",   "Discrete Mathematics",         is_difficult=False, priority=5),
        "S2_IPR":  Subject("S2_IPR",  "Intellectual Property Rights", is_difficult=False, priority=6),
        "S2_IT":   Subject("S2_IT",   "IT Workshop",                  is_difficult=False, is_lab=True, priority=2),

        # ── Semester 4 ─────────────────────────────────────────────
        "S4_MATH":    Subject("S4_MATH",    "Mathematics",                           is_difficult=False, priority=1),
        "S4_DBMS":    Subject("S4_DBMS",    "Database Management Systems",           is_difficult=True,  priority=2),
        "S4_OS":      Subject("S4_OS",      "Operating Systems",                     is_difficult=True,  priority=3),
        "S4_COA":     Subject("S4_COA",     "Computer Organization and Architecture",is_difficult=True,  priority=4),
        "S4_ELEC":    Subject("S4_ELEC",    "Elective",                              is_difficult=False, priority=5),
        "S4_ETH":     Subject("S4_ETH",     "Ethics",                                is_difficult=False, priority=6),
        "S4_OSLAB":   Subject("S4_OSLAB",   "Operating Systems Lab",                 is_difficult=False, is_lab=True, priority=2),
        "S4_DBMSLAB": Subject("S4_DBMSLAB", "DBMS Lab",                              is_difficult=False, is_lab=True, priority=2),
        "S4_MINOR":   Subject("S4_MINOR",   "Minor",                                 is_difficult=False, priority=6),
        "S4_HONOURS": Subject("S4_HONOURS", "Honours",                               is_difficult=False, priority=6),

        # ── Semester 6 ─────────────────────────────────────────────
        "S6_CD":     Subject("S6_CD",     "Compiler Design",                            is_difficult=True,  priority=1),
        "S6_AAD":    Subject("S6_AAD",    "Advanced Algorithms",                         is_difficult=True,  priority=2),
        "S6_CG":     Subject("S6_CG",     "Computer Graphics",                           is_difficult=True,  priority=3),
        "S6_ELEC1":  Subject("S6_ELEC1",  "Elective 1",                                  is_difficult=False, priority=4),
        "S6_IEFD":   Subject("S6_IEFD",   "Industrial Economics and Financial Decisions", is_difficult=False, priority=5),
        "S6_CCW":    Subject("S6_CCW",    "Comprehensive Course Work",                    is_difficult=False, priority=6),
        "S6_NETLAB": Subject("S6_NETLAB", "Networking Lab",                               is_difficult=False, is_lab=True, priority=2),
        "S6_MINIP":  Subject("S6_MINIP",  "Mini Project",                                 is_difficult=False, is_lab=True, priority=4),
        "S6_MINOR":  Subject("S6_MINOR",  "Minor",                                        is_difficult=False, priority=6),
        "S6_HONOURS":Subject("S6_HONOURS","Honours",                                      is_difficult=False, priority=6),

        # ── Semester 8 ─────────────────────────────────────────────
        "S8_DC":      Subject("S8_DC",      "Distributed Computing", is_difficult=True,  priority=1),
        "S8_ELEC3":   Subject("S8_ELEC3",   "Elective 3",            is_difficult=False, priority=2),
        "S8_ELEC4":   Subject("S8_ELEC4",   "Elective 4",            is_difficult=False, priority=3),
        "S8_ELEC5":   Subject("S8_ELEC5",   "Elective 5",            is_difficult=False, priority=4),
        "S8_CCV":     Subject("S8_CCV",     "Comprehensive Viva",    is_difficult=False, priority=5),
        "S8_PROJECT": Subject("S8_PROJECT", "Major Project",         is_difficult=False, is_lab=True, priority=2),
        "S8_HONOURS": Subject("S8_HONOURS", "Honours",               is_difficult=False, priority=6),
    }

    # ── Rooms ─────────────────────────────────────────────────────────────
    rooms = {
        # ── Semester Classrooms ───────────────────────────────────────────
        "R_S2": Room("R_S2", "Semester 2 Classroom"),
        "R_S4": Room("R_S4", "Semester 4 Classroom"),
        "R_S6": Room("R_S6", "Semester 6 Classroom"),
        "R_S8": Room("R_S8", "Semester 8 Classroom"),
        # ── Lab Rooms ─────────────────────────────────────────────────────
        "IT_LAB": Room("IT_LAB", "IT Laboratory", is_lab=True),
        "LAB1":   Room("LAB1",   "Laboratory 1",  is_lab=True),
        "LAB2":   Room("LAB2",   "Laboratory 2",  is_lab=True),
    }

    # ── Classes ───────────────────────────────────────────────────────────
    classes = {
        "C_S2": Class("C_S2", "Semester 2"),
        "C_S4": Class("C_S4", "Semester 4"),
        "C_S6": Class("C_S6", "Semester 6"),
        "C_S8": Class("C_S8", "Semester 8"),
    }

    # ── Lesson blocks ─────────────────────────────────────────────────────
    lesson_blocks = []
    _n = [1]

    def gid():
        lid = f"L{_n[0]:04d}"; _n[0] += 1; return lid

    locked = LockedLessonBuilder()

    # ── Locked lessons (ALL periods are 0-indexed) ─────────────────────────
    #
    #  S4_MINOR   : Wed (day=2), after-break slot → period 4  (was p5 human → p4 0-idx)
    #               Duration 2 occupies periods 4,5 — both valid on Wed ✓
    #
    #  S6_MINOR #1: Fri (day=4), after-break slot → period 5  (was p5 human on Fri which IS
    #               the break; moved one slot later to period 5, occupies 5,6 — valid ✓)
    #
    #  S6_MINOR #2: Thu (day=3), first slot → period 0  (was p1 human → p0 0-idx) ✓
    #
    #  S6_HONOURS : Fri (day=4), before-break slot → period 2  (was p3 human → p2 0-idx) ✓
    #
    #  S8_HONOURS : Tue (day=1), after-break slot → period 4  (was p4 human which IS the
    #               break on Tue; moved to period 4 which is the first after-break slot.
    #               Duration 3 occupies periods 4,5,6 — all valid ✓)
    # ──────────────────────────────────────────────────────────────────────

    # locked.add(
    #     subject_id="S4_MINOR", subject_name="Minor",
    #     teacher_ids=["T14", "T16", "T12"], class_ids="C_S4", room_ids="R_S4",
    #     day=2, period=4, duration=2,   # Wed after-break: periods 4,5 ✓
    # )
    # locked.add(
    #     subject_id="S6_MINOR", subject_name="Minor",
    #     teacher_ids="T10", class_ids="C_S6", room_ids="R_S6",
    #     day=4, period=5, duration=2,   # Fri after-break: periods 5,6 ✓
    # )
    # locked.add(
    #     subject_id="S6_MINOR", subject_name="Minor",
    #     teacher_ids="T10", class_ids="C_S6", room_ids="R_S6",
    #     day=3, period=0, duration=1,   # Thu first slot: period 0 ✓
    # )
    # locked.add(
    #     subject_id="S6_HONOURS", subject_name="Honours",
    #     teacher_ids="T14", class_ids="C_S6", room_ids="R_S6",
    #     day=4, period=2, duration=1,   # Fri before-break: period 2 ✓
    # )
    # locked.add(
    #     subject_id="S8_HONOURS", subject_name="Honours",
    #     teacher_ids="T03", class_ids="C_S8", room_ids="R_S8",
    #     day=1, period=4, duration=3,   # Tue after-break: periods 4,5,6 ✓
    # )

    subjects.update(locked.get_subjects())
    lesson_blocks.extend(locked.build(gid))

    locked.print_summary()

    # ── Helper Functions ──────────────────────────────────────────────────
    def _l(x):
        """Wrap str in list; pass list through unchanged."""
        return [x] if isinstance(x, str) else x

    def singles_subject(tid, sid, cid, rid, n=1):
        for _ in range(n):
            lesson_blocks.append(LessonBlock(gid(), _l(tid), sid, _l(cid), _l(rid), 1))

    def doubles_lab(tid, sid, cid, lab_room):
        lesson_blocks.append(LessonBlock(gid(), _l(tid), sid, _l(cid), _l(lab_room), 2))

    def triples_lab(tid, sid, cid, lab_room):
        lesson_blocks.append(LessonBlock(gid(), _l(tid), sid, _l(cid), _l(lab_room), 3))

    def general_subject(tid, sid, cid, rid, duration):
        lesson_blocks.append(LessonBlock(gid(), _l(tid), sid, _l(cid), _l(rid), duration))

    # ─────────── Lesson Blocks for Semester 2 ────────────────────────────
    singles_subject("T11", "S2_SCI", "C_S2", "R_S2", 3)   # Ezhudeen
    singles_subject("T06", "S2_PHY", "C_S2", "R_S2", 3)   # Rahmathulla
    singles_subject("T01", "S2_WEB", "C_S2", "R_S2", 3)   # Jithin
    singles_subject("T02", "S2_CP",  "C_S2", "R_S2", 3)   # Vipin (theory)
    doubles_lab(    "T02", "S2_CP",  "C_S2", "LAB1")       # Vipin (lab)
    singles_subject("T03", "S2_DM",  "C_S2", "R_S2", 4)   # Soni
    singles_subject("T04", "S2_IPR", "C_S2", "R_S2", 3)   # Anusree
    doubles_lab(    "T05", "S2_IT",  "C_S2", "IT_LAB")     # Rajan (lab ×2)
    doubles_lab(    "T05", "S2_IT",  "C_S2", "IT_LAB")

    # ─────────── Lesson Blocks for Semester 4 ────────────────────────────
    singles_subject("T02", "S4_MATH", "C_S4", "R_S4", 3)
    singles_subject("T06", "S4_DBMS", "C_S4", "R_S4", 4)
    singles_subject("T07", "S4_OS",   "C_S4", "R_S4", 4)
    singles_subject("T08", "S4_COA",  "C_S4", "R_S4", 4)
    singles_subject("T11", "S4_ELEC", "C_S4", "R_S4", 3)
    singles_subject("T04", "S4_ETH",  "C_S4", "R_S4", 2)
    triples_lab(["T08", "T09"], "S4_OSLAB",   "C_S4", ["LAB1", "LAB2"])
    triples_lab(["T11", "T16"], "S4_DBMSLAB", "C_S4", ["LAB1", "LAB2"])

    # ─────────── Lesson Blocks for Semester 6 ────────────────────────────
    singles_subject("T12", "S6_CD",    "C_S6", "R_S6", 4)
    singles_subject("T01", "S6_AAD",   "C_S6", "R_S6", 4)
    singles_subject("T13", "S6_CG",    "C_S6", "R_S6", 4)
    singles_subject("T09", "S6_ELEC1", "C_S6", "R_S6", 3)
    singles_subject("T18", "S6_IEFD",  "C_S6", "R_S6", 3)
    singles_subject("T04", "S6_CCW",   "C_S6", "R_S6", 1)
    triples_lab(["T14", "T13"], "S6_NETLAB", "C_S6", ["LAB1", "LAB2"])
    triples_lab(["T15", "T07"], "S6_MINIP",  "C_S6", "LAB1")

    # ─────────── Lesson Blocks for Semester 8 ────────────────────────────
    singles_subject("T09", "S8_DC",    "C_S8", "R_S8", 3)
    singles_subject("T15", "S8_ELEC3", "C_S8", "R_S8", 3)
    singles_subject("T13", "S8_ELEC4", "C_S8", "R_S8", 3)
    singles_subject("T16", "S8_ELEC5", "C_S8", "R_S8", 3)
    singles_subject("T03", "S8_CCV",   "C_S8", "R_S8", 1)
    # S8_PROJECT — 3hr lab (×2) + 2hr lab (×2) in each lab room
    triples_lab("T17", "S8_PROJECT", "C_S8", "LAB1")
    triples_lab("T17", "S8_PROJECT", "C_S8", "LAB2")
    doubles_lab("T17", "S8_PROJECT", "C_S8", "LAB1")
    doubles_lab("T17", "S8_PROJECT", "C_S8", "LAB2")

    return teachers, subjects, rooms, classes, lesson_blocks