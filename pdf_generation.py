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


# =========================================================
# SUBJECT COLOR PALETTE  (very light, diverse pastels)
# =========================================================

_SUBJECT_COLORS = [
    "#D6EAF8",  # slightly darker sky blue
    "#D5F5E3",  # slightly darker mint green
    "#FCF3CF",  # slightly darker lemon
    "#FAD7A0",  # slightly darker peach
    "#EBDEF0",  # slightly darker lavender
    "#D1F2EB",  # slightly darker aqua
    "#F5C6CB",  # slightly darker rose
    "#D4E6F1",  # slightly darker powder blue
    "#E0E7FF",  # slightly darker periwinkle
    "#FADBD8",  # slightly darker blush
    "#D4EFDF",  # slightly darker sage
    "#FDEBD0",  # slightly darker apricot
    "#D6DBFF",  # slightly darker indigo tint
    "#DFFFD6",  # slightly darker honeydew
    "#FFE4E1",  # slightly darker pink
    "#E0FFFF",  # slightly darker azure
    "#FFF3B0",  # slightly darker cornsilk
    "#E6D6FF",  # slightly darker thistle
    "#DFFFE0",  # slightly darker pale green
    "#FFECD1",  # slightly darker bisque
]


def _build_subject_color_map(lesson_blocks: List[LessonBlock]) -> Dict[str, colors.HexColor]:
    """Assign a unique light pastel to each unique subject_id, in encounter order."""
    seen = []
    for lesson in lesson_blocks:
        if lesson.subject_id not in seen:
            seen.append(lesson.subject_id)
    return {
        sid: colors.HexColor(_SUBJECT_COLORS[i % len(_SUBJECT_COLORS)])
        for i, sid in enumerate(seen)
    }


