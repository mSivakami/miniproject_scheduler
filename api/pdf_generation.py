"""
pdf_generation.py
-----------------
Generates an elegant, print-ready timetable PDF.

Layout per section:
  - Cover page with institution header and generation metadata
  - Class-wise timetables   — one page per class   (blue accent)
  - Teacher-wise timetables — one page per teacher  (green accent)

Design principles:
  - Landscape A4, ALL data cells equal size (like a physical timetable sheet)
  - Break rows are minimal height — just a thin amber stripe
  - Subject abbreviations + teacher initials + room code for compact cells
  - Main content UPPERCASE, centred and middle-aligned in every cell
  - All IDs resolved to display names from the passed dicts — no DB calls
"""

from collections import defaultdict
from typing import List, Dict
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle,
    Paragraph, Spacer, PageBreak, HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfgen import canvas as pdfgen_canvas
from structures import Teacher, Subject, Class, LessonBlock, Timetable

# =========================================================
# DESIGN TOKENS
# =========================================================

C_NAVY      = colors.HexColor("#1e2d40")
C_BLUE      = colors.HexColor("#2563eb")
C_GREEN     = colors.HexColor("#16a34a")
C_AMBER_BG  = colors.HexColor("#fff8e6")
C_ROW_ALT   = colors.HexColor("#f8fafc")
C_BORDER    = colors.HexColor("#cbd5e1")
C_PERIOD_BG = colors.HexColor("#f1f5f9")
C_WHITE     = colors.white
C_TEXT      = colors.HexColor("#1e293b")
C_TEXT2     = colors.HexColor("#475569")
C_TEXT3     = colors.HexColor("#94a3b8")

# 20-colour pastel subject palette
_SUBJECT_COLORS = [
    "#DBEAFE", "#DCFCE7", "#FEF9C3", "#FFE4C4", "#EDE9FE",
    "#CCFBF1", "#FCE7F3", "#E0F2FE", "#E0E7FF", "#FEE2E2",
    "#D1FAE5", "#FEF3C7", "#DDD6FE", "#ECFDF5", "#FFF1F2",
    "#E0F2FE", "#FEFCE8", "#F3E8FF", "#ECFDF5", "#FFF7ED",
]

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
             "Saturday", "Sunday"]

# Height of a break row — kept tiny
BREAK_ROW_H = 6 * mm


# =========================================================
# TEXT ABBREVIATION HELPERS
# =========================================================

def _abbrev_subject(name: str, max_len: int = 10) -> str:
    """
    Shorten a subject name and return UPPERCASE.
      'Mathematics'        -> 'MATH'
      'Physical Education' -> 'PHY.ED'
      'English Language'   -> 'ENG.LANG'
    """
    words = name.strip().split()
    if not words:
        return name.upper()
    if len(words) == 1:
        return name[:max_len].upper()
    if len(name) <= max_len:
        return name.upper()
    parts = [w[:4] for w in words]
    abbr = ".".join(parts)
    if len(abbr) > max_len + 2:
        abbr = ".".join(w[:3] for w in words)
    return abbr.upper()


def _initials(name: str) -> str:
    """'John Smith' -> 'J.Smith'  |  'Anna Marie Jones' -> 'A.M.Jones'"""
    parts = name.strip().split()
    if not parts:
        return name
    if len(parts) == 1:
        return parts[0][:6]
    prefix = ".".join(p[0] for p in parts[:-1])
    last   = parts[-1][:8]
    return f"{prefix}.{last}"


def _room_short(rid: str) -> str:
    """Strip common room prefixes so IDs stay compact."""
    if not rid:
        return ""
    for prefix in ("ROOM-", "Room-", "room-", "RM-", "Rm-"):
        if rid.startswith(prefix):
            return rid[len(prefix):]
    return rid[:8]


# =========================================================
# COLOUR MAP  (subject_id -> pastel HexColor)
# =========================================================

def _subject_color_map(lesson_blocks: List[LessonBlock]) -> Dict[str, colors.HexColor]:
    seen = []
    for lb in lesson_blocks:
        if lb.subject_id not in seen:
            seen.append(lb.subject_id)
    return {
        sid: colors.HexColor(_SUBJECT_COLORS[i % len(_SUBJECT_COLORS)])
        for i, sid in enumerate(seen)
    }


# =========================================================
# STYLE FACTORY
# =========================================================

