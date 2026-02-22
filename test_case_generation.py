from structures import (
    Teacher, Subject, Room, Class, LessonBlock,
    LockedLessonBuilder,
)


def create_comprehensive_test_case():
    """
    8 classes: Grade 9-12, sections A and B.
    Each class has 5 subjects, each taught 5 periods/week.

    Lab subjects  : 3-period block + 2 single periods (= 5 total)
    Other subjects: 5 single periods

    Locked events
    -------------
    Friday P5 (index 4) — Weekly Assembly.
      Each class has its own teacher so no simultaneous teacher conflict.

    Wednesday P6 (index 5) — Sports for G9A and G9B.
      Separate coaches (T15, T16) so no conflict.
    """

    # ── Teachers ──────────────────────────────────────────────────────────
    teachers = {
        "T01": Teacher("T01", "Dr. Anderson",  unavailable_slots=[(4, 6),(3,6)]),
        "T02": Teacher("T02", "Ms. Bryant"),
        "T03": Teacher("T03", "Mr. Chen"),
        "T04": Teacher("T04", "Dr. Davis",     unavailable_slots=[(2, 0)]),
        "T05": Teacher("T05", "Ms. Evans"),
        "T06": Teacher("T06", "Dr. Foster"),
        "T07": Teacher("T07", "Mrs. Garcia"),
        "T08": Teacher("T08", "Mr. Harris"),
        "T09": Teacher("T09", "Ms. Ibrahim"),
        "T10": Teacher("T10", "Dr. Jackson"),
        "T11": Teacher("T11", "Mr. Kumar",     unavailable_slots=[(1, 6)]),
        "T12": Teacher("T12", "Ms. Lee"),
        "T13": Teacher("T13", "Mr. Martinez"),
        "T14": Teacher("T14", "Ms. Nelson"),
        "T15": Teacher("T15", "Coach O'Brien"),
        "T16": Teacher("T16", "Coach Smith"),
    }

    # ── Subjects ──────────────────────────────────────────────────────────
    subjects = {
        # Grade 9
        "G9_MATH": Subject("G9_MATH",  "Grade 9 Mathematics",       is_difficult=True,  priority=2),
        "G9_SCI":  Subject("G9_SCI",   "Grade 9 General Science",   is_difficult=True,  is_lab=True, priority=3),
        "G9_ENG":  Subject("G9_ENG",   "Grade 9 English",           is_difficult=False, priority=5),
        "G9_HIST": Subject("G9_HIST",  "Grade 9 World History",     is_difficult=False, priority=5),
        "G9_ART":  Subject("G9_ART",   "Grade 9 Art",               is_difficult=False, priority=6),
        # Grade 10
        "G10_MATH": Subject("G10_MATH", "Grade 10 Algebra",         is_difficult=True,  priority=2),
        "G10_BIO":  Subject("G10_BIO",  "Grade 10 Biology",         is_difficult=True,  is_lab=True, priority=3),
        "G10_ENG":  Subject("G10_ENG",  "Grade 10 Literature",      is_difficult=False, priority=5),
        "G10_GEO":  Subject("G10_GEO",  "Grade 10 Geography",       is_difficult=False, priority=5),
        "G10_PE":   Subject("G10_PE",   "Grade 10 Physical Ed",     is_difficult=False, priority=6),
        # Grade 11
        "G11_CALC": Subject("G11_CALC", "Grade 11 Calculus",        is_difficult=True,  priority=2),
        "G11_CHEM": Subject("G11_CHEM", "Grade 11 Chemistry",       is_difficult=True,  is_lab=True, priority=3),
        "G11_ENG":  Subject("G11_ENG",  "Grade 11 Adv. English",    is_difficult=True,  priority=4),
        "G11_ECON": Subject("G11_ECON", "Grade 11 Economics",       is_difficult=False, priority=5),
        "G11_CS":   Subject("G11_CS",   "Grade 11 Computer Sci.",   is_difficult=True,  is_lab=True, priority=4),
        # Grade 12
        "G12_MATH": Subject("G12_MATH", "Grade 12 Adv. Math",      is_difficult=True,  priority=2),
        "G12_PHY":  Subject("G12_PHY",  "Grade 12 Physics",        is_difficult=True,  is_lab=True, priority=3),
        "G12_ENG":  Subject("G12_ENG",  "Grade 12 English Lit.",   is_difficult=True,  priority=4),
        "G12_GOV":  Subject("G12_GOV",  "Grade 12 Government",     is_difficult=False, priority=5),
        "G12_CS":   Subject("G12_CS",   "Grade 12 Adv. CS",        is_difficult=True,  is_lab=True, priority=4),
    }

    # ── Rooms ─────────────────────────────────────────────────────────────
    rooms = {
        "G9A":       Room("G9A",        "Grade 9A Classroom"),
        "G9B":       Room("G9B",        "Grade 9B Classroom"),
        "G10A":      Room("G10A",       "Grade 10A Classroom"),
        "G10B":      Room("G10B",       "Grade 10B Classroom"),
        "G11A":      Room("G11A",       "Grade 11A Classroom"),
        "G11B":      Room("G11B",       "Grade 11B Classroom"),
        "G12A":      Room("G12A",       "Grade 12A Classroom"),
        "G12B":      Room("G12B",       "Grade 12B Classroom"),
        "SCI_LAB1":  Room("SCI_LAB1",   "Science Lab 1",        is_lab=True),
        "BIO_LAB":   Room("BIO_LAB",    "Biology Lab",          is_lab=True),
        "CHEM_LAB":  Room("CHEM_LAB",   "Chemistry Lab",        is_lab=True),
        "PHY_LAB":   Room("PHY_LAB",    "Physics Lab",          is_lab=True),
        "CS_LAB":    Room("CS_LAB",     "CS Lab",               is_lab=True),
        "ART_STUDIO":Room("ART_STUDIO", "Art Studio"),
        "GYM":       Room("GYM",        "Gymnasium"),
        "AUDITORIUM":Room("AUDITORIUM", "Auditorium"),
    }

    # ── Classes ───────────────────────────────────────────────────────────
    classes = {
        "G9A":  Class("G9A",  "Grade 9 Section A"),
        "G9B":  Class("G9B",  "Grade 9 Section B"),
        "G10A": Class("G10A", "Grade 10 Section A"),
        "G10B": Class("G10B", "Grade 10 Section B"),
        "G11A": Class("G11A", "Grade 11 Section A"),
        "G11B": Class("G11B", "Grade 11 Section B"),
        "G12A": Class("G12A", "Grade 12 Section A"),
        "G12B": Class("G12B", "Grade 12 Section B"),
    }

    # ── Lesson blocks ─────────────────────────────────────────────────────
    lesson_blocks = []
    _n = [1]

    def gid():
        lid = f"L{_n[0]:04d}"; _n[0] += 1; return lid

    # Locked events
    builder = LockedLessonBuilder()

    # # Assembly — each class uses a DIFFERENT teacher to avoid conflicts.
    # # T14 manages G9A, T13 G9B, T08 G10A, T10 G10B,
    # # T07 G11A, T09 G11B, T01 G12A, T12 G12B.
    # for cls, teacher in [
    #     ("G9A",  "T14"), ("G9B",  "T13"),
    #     ("G10A", "T08"), ("G10B", "T10"),
    #     ("G11A", "T07"), ("G11B", "T09"),
    #     ("G12A", "T01"), ("G12B", "T12"),
    # ]:
    #     builder.add_weekly_event(
    #         subject_id="ASSEMBLY", subject_name="Weekly Assembly",
    #         teacher_id=teacher, class_id=cls, room_id="AUDITORIUM",
    #         day=4, period=4, duration=1, description="Friday assembly",
    #     )

    # Sports — separate coaches for G9A and G9B
    builder.add_weekly_event(
        subject_id="SPORTS", subject_name="Sports",
        teacher_id="T15", class_id="G9A", room_id="GYM",
        day=2, period=5, duration=1, description="G9A sports",
    )
    builder.add_weekly_event(
        subject_id="SPORTS", subject_name="Sports",
        teacher_id="T16", class_id="G9B", room_id="GYM",
        day=2, period=6, duration=1, description="G9B sports",
    )

    builder.print_summary()
    subjects.update(builder.get_locked_subjects())
    lesson_blocks.extend(builder.build_lesson_blocks(gid))

    # ── helpers ───────────────────────────────────────────────────────────

    def singles(tid, sid, cid, rid, n=5):
        for _ in range(n):
            lesson_blocks.append(LessonBlock(gid(), tid, sid, cid, rid, 1))

    def lab(tid, sid, cid, lab_room, cls_room):
        """3-period lab block + 2 theory singles = 5 periods."""
        lesson_blocks.append(LessonBlock(gid(), tid, sid, cid, lab_room,  3))
        lesson_blocks.append(LessonBlock(gid(), tid, sid, cid, cls_room,  1))
        lesson_blocks.append(LessonBlock(gid(), tid, sid, cid, cls_room,  1))

    # ── Grade 9 ───────────────────────────────────────────────────────────
    singles("T01", "G9_MATH", "G9A", "G9A")
    singles("T01", "G9_MATH", "G9B", "G9B")

    lab("T04", "G9_SCI", "G9A", "SCI_LAB1", "G9A")
    lab("T04", "G9_SCI", "G9B", "SCI_LAB1", "G9B")

    singles("T07", "G9_ENG",  "G9A", "G9A")
    singles("T07", "G9_ENG",  "G9B", "G9B")

    singles("T09", "G9_HIST", "G9A", "G9A")
    singles("T09", "G9_HIST", "G9B", "G9B")

    singles("T13", "G9_ART",  "G9A", "ART_STUDIO")
    singles("T13", "G9_ART",  "G9B", "ART_STUDIO")

    # ── Grade 10 ──────────────────────────────────────────────────────────
    singles("T02", "G10_MATH", "G10A", "G10A")
    singles("T02", "G10_MATH", "G10B", "G10B")

    lab("T05", "G10_BIO", "G10A", "BIO_LAB", "G10A")
    lab("T05", "G10_BIO", "G10B", "BIO_LAB", "G10B")

    singles("T08", "G10_ENG", "G10A", "G10A")
    singles("T08", "G10_ENG", "G10B", "G10B")

    singles("T10", "G10_GEO", "G10A", "G10A")
    singles("T10", "G10_GEO", "G10B", "G10B")

    singles("T15", "G10_PE",  "G10A", "GYM")
    singles("T15", "G10_PE",  "G10B", "GYM")

    # ── Grade 11 ──────────────────────────────────────────────────────────
    singles("T03", "G11_CALC", "G11A", "G11A")
    singles("T03", "G11_CALC", "G11B", "G11B")

    lab("T06", "G11_CHEM", "G11A", "CHEM_LAB", "G11A")
    lab("T06", "G11_CHEM", "G11B", "CHEM_LAB", "G11B")

    singles("T07", "G11_ENG",  "G11A", "G11A")
    singles("T07", "G11_ENG",  "G11B", "G11B")

    singles("T09", "G11_ECON", "G11A", "G11A")
    singles("T09", "G11_ECON", "G11B", "G11B")

    singles("T11", "G11_CS",   "G11A", "CS_LAB")
    singles("T11", "G11_CS",   "G11B", "CS_LAB")

    # ── Grade 12 ──────────────────────────────────────────────────────────
    singles("T01", "G12_MATH", "G12A", "G12A")
    singles("T01", "G12_MATH", "G12B", "G12B")

    lab("T04", "G12_PHY", "G12A", "PHY_LAB", "G12A")
    lab("T04", "G12_PHY", "G12B", "PHY_LAB", "G12B")

    singles("T08", "G12_ENG", "G12A", "G12A")
    singles("T08", "G12_ENG", "G12B", "G12B")

    singles("T10", "G12_GOV", "G12A", "G12A")
    singles("T10", "G12_GOV", "G12B", "G12B")

    singles("T12", "G12_CS",  "G12A", "CS_LAB")
    singles("T12", "G12_CS",  "G12B", "CS_LAB")

    return teachers, subjects, rooms, classes, lesson_blocks