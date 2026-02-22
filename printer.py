from typing import Dict, List
from structures import Timetable, Class, Teacher, Subject, LessonBlock


DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"]
COL_W = 22


def print_timetable(
    tt: Timetable,
    classes: Dict[str, Class],
    teachers: Dict[str, Teacher],
    subjects: Dict[str, Subject],
    lesson_blocks: List[LessonBlock],
):
    for cls in classes.values():
        print("\n" + "=" * 100)
        print(f"  CLASS: {cls.name}")
        print("=" * 100)

        # build display grid  [period][day] = cell string
        grid = [["---"] * tt.days for _ in range(tt.periods_per_day)]

        for (day, period), brk in tt.breaks.items():
            if 0 <= day < tt.days and 0 <= period < tt.periods_per_day:
                grid[period][day] = "[BREAK]"

        for lesson in lesson_blocks:
            if lesson.class_id != cls.id:
                continue
            ts = tt.get_assignment(lesson.id)
            if not ts:
                continue

            subj    = subjects.get(lesson.subject_id)
            teacher = teachers.get(lesson.teacher_id)
            sname = subj.name.split()[1] if subj and len(subj.name.split()) > 1 else (subj.name if subj else lesson.subject_id)
            tname = teacher.name.split()[-1] if teacher else lesson.teacher_id

            cell = f"{sname}({tname})"
            if lesson.duration > 1:
                cell += f"x{lesson.duration}"
            cell = cell[:COL_W - 1]

            for p in ts.get_periods():
                if 0 <= p < tt.periods_per_day:
                    grid[p][ts.day] = cell

        # header
        print(f"{'P':4}", end="")
        for d in DAY_NAMES[:tt.days]:
            print(f"{d:<{COL_W}}", end="")
        print()
        print("-" * (4 + COL_W * tt.days))

        for p in range(tt.periods_per_day):
            print(f"{p+1:<4}", end="")
            for d in range(tt.days):
                print(f"{grid[p][d]:<{COL_W}}"[:COL_W], end="")
            print()

        print("=" * 100)