def _make_styles() -> dict:
    base = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=base["Normal"],
            fontName="Helvetica-Bold", fontSize=26,
            textColor=C_WHITE, alignment=TA_CENTER,
            spaceAfter=6, leading=32,
        ),
        "section_header": ParagraphStyle(
            "SectionHeader", parent=base["Normal"],
            fontName="Helvetica-Bold", fontSize=9,
            textColor=C_TEXT3, alignment=TA_LEFT,
            spaceAfter=1, spaceBefore=0, letterSpacing=1.2,
        ),
        "entity_name": ParagraphStyle(
            "EntityName", parent=base["Normal"],
            fontName="Helvetica-Bold", fontSize=16,
            textColor=C_TEXT, alignment=TA_LEFT,
            spaceAfter=4, spaceBefore=1,
        ),
        "cell": ParagraphStyle(
            "CellNormal", parent=base["Normal"],
            fontName="Helvetica", fontSize=8,
            textColor=C_TEXT, alignment=TA_CENTER, leading=11,
        ),
    }


# =========================================================
# MAIN PDF GENERATOR
# =========================================================

def generate_pdf_timetable(
    timetable:        Timetable,
    classes:          Dict[str, Class],
    teachers:         Dict[str, Teacher],
    subjects:         Dict[str, Subject],
    lesson_blocks:    List[LessonBlock],
    filename:         str = "timetable.pdf",
    institution_name: str = "School Timetable",
):
    """
    Generate an elegant, print-ready timetable PDF.
    Expects lesson.class_id (str), lesson.room_id (str),
    lesson.teacher_ids (List[str]) on each LessonBlock.
    All names are resolved from the passed dicts — no database dependency.
    """
    styles    = _make_styles()
    color_map = _subject_color_map(lesson_blocks)

    # ── Pre-index lessons ─────────────────────────────────────────────────
    lessons_by_class:   Dict[str, List[LessonBlock]] = defaultdict(list)
    lessons_by_teacher: Dict[str, List[LessonBlock]] = defaultdict(list)

    for lb in lesson_blocks:
        lessons_by_class[lb.class_id].append(lb)
        for tid in lb.teacher_ids:
            lessons_by_teacher[tid].append(lb)

    elements: List = []

    # ── Cover ─────────────────────────────────────────────────────────────
    elements.extend(_cover_page(institution_name, classes, teachers, lesson_blocks, styles))

    # ── Class-wise ────────────────────────────────────────────────────────
    for cls in classes.values():
        def _primary(lb, _s=subjects):
            s = _s.get(lb.subject_id)
            return _abbrev_subject(s.name) if s else _abbrev_subject(lb.subject_id)

        def _secondary(lb, _t=teachers):
            parts = [
                _initials(_t[tid].name) if tid in _t else _initials(tid)
                for tid in lb.teacher_ids
            ]
            return " / ".join(parts[:2])

        def _tertiary(lb):
            return _room_short(lb.room_id)

        elements.extend(_entity_page(
            entity_label="CLASS",
            entity_name=cls.name,
            lessons=lessons_by_class[cls.id],
            timetable=timetable,
            color_map=color_map,
            styles=styles,
            accent=C_BLUE,
            cell_primary=_primary,
            cell_secondary=_secondary,
            cell_tertiary=_tertiary,
        ))
        elements.append(PageBreak())

    # ── Teacher-wise ──────────────────────────────────────────────────────
    teacher_list = list(teachers.values())
    for t_idx, teacher in enumerate(teacher_list):

        def _primary_t(lb, _s=subjects):
            s = _s.get(lb.subject_id)
            return _abbrev_subject(s.name) if s else _abbrev_subject(lb.subject_id)

        def _secondary_t(lb, _c=classes):
            c = _c.get(lb.class_id)
            return c.name if c else lb.class_id

        def _tertiary_t(lb):
            return _room_short(lb.room_id)

        elements.extend(_entity_page(
            entity_label="TEACHER",
            entity_name=teacher.name,
            lessons=lessons_by_teacher[teacher.id],
            timetable=timetable,
            color_map=color_map,
            styles=styles,
            accent=C_GREEN,
            cell_primary=_primary_t,
            cell_secondary=_secondary_t,
            cell_tertiary=_tertiary_t,
        ))
        if t_idx < len(teacher_list) - 1:
            elements.append(PageBreak())

    # ── Build PDF ─────────────────────────────────────────────────────────
    doc = SimpleDocTemplate(
        filename,
        pagesize=landscape(A4),
        topMargin=14 * mm,
        bottomMargin=16 * mm,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
    )
    doc.build(elements)
    print(f"\n✅ PDF generated: {filename}")


