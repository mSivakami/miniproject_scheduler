from structures import Teacher, Subject, Room, Class, LessonBlock, LockedLessonBuilder

def create_comprehensive_test_case():

    # ── Teachers ──────────────────────────────────────────────────────────
    teachers = {
        "T01": Teacher("T01", "Sindhu"),
        "T02": Teacher("T02", "Sathy"),
        "T03": Teacher("T03", "Jayasoorya"),
        "T04": Teacher("T04", "Lisy"),
        "T05": Teacher("T05", "Nimi"),
        "T06": Teacher("T06", "Pravesh"),
        "T07": Teacher("T07", "Anu Jayan"),
        "T08": Teacher("T08", "Rincy"),
        "T09": Teacher("T09", "Manoj Kumar"),
        "T10": Teacher("T10", "Laly"),
        "T11": Teacher("T11", "Sanish"),
        "T12": Teacher("T12", "Binitha"),
        "T13": Teacher("T13", "Ashique"),
        "T14": Teacher("T14", "Moh Ajmal"),
        "T15": Teacher("T15", "Josily"),
        "T16": Teacher("T16", "Drisya"),
        "T17": Teacher("T17", "Athira"),
        "T18": Teacher("T18", "Uma"),
        "T19": Teacher("T19", "Priyaja"),
        "T20": Teacher("T20", "Suresh"),
        "T21": Teacher("T21", "Nevin"),
        "T22": Teacher("T22", "Jeena"),
        "T23": Teacher("T23", "Saranya"),
        "T24": Teacher("T24", "Manju"),
        "T25": Teacher("T25", "Madhu"),
        "T26": Teacher("T26", "Moh Salih"),
        "T27": Teacher("T27", "Chandrabose"),
        "T28": Teacher("T28", "Joseph"),
        "T29": Teacher("T29", "Nisha"),
        "T30": Teacher("T30", "Vipin"),
        "T31": Teacher("T31", "Binoy"),
        "T32": Teacher("T32", "Nakul"),
        "T33": Teacher("T33", "Rajesh"),
        "T34": Teacher("T34", "Sunila"),
        "T35": Teacher("T35", "Jaison"),

        # FIX 8: TBD_PHY, TBD_EM, TBD_LS were placeholders causing KeyErrors.
        # Added as real teacher entries so the system runs without crashing.
        # Replace names when actual teachers are assigned.
        "TBD_PHY": Teacher("TBD_PHY", "Physics TBD"),
        "TBD_EM":  Teacher("TBD_EM",  "Eng.Mech TBD"),
        "TBD_LS":  Teacher("TBD_LS",  "Life Skills TBD"),
    }

    # ── Subjects ──────────────────────────────────────────────────────────
    subjects = {
        # Semester 2
        "S2_MATH":  Subject("S2_MATH",  "Mathematics",                      is_difficult=True,  priority=1),
        "S2_PHY":   Subject("S2_PHY",   "Physics",                          is_difficult=True,  priority=2),
        "S2_EM":    Subject("S2_EM",    "Engineering Mechanics",            is_difficult=True,  priority=3),
        "S2_CP":    Subject("S2_CP",    "C Programming",                    is_difficult=True,  priority=2),
        "S2_MI":    Subject("S2_MI",    "Measurements and Instrumentation", is_difficult=True,  priority=3),
        "S2_IPR":   Subject("S2_IPR",   "Intellectual Property Rights",     is_difficult=False, priority=6),
        "S2_IT":    Subject("S2_IT",    "IT Workshop",                      is_difficult=False, is_lab=True, priority=4),
        "S2_LS":    Subject("S2_LS",    "Life Skills",                      is_difficult=False, priority=7),
        "S2_CPLAB": Subject("S2_CPLAB", "C Programming Lab",                is_difficult=False, is_lab=True, priority=3),

        # Semester 4
        "S4_SIM":    Subject("S4_SIM",    "Synchronous & Induction Machine",     is_difficult=True,  priority=1),
        "S4_PE":     Subject("S4_PE",     "Power Electronics",                   is_difficult=True,  priority=2),
        "S4_DE":     Subject("S4_DE",     "Digital Electronics",                 is_difficult=True,  priority=2),
        "S4_ELEC":   Subject("S4_ELEC",   "Elective (RE / SSD / OOPS)",          is_difficult=True,  priority=3),
        "S4_ETH":    Subject("S4_ETH",    "Engineering Ethics",                  is_difficult=False, priority=6),
        "S4_OCLAB":  Subject("S4_OCLAB",  "OC Lab",                              is_difficult=False, is_lab=True, priority=3),
        "S4_PEDLAB": Subject("S4_PEDLAB", "Power Electronics & Driver Lab",      is_difficult=False, is_lab=True, priority=2),

        # Semester 6
        "S6_LCS":   Subject("S6_LCS",   "Linear Control Systems",               is_difficult=True,  priority=1),
        "S6_PS2":   Subject("S6_PS2",   "Power System II",                       is_difficult=True,  priority=2),
        "S6_PE":    Subject("S6_PE",    "Power Electronics",                     is_difficult=True,  priority=2),
        "S6_ELEC":  Subject("S6_ELEC",  "Elective (RE / OOPS / SC)",             is_difficult=True,  priority=3),
        "S6_MGMT":  Subject("S6_MGMT",  "Management for Engineers",              is_difficult=False, priority=6),
        "S6_CCW":   Subject("S6_CCW",   "Comprehensive Course Work",             is_difficult=False, priority=5),
        "S6_PSLAB": Subject("S6_PSLAB", "Power Systems Lab",                     is_difficult=False, is_lab=True, priority=2),
        "S6_PELAB": Subject("S6_PELAB", "Power Electronics Lab",                 is_difficult=False, is_lab=True, priority=2),

        # Semester 8
        "S8_ESD":     Subject("S8_ESD",     "Electrical System Design",          is_difficult=True,  priority=1),
        "S8_ELEC3":   Subject("S8_ELEC3",   "Elective III (EM / SGT / SMP)",     is_difficult=True,  priority=2),
        "S8_ELEC4":   Subject("S8_ELEC4",   "Elective IV (PQ / CN / DPES)",      is_difficult=True,  priority=3),
        "S8_ELEC5":   Subject("S8_ELEC5",   "Elective V (EHV / IOT / ESS)",      is_difficult=True,  priority=4),
        "S8_CCV":     Subject("S8_CCV",     "Comprehensive Viva",                is_difficult=False, priority=5),
        "S8_PROJECT": Subject("S8_PROJECT", "Project",                           is_difficult=False, is_lab=True, priority=2),
    }

    # ── Rooms ─────────────────────────────────────────────────────────────
    rooms = {
        "R_CS2_A":    Room("R_CS2_A",    "CS2_A Classroom"),
        "R_CS2_B":    Room("R_CS2_B",    "CS2_B Classroom"),
        "R_CS4_A":    Room("R_CS4_A",    "CS4_A Classroom"),
        "R_CS4_B":    Room("R_CS4_B",    "CS4_B Classroom"),
        "R_CS6_A":    Room("R_CS6_A",    "CS6_A Classroom"),
        "R_CS6_B":    Room("R_CS6_B",    "CS6_B Classroom"),
        "R_CS8_A":    Room("R_CS8_A",    "CS8_A Classroom"),
        "R_CS8_B":    Room("R_CS8_B",    "CS8_B Classroom"),
        "PROG_LAB_1": Room("PROG_LAB_1", "Programming Lab 1",        is_lab=True),
        "ELEC_LAB_1": Room("ELEC_LAB_1", "Electrical Machines Lab",  is_lab=True),
        "ELEC_LAB_2": Room("ELEC_LAB_2", "Power Electronics Lab",    is_lab=True),
        "ELEC_LAB_3": Room("ELEC_LAB_3", "Power Systems Lab",        is_lab=True),
        "PROJECT_LAB":Room("PROJECT_LAB","Project & Research Lab",   is_lab=True),
    }

    # ── Classes ───────────────────────────────────────────────────────────
    classes = {
        "CS2_A": Class("CS2_A", "Semester 2 - A"),
        "CS2_B": Class("CS2_B", "Semester 2 - B"),
        "CS4_A": Class("CS4_A", "Semester 4 - A"),
        "CS4_B": Class("CS4_B", "Semester 4 - B"),
        "CS6_A": Class("CS6_A", "Semester 6 - A"),
        "CS6_B": Class("CS6_B", "Semester 6 - B"),
        "CS8_A": Class("CS8_A", "Semester 8 - A"),
        "CS8_B": Class("CS8_B", "Semester 8 - B"),
    }

    # ── Lesson block helpers ──────────────────────────────────────────────
    lesson_blocks = []
    _n = [1]

    def gid():
        lid = f"L{_n[0]:04d}"; _n[0] += 1; return lid

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

    # ── SEMESTER 2 ────────────────────────────────────────────────────────

    # CS2_A
    singles_subject("T01",     "S2_MATH",  "CS2_A", "R_CS2_A", 4)
    singles_subject("TBD_PHY", "S2_PHY",   "CS2_A", "R_CS2_A", 3)
    singles_subject("TBD_EM",  "S2_EM",    "CS2_A", "R_CS2_A", 3)
    singles_subject("T04",     "S2_CP",    "CS2_A", "R_CS2_A", 3)
    singles_subject("T03",     "S2_MI",    "CS2_A", "R_CS2_A", 3)
    singles_subject("T07",     "S2_IPR",   "CS2_A", "R_CS2_A", 2)
    singles_subject("TBD_LS",  "S2_LS",    "CS2_A", "R_CS2_A", 2)
    doubles_lab(["T04","T31","T13","T08"], "S2_CPLAB", "CS2_A", "PROG_LAB_1")
    doubles_lab(["T07","T21"],            "S2_IT",    "CS2_A", "PROG_LAB_1")

    # CS2_B
    singles_subject("T02",     "S2_MATH",  "CS2_B", "R_CS2_B", 4)
    singles_subject("TBD_PHY", "S2_PHY",   "CS2_B", "R_CS2_B", 3)
    singles_subject("TBD_EM",  "S2_EM",    "CS2_B", "R_CS2_B", 3)
    singles_subject("T05",     "S2_CP",    "CS2_B", "R_CS2_B", 3)
    singles_subject("T06",     "S2_MI",    "CS2_B", "R_CS2_B", 3)
    singles_subject("T08",     "S2_IPR",   "CS2_B", "R_CS2_B", 2)
    singles_subject("TBD_LS",  "S2_LS",    "CS2_B", "R_CS2_B", 2)
    doubles_lab(["T05","T30","T06","T08"], "S2_CPLAB", "CS2_B", "PROG_LAB_1")
    doubles_lab(["T14","T08"],            "S2_IT",    "CS2_B", "PROG_LAB_1")

    # ── SEMESTER 4 ────────────────────────────────────────────────────────

    # CS4_A
    singles_subject("T09", "S4_SIM", "CS4_A", "R_CS4_A", 4)
    singles_subject("T10", "S4_PE",  "CS4_A", "R_CS4_A", 4)
    singles_subject("T11", "S4_DE",  "CS4_A", "R_CS4_A", 3)
    singles_subject("T16", "S4_ETH", "CS4_A", "R_CS4_A", 2)
    triples_lab(["T10","T03","T06"],             "S4_OCLAB",  "CS4_A", "ELEC_LAB_1")
    triples_lab(["T10","T33","T14","T24","T05"], "S4_PEDLAB", "CS4_A", "ELEC_LAB_2")

    # CS4_B
    singles_subject("T10", "S4_SIM", "CS4_B", "R_CS4_B", 4)
    singles_subject("T32", "S4_PE",  "CS4_B", "R_CS4_B", 4)
    singles_subject("T12", "S4_DE",  "CS4_B", "R_CS4_B", 3)
    singles_subject("T17", "S4_ETH", "CS4_B", "R_CS4_B", 2)
    triples_lab(["T34","T11","T12","T09","T07"], "S4_OCLAB",  "CS4_B", "ELEC_LAB_1")
    triples_lab(["T32","T23","T22","T13"],       "S4_PEDLAB", "CS4_B", "ELEC_LAB_2")

    # FIX 9: shared elective needs BOTH rooms so each class has its own room
    general_subject(
        ["T13","T14","T15"], "S4_ELEC",
        ["CS4_A","CS4_B"],
        ["R_CS4_A","R_CS4_B"],   # FIX 9: was "R_CS4_A" only
        3,
    )

    # ── SEMESTER 6 ────────────────────────────────────────────────────────

    # CS6_A
    singles_subject("T18", "S6_LCS",  "CS6_A", "R_CS6_A", 4)
    singles_subject("T19", "S6_PS2",  "CS6_A", "R_CS6_A", 4)
    singles_subject("T21", "S6_PE",   "CS6_A", "R_CS6_A", 3)
    singles_subject("T12", "S6_MGMT", "CS6_A", "R_CS6_A", 2)
    singles_subject("T25", "S6_CCW",  "CS6_A", "R_CS6_A", 1)
    triples_lab(["T31","T27","T15","T19","T29"], "S6_PSLAB", "CS6_A", "ELEC_LAB_3")
    triples_lab(["T17","T21","T15","T14","T18"], "S6_PELAB", "CS6_A", "ELEC_LAB_2")

    # CS6_B
    singles_subject("T04", "S6_LCS",  "CS6_B", "R_CS6_B", 4)
    singles_subject("T20", "S6_PS2",  "CS6_B", "R_CS6_B", 4)
    singles_subject("T22", "S6_PE",   "CS6_B", "R_CS6_B", 3)
    singles_subject("T25", "S6_MGMT", "CS6_B", "R_CS6_B", 2)
    singles_subject("T26", "S6_CCW",  "CS6_B", "R_CS6_B", 1)
    triples_lab(["T29","T13","T07","T20","T25"], "S6_PSLAB", "CS6_B", "ELEC_LAB_3")
    triples_lab(["T30","T26","T17","T15"],       "S6_PELAB", "CS6_B", "ELEC_LAB_2")

    # FIX 9: shared elective — both rooms
    general_subject(
        ["T23","T08","T24"], "S6_ELEC",
        ["CS6_A","CS6_B"],
        ["R_CS6_A","R_CS6_B"],   # FIX 9: was "R_CS6_A" only
        3,
    )

    # ── SEMESTER 8 ────────────────────────────────────────────────────────

    # CS8_A
    singles_subject("T27",        "S8_ESD", "CS8_A", "R_CS8_A", 3)
    singles_subject(["T22","T08"],"S8_CCV", "CS8_A", "R_CS8_A", 1)
    triples_lab(["T24","T35","T22","T31"], "S8_PROJECT", "CS8_A", "PROJECT_LAB")
    triples_lab(["T24","T35","T22","T31"], "S8_PROJECT", "CS8_A", "PROJECT_LAB")
    doubles_lab(["T24","T35","T22","T31"], "S8_PROJECT", "CS8_A", "PROJECT_LAB")
    doubles_lab(["T24","T35","T22","T31"], "S8_PROJECT", "CS8_A", "PROJECT_LAB")

    # CS8_B
    singles_subject("T17",        "S8_ESD", "CS8_B", "R_CS8_B", 3)
    singles_subject(["T12","T05"],"S8_CCV", "CS8_B", "R_CS8_B", 1)
    triples_lab(["T24","T35","T12","T19"], "S8_PROJECT", "CS8_B", "PROJECT_LAB")
    triples_lab(["T24","T35","T12","T19"], "S8_PROJECT", "CS8_B", "PROJECT_LAB")
    doubles_lab(["T24","T35","T12","T19"], "S8_PROJECT", "CS8_B", "PROJECT_LAB")
    doubles_lab(["T24","T35","T12","T19"], "S8_PROJECT", "CS8_B", "PROJECT_LAB")

    # FIX 9: shared electives — both rooms
    general_subject(
        ["T10","T05","T28"], "S8_ELEC3",
        ["CS8_A","CS8_B"],
        ["R_CS8_A","R_CS8_B"],   # FIX 9
        3,
    )
    general_subject(
        ["T21","T29","T26"], "S8_ELEC4",
        ["CS8_A","CS8_B"],
        ["R_CS8_A","R_CS8_B"],   # FIX 9
        3,
    )
    general_subject(
        ["T30","T26","T22"], "S8_ELEC5",
        ["CS8_A","CS8_B"],
        ["R_CS8_A","R_CS8_B"],   # FIX 9
        3,
    )

    return teachers, subjects, rooms, classes, lesson_blocks