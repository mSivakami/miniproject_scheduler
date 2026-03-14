import time
from structures import Break
from genetic import GeneticTimetableScheduler

DAYS           = 5
PERIODS_PER_DAY = 7
BREAK_PERIOD   = 3   # period index of the daily lunch break


def main():
    total_start = time.time()

    print("=" * 60)
    print("  TIMETABLE GENERATOR — GENETIC ALGORITHM")
    print("=" * 60)

    # ── 1. Data ───────────────────────────────────────────────────────────
    print("\n[1] Generating test data...")
    teachers, subjects, rooms, classes, lesson_blocks = create_comprehensive_test_case()

    # print(lesson_blocks)

    breaks = {}
    # Mon–Thu lunch at period 3
    for day in range(DAYS - 1):
        breaks[(day, 3)] = Break("Lunch")
    # Friday lunch at period 4
    breaks[(DAYS - 1, 4)] = Break("Lunch")

    total_periods = sum(l.duration for l in lesson_blocks)
    usable        = DAYS * (PERIODS_PER_DAY - 1) * len(classes)   # -1 for break
    print(f"     Classes  : {len(classes)}")
    print(f"     Teachers : {len(teachers)}")
    print(f"     Subjects : {len(subjects)}")
    print(f"     Lessons  : {len(lesson_blocks)}  ({total_periods} periods)")
    print(f"     Utilization: {total_periods / usable * 100:.1f}%")

    # ── 2. Evolve ─────────────────────────────────────────────────────────
    print("\n[2] Running genetic algorithm...")
    scheduler = GeneticTimetableScheduler(
        teachers=teachers,
        subjects=subjects,
        rooms=rooms,
        classes=classes,
        lesson_blocks=lesson_blocks,
        days=DAYS,
        periods_per_day=PERIODS_PER_DAY,
        breaks=breaks,
    )

    ga_start = time.time()
    best_tt, history = scheduler.evolve()
    print(history)
    ga_time = time.time() - ga_start

    final_fitness = history[-1]
    initial_fitness = history[0]
    improvement = initial_fitness - final_fitness
    pct = improvement / initial_fitness * 100 if initial_fitness else 0

    print(f"\n[3] Results")
    print(f"     GA time        : {ga_time:.1f}s")
    print(f"     Generations    : {len(history)}")
    print(f"     Initial fitness: {initial_fitness:,}")
    print(f"     Final fitness  : {final_fitness:,}")
    print(f"     Improvement    : {improvement:,}  ({pct:.1f}%)")

    # Quality label
    if final_fitness < 1_000:
        q = "PERFECT"
    elif final_fitness < 5_000:
        q = "EXCELLENT"
    elif final_fitness < 20_000:
        q = "GOOD"
    elif final_fitness < 60_000:
        q = "ACCEPTABLE"
    else:
        q = "NEEDS IMPROVEMENT"
    print(f"     Quality        : {q}")

    # Assignment coverage
    assigned   = sum(1 for l in lesson_blocks if best_tt.get_assignment(l.id))
    unassigned = len(lesson_blocks) - assigned
    print(f"     Assigned       : {assigned}/{len(lesson_blocks)}")
    if unassigned:
        print(f"     Unassigned     : {unassigned}  (shown as '---' in grid)")

    # ── 4. Print timetable ────────────────────────────────────────────────
    # print("\n[4] Timetable")
    # print_timetable(best_tt, classes, teachers, subjects, lesson_blocks)
    # print(best_tt.assignments)

    print(f"\nTotal time: {time.time() - total_start:.1f}s")

    try:
        pdf_start = time.time()
        generate_pdf_timetable(
            timetable=best_tt,
            classes=classes,
            teachers=teachers,
            subjects=subjects,
            lesson_blocks=lesson_blocks,
            filename="thengha.pdf"
        )
        pdf_time = time.time() - pdf_start
        print(f"      ✓ PDF saved as 'thengha.pdf' ({pdf_time:.2f}s)")
    except Exception as e:
        print(f"      ✗ PDF generation failed: {e}")

    analyzer = TimetableAnalyzer(
    tt=best_tt,
    teachers=teachers,
    subjects=subjects,
    rooms=rooms,
    classes=classes,
    lessons=lesson_blocks,
    checker=scheduler.checker)

    analyzer.full_diagnostic()
    
if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    main()