# =========================================================
# COVER PAGE
# =========================================================

def _cover_page(name, classes, teachers, lesson_blocks, styles) -> list:
    W, H = landscape(A4)
    els = []

    banner = Table(
        [[Paragraph(name, styles["cover_title"])]],
        colWidths=[W - 24 * mm],
    )
    banner.setStyle(TableStyle([
        ("BACKGROUND",     (0, 0), (-1, -1), C_NAVY),
        ("ALIGN",          (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",         (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",     (0, 0), (-1, -1), 22),
        ("BOTTOMPADDING",  (0, 0), (-1, -1), 22),
        ("LEFTPADDING",    (0, 0), (-1, -1), 16),
        ("RIGHTPADDING",   (0, 0), (-1, -1), 16),
        ("ROUNDEDCORNERS", [6]),
    ]))
    els.append(Spacer(1, 18 * mm))
    els.append(banner)
    els.append(Spacer(1, 8 * mm))

    total_periods = sum(lb.duration for lb in lesson_blocks)
    stats = [
        ["Classes",       str(len(classes))],
        ["Teachers",      str(len(teachers))],
        ["Lesson Blocks", str(len(lesson_blocks))],
        ["Total Periods", str(total_periods)],
    ]
    stat_table = Table(
        [["  " + k + "  " for k, _ in stats],
         ["  " + v + "  " for _, v in stats]],
        colWidths=[(W - 24 * mm) / len(stats)] * len(stats),
    )
    stat_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  C_NAVY),
        ("BACKGROUND",    (0, 1), (-1, 1),  colors.HexColor("#f8fafc")),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  C_TEXT3),
        ("TEXTCOLOR",     (0, 1), (-1, 1),  C_TEXT),
        ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica"),
        ("FONTNAME",      (0, 1), (-1, 1),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0),  8),
        ("FONTSIZE",      (0, 1), (-1, 1),  20),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, 0),  8),
        ("BOTTOMPADDING", (0, 0), (-1, 0),  6),
        ("TOPPADDING",    (0, 1), (-1, 1),  10),
        ("BOTTOMPADDING", (0, 1), (-1, 1),  12),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORDER),
        ("LINEBEFORE",    (1, 0), (1, -1),  0.5, C_BORDER),
        ("LINEBEFORE",    (2, 0), (2, -1),  0.5, C_BORDER),
        ("LINEBEFORE",    (3, 0), (3, -1),  0.5, C_BORDER),
    ]))
    els.append(stat_table)
    els.append(Spacer(1, 8 * mm))

    idx_style = ParagraphStyle(
        "IdxStyle", fontName="Helvetica", fontSize=9,
        textColor=C_TEXT2, alignment=TA_CENTER, leading=14,
    )
    els.append(Paragraph(
        "Contents: &nbsp;&nbsp;Class-wise Timetables &nbsp;|&nbsp; Teacher-wise Timetables",
        idx_style,
    ))
    els.append(PageBreak())
    return els


# =========================================================
# ENTITY PAGE  (class / teacher)
# =========================================================

def _entity_page(
    entity_label:  str,
    entity_name:   str,
    lessons:       list,
    timetable:     Timetable,
    color_map:     dict,
    styles:        dict,
    accent:        colors.Color,
    cell_primary,
    cell_secondary,
    cell_tertiary,
) -> list:
    els = []
    els.append(Paragraph(entity_label, styles["section_header"]))
    els.append(Paragraph(entity_name,  styles["entity_name"]))
    els.append(HRFlowable(
        width="100%", thickness=2, color=accent,
        spaceAfter=5, spaceBefore=0,
    ))

    ppd  = timetable.periods_per_day
    days = timetable.days

    # grid[day][period] = (lines: List[str], subject_id: str | None)
    # Breaks are NOT stored in grid — _build_table reads timetable.breaks
    # directly so per-(day, period) granularity is preserved.
    grid = [[([], None) for _ in range(ppd)] for _ in range(days)]
    merge_spans: Dict = {}

    for lb in lessons:
        ts = timetable.get_assignment(lb.id)
        if not ts:
            continue

        primary   = cell_primary(lb)
        secondary = cell_secondary(lb)
        tertiary  = cell_tertiary(lb)

        if lb.duration > 1:
            merge_spans[(ts.day, ts.start_period)] = lb.duration

        for i, period in enumerate(ts.get_periods()):
            lines, _ = grid[ts.day][period]
            if i == 0:
                cell_lines = [primary]
                if secondary: cell_lines.append(secondary)
                if tertiary:  cell_lines.append(tertiary)
                lines.extend(cell_lines)
            grid[ts.day][period] = (lines, lb.subject_id)

    els.append(_build_table(
        grid, timetable, days, ppd, merge_spans, color_map, styles, accent,
    ))
    return els


