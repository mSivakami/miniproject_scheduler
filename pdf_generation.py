from collections import defaultdict
from typing import List, Dict
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from structures import Teacher, Subject, Class, LessonBlock, Timetable

# ============================================================================
# PDF GENERATION
# ============================================================================

def generate_pdf_timetable(timetable: Timetable, classes: Dict[str, Class],
                          teachers: Dict[str, Teacher], subjects: Dict[str, Subject],
                          lesson_blocks: List[LessonBlock], filename: str = "timetable.pdf"):
    
    doc = SimpleDocTemplate(
        filename,
        pagesize=landscape(A4),
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch
    )

    elements = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=20,
        alignment=TA_CENTER
    )

    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#2c3e50'),
        spaceAfter=10,
        spaceBefore=10,
        alignment=TA_LEFT
    )

    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

    # ==========================================================
    # MAIN TITLE
    # ==========================================================
    elements.append(Paragraph("SCHOOL TIMETABLE REPORT", title_style))
    elements.append(Spacer(1, 0.2 * inch))

    # ==========================================================
    # 1) CLASS-WISE TIMETABLES
    # ==========================================================
    elements.append(Paragraph("📘 CLASS-WISE TIMETABLES", section_title_style))
    elements.append(Spacer(1, 0.2 * inch))

    class_list = list(classes.values())
    # ✅ Pre-index lessons by class and teacher (O(n) once vs O(n²) later)
    lessons_by_class = defaultdict(list)
    lessons_by_teacher = defaultdict(list)

    for lesson in lesson_blocks:
        lessons_by_class[lesson.class_id].append(lesson)
        lessons_by_teacher[lesson.teacher_id].append(lesson)

    for class_idx, class_obj in enumerate(class_list):
        elements.append(Paragraph(f"Class: {class_obj.name}", section_title_style))

        table_data = []
        header = ['Period'] + days[:timetable.days]
        table_data.append(header)

        grid = [[[] for _ in range(timetable.periods_per_day)] for _ in range(timetable.days)]

        # Add breaks
        for (day, period), break_obj in timetable.breaks.items():
            grid[day][period].append(f"🔔 {break_obj.name}")

        # Add lessons for this class
        for lesson in lesson_blocks:
            if lesson.class_id == class_obj.id:
                timeslot = timetable.get_assignment(lesson.id)
                if timeslot:
                    subj_name = subjects[lesson.subject_id].name
                    teacher_name = teachers[lesson.teacher_id].name.split()[-1]
                    room = lesson.room_id

                    for i, period in enumerate(timeslot.get_periods()):
                        if i == 0:
                            if lesson.duration == 1:
                                marker = f"{subj_name}\n({teacher_name})\n{room}"
                            else:
                                marker = f"┌ {subj_name}\n({teacher_name})"
                        elif i == len(timeslot.get_periods()) - 1:
                            marker = f"└ [{lesson.duration}p]\n{room}"
                        else:
                            marker = "│"
                        grid[timeslot.day][period].append(marker)

        # Build table rows
        for period in range(timetable.periods_per_day):
            row = [f"{period + 1}"]
            for day in range(timetable.days):
                cell_content = '\n'.join(grid[day][period]) if grid[day][period] else '---'
                row.append(Paragraph(cell_content, styles['Normal']))
            table_data.append(row)

        col_widths = [0.6 * inch] + [1.5 * inch] * timetable.days
        table = Table(table_data, colWidths=col_widths)

        table_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (0, -1), colors.HexColor('#ecf0f1')),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTSIZE', (1, 1), (-1, -1), 8),
            ('ROWHEIGHT', (0, 1), (-1, -1), 0.6 * inch),
            ('ROWBACKGROUNDS', (1, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ])

        # Highlight breaks
        for (day, period), break_obj in timetable.breaks.items():
            row_idx = period + 1
            col_idx = day + 1
            table_style.add('BACKGROUND', (col_idx, row_idx), (col_idx, row_idx), colors.HexColor('#ffe4b5'))
            table_style.add('FONTNAME', (col_idx, row_idx), (col_idx, row_idx), 'Helvetica-Bold')

        table.setStyle(table_style)
        elements.append(table)

        # Page break after each class timetable
        elements.append(PageBreak())

    # ==========================================================
    # 2) TEACHER-WISE TIMETABLES
    # ==========================================================
    elements.append(Paragraph("👨‍🏫 TEACHER-WISE TIMETABLES", section_title_style))
    elements.append(Spacer(1, 0.2 * inch))

    teacher_list = list(teachers.values())

    for teacher_idx, teacher_obj in enumerate(teacher_list):
        elements.append(Paragraph(f"Teacher: {teacher_obj.name}", section_title_style))

        table_data = []
        header = ['Period'] + days[:timetable.days]
        table_data.append(header)

        grid = [[[] for _ in range(timetable.periods_per_day)] for _ in range(timetable.days)]

        # Add breaks
        for (day, period), break_obj in timetable.breaks.items():
            grid[day][period].append(f"🔔 {break_obj.name}")

        # Add lessons for this teacher
        # Add lessons for this teacher
        for lesson in lessons_by_teacher[teacher_obj.id]:  # ✅ Already filtered
            timeslot = timetable.get_assignment(lesson.id)
            if timeslot:
                subj_name = subjects[lesson.subject_id].name
                class_name = classes[lesson.class_id].name
                room = lesson.room_id

                for i, period in enumerate(timeslot.get_periods()):
                    if i == 0:
                        if lesson.duration == 1:
                            marker = f"{subj_name}\n({class_name})\n{room}"
                        else:
                            marker = f"┌ {subj_name}\n({class_name})"
                    elif i == len(timeslot.get_periods()) - 1:
                        marker = f"└ [{lesson.duration}p]\n{room}"
                    else:
                        marker = "│"
                    grid[timeslot.day][period].append(marker)

        # Build table rows
        for period in range(timetable.periods_per_day):
            row = [f"{period + 1}"]
            for day in range(timetable.days):
                cell_content = '\n'.join(grid[day][period]) if grid[day][period] else '---'
                row.append(Paragraph(cell_content, styles['Normal']))
            table_data.append(row)

        col_widths = [0.6 * inch] + [1.5 * inch] * timetable.days
        table = Table(table_data, colWidths=col_widths)

        table_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#27ae60')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (0, -1), colors.HexColor('#ecf0f1')),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTSIZE', (1, 1), (-1, -1), 8),
            ('ROWHEIGHT', (0, 1), (-1, -1), 0.6 * inch),
            ('ROWBACKGROUNDS', (1, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ])

        # Highlight breaks
        for (day, period), break_obj in timetable.breaks.items():
            row_idx = period + 1
            col_idx = day + 1
            table_style.add('BACKGROUND', (col_idx, row_idx), (col_idx, row_idx), colors.HexColor('#ffe4b5'))
            table_style.add('FONTNAME', (col_idx, row_idx), (col_idx, row_idx), 'Helvetica-Bold')

        table.setStyle(table_style)
        elements.append(table)

        # Page break after each teacher timetable
        if teacher_idx < len(teacher_list) - 1:
            elements.append(PageBreak())

    doc.build(elements)
    print(f"\n✅ PDF generated: {filename}")

