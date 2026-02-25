from collections import defaultdict
from typing import List, Dict
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle,
                                 Paragraph, Spacer, PageBreak)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from structures import Teacher, Subject, Class, LessonBlock, Timetable


def generate_pdf_timetable(
    timetable: Timetable,
    classes:  Dict[str, Class],
    teachers: Dict[str, Teacher],
    subjects: Dict[str, Subject],
    lesson_blocks: List[LessonBlock],
    filename: str = "timetable.pdf",
):
    """
    Generates a PDF with:
      1) Class-wise timetable  — one page per class
      2) Teacher-wise timetable — one page per teacher

    Fully list-aware:
      lesson.teacher_ids  → List[str]
      lesson.class_ids    → List[str]
      lesson.room_ids     → List[str]
    """

    doc = SimpleDocTemplate(
        filename,
        pagesize=landscape(A4),
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    elements = []
    styles   = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=colors.HexColor("#1a1a1a"),
        spaceAfter=20,
        alignment=TA_CENTER,
    )
    section_style = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#2c3e50"),
        spaceAfter=10,
        spaceBefore=10,
        alignment=TA_LEFT,
    )

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

    # ── Pre-index lessons — O(n) once ────────────────────────────────────
    # FIX 1: iterate full lists, not shim .class_id / .teacher_id
    lessons_by_class   = defaultdict(list)
    lessons_by_teacher = defaultdict(list)

    for lesson in lesson_blocks:
        for cid in lesson.class_ids:       # FIX 1
            lessons_by_class[cid].append(lesson)
        for tid in lesson.teacher_ids:     # FIX 1
            lessons_by_teacher[tid].append(lesson)

    # ── Title page ───────────────────────────────────────────────────────
    elements.append(Paragraph("SCHOOL TIMETABLE REPORT", title_style))
    elements.append(Spacer(1, 0.2 * inch))

    # =====================================================================
    # 1) CLASS-WISE TIMETABLES
    # =====================================================================
    elements.append(Paragraph("📘 CLASS-WISE TIMETABLES", section_style))
    elements.append(Spacer(1, 0.2 * inch))

    for class_obj in classes.values():
        elements.append(Paragraph(f"Class: {class_obj.name}", section_style))

        # grid[day][period] = list of cell-strings
        grid = [[[] for _ in range(timetable.periods_per_day)]
                for _ in range(timetable.days)]

        # Mark breaks
        for (day, period), break_obj in timetable.breaks.items():
            if 0 <= day < timetable.days and 0 <= period < timetable.periods_per_day:
                grid[day][period].append(f"🔔 {break_obj.name}")

        # Fill lessons — use pre-index (FIX 1 + FIX 2)
        for lesson in lessons_by_class[class_obj.id]:
            timeslot = timetable.get_assignment(lesson.id)
            if not timeslot:
                continue

            subj_name = subjects[lesson.subject_id].name

            # FIX 3: join all teacher surnames
            teacher_name = "/".join(
                teachers[tid].name.split()[-1]
                for tid in lesson.teacher_ids
                if tid in teachers
            )

            # FIX 5: join all rooms
            room_label = "/".join(lesson.room_ids)

            periods = timeslot.get_periods()
            for i, period in enumerate(periods):
                if i == 0:
                    if lesson.duration == 1:
                        marker = f"{subj_name}\n({teacher_name})\n{room_label}"
                    else:
                        marker = f"┌ {subj_name}\n({teacher_name})"
                elif i == len(periods) - 1:
                    marker = f"└ [{lesson.duration}p]\n{room_label}"
                else:
                    marker = "│"
                grid[timeslot.day][period].append(marker)

        elements.append(_build_table(
            grid, timetable, day_names, styles,
            header_color=colors.HexColor("#3498db"),
        ))
        elements.append(PageBreak())

    # =====================================================================
    # 2) TEACHER-WISE TIMETABLES
    # =====================================================================
    elements.append(Paragraph("👨‍🏫 TEACHER-WISE TIMETABLES", section_style))
    elements.append(Spacer(1, 0.2 * inch))

    teacher_list = list(teachers.values())

    for t_idx, teacher_obj in enumerate(teacher_list):
        elements.append(Paragraph(f"Teacher: {teacher_obj.name}", section_style))

        grid = [[[] for _ in range(timetable.periods_per_day)]
                for _ in range(timetable.days)]

        # Mark breaks
        for (day, period), break_obj in timetable.breaks.items():
            if 0 <= day < timetable.days and 0 <= period < timetable.periods_per_day:
                grid[day][period].append(f"🔔 {break_obj.name}")

        # Fill lessons — use pre-index (FIX 1)
        for lesson in lessons_by_teacher[teacher_obj.id]:
            timeslot = timetable.get_assignment(lesson.id)
            if not timeslot:
                continue

            subj_name = subjects[lesson.subject_id].name

            # FIX 4: join all class names (handles shared lessons)
            class_label = "/".join(
                classes[cid].name
                for cid in lesson.class_ids
                if cid in classes
            )

            # FIX 5: join all rooms
            room_label = "/".join(lesson.room_ids)

            # Annotate co-teachers so this teacher knows who they share with
            if len(lesson.teacher_ids) > 1:
                others = [
                    teachers[tid].name.split()[-1]
                    for tid in lesson.teacher_ids
                    if tid != teacher_obj.id and tid in teachers
                ]
                if others:
                    # show at most 2 co-teacher names to keep cell compact
                    co = "/".join(others[:2])
                    if len(others) > 2:
                        co += f"+{len(others)-2}"
                    subj_name += f" +{co}"

            periods = timeslot.get_periods()
            for i, period in enumerate(periods):
                if i == 0:
                    if lesson.duration == 1:
                        marker = f"{subj_name}\n({class_label})\n{room_label}"
                    else:
                        marker = f"┌ {subj_name}\n({class_label})"
                elif i == len(periods) - 1:
                    marker = f"└ [{lesson.duration}p]\n{room_label}"
                else:
                    marker = "│"
                grid[timeslot.day][period].append(marker)

        elements.append(_build_table(
            grid, timetable, day_names, styles,
            header_color=colors.HexColor("#27ae60"),
        ))

        if t_idx < len(teacher_list) - 1:
            elements.append(PageBreak())

    doc.build(elements)
    print(f"\n✅ PDF generated: {filename}")