# =========================================================
# MAIN PDF GENERATOR
# =========================================================

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

    Features:
      - Each subject gets a consistent light pastel background color
      - Multi-period (double/triple) blocks are vertically merged into one cell
      - Break slots highlighted in warm amber
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

    # Build subject → color map once, shared across all pages
    subject_color_map = _build_subject_color_map(lesson_blocks)

    # Pre-index lessons — O(n) once
    lessons_by_class   = defaultdict(list)
    lessons_by_teacher = defaultdict(list)
    for lesson in lesson_blocks:
        for cid in lesson.class_ids:
            lessons_by_class[cid].append(lesson)
        for tid in lesson.teacher_ids:
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

        # grid[day][period] = (lines: List[str], subject_id: str | None)
        grid = [[([], None) for _ in range(timetable.periods_per_day)]
                for _ in range(timetable.days)]

        # Mark breaks
        for (day, period), break_obj in timetable.breaks.items():
            if 0 <= day < timetable.days and 0 <= period < timetable.periods_per_day:
                lines, _ = grid[day][period]
                lines.append(f"🔔 {break_obj.name}")

        # merge_spans: {(day, start_period): duration} for multi-period lessons
        merge_spans = {}

        for lesson in lessons_by_class[class_obj.id]:
            timeslot = timetable.get_assignment(lesson.id)
            if not timeslot:
                continue

            subj_name    = subjects[lesson.subject_id].name
            teacher_name = "/".join(
                teachers[tid].name.split()[-1]
                for tid in lesson.teacher_ids
                if tid in teachers
            )
            room_label = "/".join(lesson.room_ids)
            sid        = lesson.subject_id

            if lesson.duration > 1:
                merge_spans[(timeslot.day, timeslot.start_period)] = lesson.duration

            for i, period in enumerate(timeslot.get_periods()):
                lines, _ = grid[timeslot.day][period]
                if i == 0:
                    # Only first period gets content — rest are blank (merged away)
                    if lesson.duration == 1:
                        lines.append(f"{subj_name}\n({teacher_name})\n{room_label}")
                    else:
                        lines.append(f"{subj_name}\n({teacher_name})\n{room_label}\n[{lesson.duration}p]")
                grid[timeslot.day][period] = (lines, sid)

        elements.append(_build_table(
            grid, timetable, day_names, styles,
            header_color=colors.HexColor("#3498db"),
            subject_color_map=subject_color_map,
            merge_spans=merge_spans,
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

        grid = [[([], None) for _ in range(timetable.periods_per_day)]
                for _ in range(timetable.days)]

        for (day, period), break_obj in timetable.breaks.items():
            if 0 <= day < timetable.days and 0 <= period < timetable.periods_per_day:
                lines, _ = grid[day][period]
                lines.append(f"🔔 {break_obj.name}")

        merge_spans = {}

        for lesson in lessons_by_teacher[teacher_obj.id]:
            timeslot = timetable.get_assignment(lesson.id)
            if not timeslot:
                continue

            subj_name   = subjects[lesson.subject_id].name
            class_label = "/".join(
                classes[cid].name for cid in lesson.class_ids if cid in classes
            )
            room_label = "/".join(lesson.room_ids)
            sid        = lesson.subject_id

            # Annotate co-teachers
            if len(lesson.teacher_ids) > 1:
                others = [
                    teachers[tid].name.split()[-1]
                    for tid in lesson.teacher_ids
                    if tid != teacher_obj.id and tid in teachers
                ]
                if others:
                    co = "/".join(others[:2])
                    if len(others) > 2:
                        co += f"+{len(others)-2}"
                    subj_name += f" +{co}"

            if lesson.duration > 1:
                merge_spans[(timeslot.day, timeslot.start_period)] = lesson.duration

            for i, period in enumerate(timeslot.get_periods()):
                lines, _ = grid[timeslot.day][period]
                if i == 0:
                    if lesson.duration == 1:
                        lines.append(f"{subj_name}\n({class_label})\n{room_label}")
                    else:
                        lines.append(f"{subj_name}\n({class_label})\n{room_label}\n[{lesson.duration}p]")
                grid[timeslot.day][period] = (lines, sid)

        elements.append(_build_table(
            grid, timetable, day_names, styles,
            header_color=colors.HexColor("#27ae60"),
            subject_color_map=subject_color_map,
            merge_spans=merge_spans,
        ))

        if t_idx < len(teacher_list) - 1:
            elements.append(PageBreak())

    doc.build(elements)
    print(f"\n✅ PDF generated: {filename}")


# =========================================================
# TABLE BUILDER
# =========================================================

def _build_table(grid, timetable, day_names, styles, header_color,
                 subject_color_map, merge_spans):
    """
    Build a ReportLab Table from grid[day][period].

    grid[day][period] = (lines: List[str], subject_id: str | None)
    merge_spans       = {(day, start_period): duration}

    Table layout:
      rows    = periods (0-indexed internally, labelled 1-indexed)
      columns = [Period label] + [one per day]

    Multi-period blocks are vertically SPANned so they appear as one tall cell.
    Subject colors are applied consistently across all pages.
    """
    ppd  = timetable.periods_per_day
    days = timetable.days

    # Cells that are continuation rows of a span — leave them empty
    spanned = set()
    for (day, start_p), dur in merge_spans.items():
        col = day + 1  # +1 for the period-label column
        for offset in range(1, dur):
            spanned.add((start_p + offset, col))

    # ── Build table_data ──────────────────────────────────────────────────
    table_data = [["Period"] + day_names[:days]]

    for period in range(ppd):
        row = [f"{period + 1}"]
        for day in range(days):
            if (period, day + 1) in spanned:
                row.append("")  # covered by SPAN above
                continue
            lines, _ = grid[day][period]
            content = "\n".join(lines) if lines else "---"
            row.append(Paragraph(content, styles["Normal"]))
        table_data.append(row)

    col_widths = [0.6 * inch] + [1.5 * inch] * days
    table = Table(table_data, colWidths=col_widths)

    # ── Style commands ────────────────────────────────────────────────────
    style_cmds = [
        ("BACKGROUND",    (0, 0),  (-1,  0), header_color),
        ("TEXTCOLOR",     (0, 0),  (-1,  0), colors.whitesmoke),
        ("ALIGN",         (0, 0),  (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0),  (-1, -1), "MIDDLE"),
        ("FONTNAME",      (0, 0),  (-1,  0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0),  (-1,  0), 11),
        ("BOTTOMPADDING", (0, 0),  (-1,  0), 12),
        ("BACKGROUND",    (0, 1),  ( 0, -1), colors.HexColor("#ecf0f1")),
        ("FONTNAME",      (0, 1),  ( 0, -1), "Helvetica-Bold"),
        ("GRID",          (0, 0),  (-1, -1), 0.5, colors.grey),
        ("FONTSIZE",      (1, 1),  (-1, -1), 8),
        ("ROWHEIGHT",     (0, 1),  (-1, -1), 0.6 * inch),
    ]

    # ── Per-cell subject colors (single-period cells) ─────────────────────
    for period in range(ppd):
        for day in range(days):
            # Skip cells that are part of a merge span (handled separately below)
            if (period, day + 1) in spanned:
                continue
            _, sid = grid[day][period]
            if sid and sid in subject_color_map:
                style_cmds.append((
                    "BACKGROUND",
                    (day + 1, period + 1),
                    (day + 1, period + 1),
                    subject_color_map[sid],
                ))

    # ── Break cell highlights (override subject color) ────────────────────
    for (day, period) in timetable.breaks:
        if 0 <= day < days and 0 <= period < ppd:
            style_cmds.append((
                "BACKGROUND",
                (day + 1, period + 1), (day + 1, period + 1),
                colors.HexColor("#ffe4b5"),
            ))
            style_cmds.append((
                "FONTNAME",
                (day + 1, period + 1), (day + 1, period + 1),
                "Helvetica-Bold",
            ))

    # ── SPAN + color for multi-period blocks ──────────────────────────────
    for (day, start_p), dur in merge_spans.items():
        col       = day + 1
        row_start = start_p + 1        # +1 for header row
        row_end   = start_p + dur      # inclusive

        # Merge the cells vertically
        style_cmds.append(("SPAN",   (col, row_start), (col, row_end)))
        style_cmds.append(("VALIGN", (col, row_start), (col, row_end), "MIDDLE"))
        style_cmds.append(("ALIGN",  (col, row_start), (col, row_end), "CENTER"))

        # Subject color across the merged span
        _, sid = grid[day][start_p]
        if sid and sid in subject_color_map:
            style_cmds.append((
                "BACKGROUND",
                (col, row_start), (col, row_end),
                subject_color_map[sid],
            ))

        # Slightly bolder border to visually frame the block
        style_cmds.append((
            "BOX", (col, row_start), (col, row_end), 1.2, colors.HexColor("#888888")
        ))

    table.setStyle(TableStyle(style_cmds))
    return table