# =========================================================
# TABLE BUILDER — uniform large cells, minimal break rows
# =========================================================

def _build_table(
    grid, timetable, days, ppd,
    merge_spans, color_map, styles, accent,
) -> Table:
    W, H = landscape(A4)
    left_margin  = 12 * mm
    right_margin = 12 * mm
    top_used     = 30 * mm   # entity header above table
    bot_used     = 18 * mm   # footer
    usable_W     = W - left_margin - right_margin
    usable_H     = H - top_used - bot_used

    # ── Column widths ─────────────────────────────────────────────────────
    period_col_w = 14 * mm
    day_col_w    = (usable_W - period_col_w) / days

    # ── Break detection ───────────────────────────────────────────────────
    # break_slots       : set of (day, period) that are break slots
    # break_period_rows : period indices rendered as thin rows
    #
    # A period becomes a break row when at least one day has a break there.
    # This correctly handles shifts like period 3 Mon–Thu / period 4 Fri —
    # both period 3 and 4 become thin rows; individual cells still show the
    # correct break label or remain empty for days with no break at that slot.
    break_slots: set = set()
    for (day, period) in timetable.breaks.keys():
        if 0 <= day < days and 0 <= period < ppd:
            break_slots.add((day, period))

    break_count: Dict[int, int] = defaultdict(int)
    for (day, period) in break_slots:
        break_count[period] += 1

    break_period_rows: set = {p for p, c in break_count.items() if c >= 1}

    # ── Continuation cells (must be "" for SPAN) ──────────────────────────
    spanned: set = set()
    for (day, start_p), dur in merge_spans.items():
        for offset in range(1, dur):
            spanned.add((start_p + offset, day + 1))  # (table_row, table_col)

    # ── Row heights ───────────────────────────────────────────────────────
    header_h     = 10 * mm
    break_total  = len(break_period_rows) * BREAK_ROW_H
    normal_count = ppd - len(break_period_rows)
    normal_h     = max(14 * mm,
                       (usable_H - header_h - break_total) / max(normal_count, 1))

    row_heights = [header_h]
    for period in range(ppd):
        row_heights.append(BREAK_ROW_H if period in break_period_rows else normal_h)

    # ── Local paragraph styles ────────────────────────────────────────────
    day_hdr_style = ParagraphStyle(
        "DayHdr", fontName="Helvetica-Bold", fontSize=9,
        textColor=C_WHITE, alignment=TA_CENTER,
    )
    p_label_style = ParagraphStyle(
        "PLabel", fontName="Helvetica-Bold", fontSize=8,
        textColor=C_TEXT2, alignment=TA_CENTER,
    )
    break_cell_style = ParagraphStyle(
        "BrkCell", fontName="Helvetica-Bold", fontSize=6.5,
        textColor=colors.HexColor("#92400e"), alignment=TA_CENTER,
    )
    cell_center = ParagraphStyle(
        "CellCenter", fontName="Helvetica", fontSize=9,
        textColor=C_TEXT, alignment=TA_CENTER, leading=12,
    )

    # ── Header row ────────────────────────────────────────────────────────
    header_row = [Paragraph("", p_label_style)]
    for d in range(days):
        header_row.append(Paragraph(DAY_NAMES[d].upper(), day_hdr_style))
    table_data = [header_row]

    # ── Data rows ─────────────────────────────────────────────────────────
    for period in range(ppd):
        is_break_row = period in break_period_rows

        p_label = (
            Paragraph("BRK", break_cell_style)
            if is_break_row
            else Paragraph(f"<b>P{period + 1}</b>", p_label_style)
        )
        row = [p_label]

        for day in range(days):
            col = day + 1   # table column index (0 = period label)

            # Empty string required so ReportLab SPAN can merge this cell
            if (period, col) in spanned:
                row.append("")
                continue

            # Break at this exact (day, period)
            if (day, period) in break_slots:
                lbl      = timetable.breaks.get((day, period))
                brk_name = lbl.name.upper() if hasattr(lbl, "name") else "BREAK"
                row.append(Paragraph(brk_name, break_cell_style))
                continue

            # Break row but no break on this specific day — leave empty
            if is_break_row:
                row.append("")
                continue

            lines, sid = grid[day][period]
            if not lines:
                row.append("")
                continue

            # ── Cell content ──────────────────────────────────────────────
            # Line 0: subject abbreviation — BOLD 9pt UPPERCASE
            # Line 1: teacher initials     — regular 7.5pt dark slate
            # Line 2: room code            — regular 7pt accent purple
            parts = []
            for i, line in enumerate(lines):
                if i == 0:
                    parts.append(
                        f'<font name="Helvetica-Bold" size="9">{line.upper()}</font>'
                    )
                elif i == 1:
                    parts.append(
                        f'<font name="Helvetica" size="7.5" color="#334155">{line}</font>'
                    )
                else:
                    parts.append(
                        f'<font name="Helvetica" size="7" color="#5b21b6">{line}</font>'
                    )
            row.append(Paragraph("<br/>".join(parts), cell_center))

        table_data.append(row)

    # ── Build Table ───────────────────────────────────────────────────────
    col_widths = [period_col_w] + [day_col_w] * days
    table = Table(table_data, colWidths=col_widths, rowHeights=row_heights)

    # ── Style commands ────────────────────────────────────────────────────
    cmds = [
        # Header row
        ("BACKGROUND",    (0, 0),  (-1, 0),  accent),
        ("TEXTCOLOR",     (0, 0),  (-1, 0),  C_WHITE),
        ("FONTNAME",      (0, 0),  (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0),  (-1, 0),  9),
        ("TOPPADDING",    (0, 0),  (-1, 0),  6),
        ("BOTTOMPADDING", (0, 0),  (-1, 0),  6),
        # Period label column
        ("BACKGROUND",    (0, 1),  (0, -1),  C_PERIOD_BG),
        # All cells: centred both axes, grid lines
        ("ALIGN",         (0, 0),  (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0),  (-1, -1), "MIDDLE"),
        ("GRID",          (0, 0),  (-1, -1), 0.4, C_BORDER),
        # Padding for data cells
        ("TOPPADDING",    (1, 1),  (-1, -1), 4),
        ("BOTTOMPADDING", (1, 1),  (-1, -1), 4),
        ("LEFTPADDING",   (1, 1),  (-1, -1), 3),
        ("RIGHTPADDING",  (1, 1),  (-1, -1), 3),
    ]

    # Alternating row tint — normal rows only
    alt_count = 0
    for period in range(ppd):
        row_idx = period + 1
        if period not in break_period_rows:
            alt_count += 1
            if alt_count % 2 == 0:
                cmds.append(("BACKGROUND", (1, row_idx), (-1, row_idx), C_ROW_ALT))

    # Per-cell subject colours + break row amber stripe
    for period in range(ppd):
        row_idx = period + 1

        if period in break_period_rows:
            # Entire break row: amber tint + zero vertical padding
            cmds.append(("BACKGROUND",    (0, row_idx), (-1, row_idx), C_AMBER_BG))
            cmds.append(("TOPPADDING",    (0, row_idx), (-1, row_idx), 0))
            cmds.append(("BOTTOMPADDING", (0, row_idx), (-1, row_idx), 0))
            continue

        for day in range(days):
            col = day + 1
            if (period, col) in spanned:
                continue
            if (day, period) in break_slots:
                cmds.append(("BACKGROUND", (col, row_idx), (col, row_idx), C_AMBER_BG))
                continue
            _, sid = grid[day][period]
            if sid and sid in color_map:
                cmds.append(("BACKGROUND", (col, row_idx), (col, row_idx), color_map[sid]))

    # Multi-period SPAN blocks
    for (day, start_p), dur in merge_spans.items():
        col       = day + 1
        row_start = start_p + 1
        row_end   = start_p + dur

        cmds.append(("SPAN",       (col, row_start), (col, row_end)))
        cmds.append(("VALIGN",     (col, row_start), (col, row_end), "MIDDLE"))
        cmds.append(("ALIGN",      (col, row_start), (col, row_end), "CENTER"))
        cmds.append(("LINEBEFORE", (col, row_start), (col, row_end), 2.5, accent))
        cmds.append(("BOX",        (col, row_start), (col, row_end), 0.8,
                      colors.HexColor("#94a3b8")))

        _, sid = grid[day][start_p]
        if sid and sid in color_map:
            cmds.append(("BACKGROUND", (col, row_start), (col, row_end), color_map[sid]))

    table.setStyle(TableStyle(cmds))
    return table