# ── Shared table builder ──────────────────────────────────────────────────

def _build_table(grid, timetable, day_names, styles, header_color):
    """Build a ReportLab Table from grid[day][period]."""

    table_data = [["Period"] + day_names[:timetable.days]]

    for period in range(timetable.periods_per_day):
        row = [f"{period + 1}"]
        for day in range(timetable.days):
            content = "\n".join(grid[day][period]) if grid[day][period] else "---"
            row.append(Paragraph(content, styles["Normal"]))
        table_data.append(row)

    col_widths = [0.6 * inch] + [1.5 * inch] * timetable.days
    table      = Table(table_data, colWidths=col_widths)

    style = TableStyle([
        ("BACKGROUND",     (0, 0),  (-1,  0), header_color),
        ("TEXTCOLOR",      (0, 0),  (-1,  0), colors.whitesmoke),
        ("ALIGN",          (0, 0),  (-1, -1), "CENTER"),
        ("VALIGN",         (0, 0),  (-1, -1), "MIDDLE"),
        ("FONTNAME",       (0, 0),  (-1,  0), "Helvetica-Bold"),
        ("FONTSIZE",       (0, 0),  (-1,  0), 11),
        ("BOTTOMPADDING",  (0, 0),  (-1,  0), 12),
        ("BACKGROUND",     (0, 1),  ( 0, -1), colors.HexColor("#ecf0f1")),
        ("FONTNAME",       (0, 1),  ( 0, -1), "Helvetica-Bold"),
        ("GRID",           (0, 0),  (-1, -1), 0.5, colors.grey),
        ("FONTSIZE",       (1, 1),  (-1, -1), 8),
        ("ROWHEIGHT",      (0, 1),  (-1, -1), 0.6 * inch),
        ("ROWBACKGROUNDS", (1, 1),  (-1, -1),
         [colors.white, colors.HexColor("#f8f9fa")]),
    ])

    # Highlight break cells
    for (day, period) in timetable.breaks:
        if 0 <= day < timetable.days and 0 <= period < timetable.periods_per_day:
            style.add("BACKGROUND", (day + 1, period + 1), (day + 1, period + 1),
                      colors.HexColor("#ffe4b5"))
            style.add("FONTNAME",   (day + 1, period + 1), (day + 1, period + 1),
                      "Helvetica-Bold")

    table.setStyle(style)
    return table