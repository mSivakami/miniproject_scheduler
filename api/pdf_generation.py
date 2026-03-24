"""
pdf_generation.py
-----------------
Generates an elegant, print-ready timetable PDF.

Layout per section:
  - Cover page with institution header and generation metadata
  - Class-wise timetables  — one page per class  (blue accent)
  - Teacher-wise timetables — one page per teacher (green accent)
  - Room-wise timetables   — one page per room   (purple accent)

Design principles:
  - Clean white background, subtle borders, no visual clutter
  - Consistent pastel subject colours across all views
  - Clear typography hierarchy: section header → entity name → table
  - Multi-period blocks vertically merged with accent left-border
  - Break slots highlighted in warm amber
  - Page numbers and section labels in footer
"""

from collections import defaultdict
from typing import List, Dict, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle,
    Paragraph, Spacer, PageBreak, HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm, cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas as pdfgen_canvas
from structures import Teacher, Subject, Class, LessonBlock, Timetable

# =========================================================
# DESIGN TOKENS
# =========================================================

# Brand colours
C_NAVY      = colors.HexColor("#1e2d40")   # dark navy — headers
C_BLUE      = colors.HexColor("#2563eb")   # class section accent
C_GREEN     = colors.HexColor("#16a34a")   # teacher section accent
C_PURPLE    = colors.HexColor("#7c3aed")   # room section accent
C_AMBER     = colors.HexColor("#f59e0b")   # break colour
C_AMBER_BG  = colors.HexColor("#fffbeb")   # break background
C_ROW_ALT   = colors.HexColor("#f8fafc")   # alternating row
C_BORDER    = colors.HexColor("#e2e8f0")   # grid lines
C_PERIOD_BG = colors.HexColor("#f1f5f9")   # period label column
C_WHITE     = colors.white
C_TEXT      = colors.HexColor("#1e293b")
C_TEXT2     = colors.HexColor("#475569")
C_TEXT3     = colors.HexColor("#94a3b8")

# Subject pastel palette (20 colours)
_SUBJECT_COLORS = [
    "#DBEAFE", "#DCFCE7", "#FEF9C3", "#FFE4C4", "#EDE9FE",
    "#CCFBF1", "#FCE7F3", "#E0F2FE", "#E0E7FF", "#FEE2E2",
    "#D1FAE5", "#FEF3C7", "#DDD6FE", "#ECFDF5", "#FFF1F2",
    "#E0F2FE", "#FEFCE8", "#F3E8FF", "#ECFDF5", "#FFF7ED",
]

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


# =========================================================
# HELPERS
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


def _darken(hex_color: str, factor: float = 0.65) -> colors.HexColor:
    """Return a slightly darker version of a hex colour for borders."""
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return colors.HexColor("#{:02x}{:02x}{:02x}".format(
        int(r * factor), int(g * factor), int(b * factor)
    ))


# =========================================================
# PAGE TEMPLATE — header/footer drawn on canvas
# =========================================================

class _PageTemplate:
    """Callable used as onFirstPage / onLaterPages in doc.build()."""

    def __init__(self, section_title: str, accent: colors.Color):
        self.section_title = section_title
        self.accent        = accent

    def __call__(self, canv: pdfgen_canvas.Canvas, doc):
        W, H = landscape(A4)
        canv.saveState()

        # Top accent bar
        canv.setFillColor(self.accent)
        canv.rect(0, H - 6 * mm, W, 6 * mm, stroke=0, fill=1)

        # Footer rule
        canv.setStrokeColor(C_BORDER)
        canv.setLineWidth(0.5)
        canv.line(20 * mm, 12 * mm, W - 20 * mm, 12 * mm)

        # Footer left — section label
        canv.setFont("Helvetica", 7)
        canv.setFillColor(C_TEXT3)
        canv.drawString(20 * mm, 8 * mm, self.section_title.upper())

        # Footer centre — institution placeholder
        canv.drawCentredString(W / 2, 8 * mm, "TIMETABLE REPORT")

        # Footer right — page number
        canv.drawRightString(W - 20 * mm, 8 * mm, f"Page {doc.page}")

        canv.restoreState()


# =========================================================
# STYLE FACTORY
# =========================================================

def _make_styles():
    base = getSampleStyleSheet()

    cover_title = ParagraphStyle(
        "CoverTitle",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=28,
        textColor=C_WHITE,
        alignment=TA_CENTER,
        spaceAfter=8,
        leading=34,
    )
    cover_sub = ParagraphStyle(
        "CoverSub",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=13,
        textColor=colors.HexColor("#cbd5e1"),
        alignment=TA_CENTER,
        spaceAfter=4,
    )
    section_header = ParagraphStyle(
        "SectionHeader",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=C_TEXT3,
        alignment=TA_LEFT,
        spaceAfter=2,
        spaceBefore=0,
        letterSpacing=1.2,
    )
    entity_name = ParagraphStyle(
        "EntityName",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=17,
        textColor=C_TEXT,
        alignment=TA_LEFT,
        spaceAfter=6,
        spaceBefore=2,
    )
    cell_style = ParagraphStyle(
        "CellNormal",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        textColor=C_TEXT,
        alignment=TA_CENTER,
        leading=11,
    )
    cell_bold = ParagraphStyle(
        "CellBold",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        textColor=C_TEXT,
        alignment=TA_CENTER,
        leading=11,
    )
    return {
        "cover_title":   cover_title,
        "cover_sub":     cover_sub,
        "section_header": section_header,
        "entity_name":   entity_name,
        "cell":          cell_style,
        "cell_bold":     cell_bold,
    }


# =========================================================
# MAIN PDF GENERATOR
# =========================================================

def generate_pdf_timetable(
    timetable: Timetable,
    classes:   Dict[str, "Class"],
    teachers:  Dict[str, "Teacher"],
    subjects:  Dict[str, "Subject"],
    lesson_blocks: List["LessonBlock"],
    filename:  str = "timetable.pdf",
    institution_name: str = "School Timetable",
):
    """
    Generate an elegant, print-ready timetable PDF with three sections:
      1. Class-wise timetables
      2. Teacher-wise timetables
      3. Room-wise timetables (derived from lesson_blocks)
    """
    styles      = _make_styles()
    color_map   = _subject_color_map(lesson_blocks)
    ppd         = timetable.periods_per_day
    days        = timetable.days

    # Pre-index
    lessons_by_class:   Dict[str, List] = defaultdict(list)
    lessons_by_teacher: Dict[str, List] = defaultdict(list)
    lessons_by_room:    Dict[str, List] = defaultdict(list)
    all_room_ids: List[str] = []

    for lb in lesson_blocks:
        for cid in lb.class_ids:
            lessons_by_class[cid].append(lb)
        for tid in lb.teacher_ids:
            lessons_by_teacher[tid].append(lb)
        for rid in lb.room_ids:
            lessons_by_room[rid].append(lb)
            if rid not in all_room_ids:
                all_room_ids.append(rid)

    elements: List = []

    # ── Cover page ────────────────────────────────────────────────────────
    elements.extend(_cover_page(institution_name, classes, teachers, lesson_blocks, styles))

    # ── Class-wise ────────────────────────────────────────────────────────
    for cls in classes.values():
        elements.extend(
            _entity_page(
                entity_label="CLASS",
                entity_name=cls.name,
                lessons=lessons_by_class[cls.id],
                timetable=timetable,
                subjects=subjects,
                teachers=teachers,
                classes=classes,
                color_map=color_map,
                styles=styles,
                accent=C_BLUE,
                cell_primary=lambda lb: subjects[lb.subject_id].name if lb.subject_id in subjects else lb.subject_id,
                cell_secondary=lambda lb: " / ".join(
                    teachers[tid].name.split()[-1]
                    for tid in lb.teacher_ids if tid in teachers
                ),
                cell_tertiary=lambda lb: " / ".join(lb.room_ids),
            )
        )
        elements.append(PageBreak())

    # ── Teacher-wise ──────────────────────────────────────────────────────
    teacher_list = list(teachers.values())
    for t_idx, teacher in enumerate(teacher_list):
        elements.extend(
            _entity_page(
                entity_label="TEACHER",
                entity_name=teacher.name,
                lessons=lessons_by_teacher[teacher.id],
                timetable=timetable,
                subjects=subjects,
                teachers=teachers,
                classes=classes,
                color_map=color_map,
                styles=styles,
                accent=C_GREEN,
                cell_primary=lambda lb: subjects[lb.subject_id].name if lb.subject_id in subjects else lb.subject_id,
                cell_secondary=lambda lb: " / ".join(
                    classes[cid].name for cid in lb.class_ids if cid in classes
                ),
                cell_tertiary=lambda lb: " / ".join(lb.room_ids),
                co_teacher_id=teacher.id,
                all_teachers=teachers,
            )
        )
        if t_idx < len(teacher_list) - 1:
            elements.append(PageBreak())

    # ── Room-wise ─────────────────────────────────────────────────────────
    if all_room_ids:
        elements.append(PageBreak())
        for r_idx, rid in enumerate(all_room_ids):
            elements.extend(
                _entity_page(
                    entity_label="ROOM",
                    entity_name=rid,
                    lessons=lessons_by_room[rid],
                    timetable=timetable,
                    subjects=subjects,
                    teachers=teachers,
                    classes=classes,
                    color_map=color_map,
                    styles=styles,
                    accent=C_PURPLE,
                    cell_primary=lambda lb: subjects[lb.subject_id].name if lb.subject_id in subjects else lb.subject_id,
                    cell_secondary=lambda lb: " / ".join(
                        classes[cid].name for cid in lb.class_ids if cid in classes
                    ),
                    cell_tertiary=lambda lb: " / ".join(
                        teachers[tid].name.split()[-1]
                        for tid in lb.teacher_ids if tid in teachers
                    ),
                )
            )
            if r_idx < len(all_room_ids) - 1:
                elements.append(PageBreak())

    # ── Build with default page template ─────────────────────────────────
    doc = SimpleDocTemplate(
        filename,
        pagesize=landscape(A4),
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
    )
    doc.build(elements)
    print(f"\n✅ PDF generated: {filename}")


# =========================================================
# COVER PAGE
# =========================================================

def _cover_page(name, classes, teachers, lesson_blocks, styles) -> list:
    W, H = landscape(A4)
    els = []

    # Dark banner block using a Table as background
    banner_data = [[Paragraph(name, styles["cover_title"])]]
    banner = Table(banner_data, colWidths=[W - 30 * mm])
    banner.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_NAVY),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 24),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 24),
        ("LEFTPADDING",   (0, 0), (-1, -1), 20),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 20),
        ("ROUNDEDCORNERS", [6]),
    ]))
    els.append(Spacer(1, 20 * mm))
    els.append(banner)
    els.append(Spacer(1, 10 * mm))

    # Summary stats row
    total_periods = sum(lb.duration for lb in lesson_blocks)
    stats = [
        ["Classes", str(len(classes))],
        ["Teachers", str(len(teachers))],
        ["Lesson Blocks", str(len(lesson_blocks))],
        ["Total Periods", str(total_periods)],
    ]
    stat_table = Table(
        [["  " + k + "  " for k, _ in stats],
         ["  " + v + "  " for _, v in stats]],
        colWidths=[(W - 30 * mm) / len(stats)] * len(stats),
    )
    stat_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  C_NAVY),
        ("BACKGROUND",    (0, 1), (-1, 1),  colors.HexColor("#f8fafc")),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  C_TEXT3),
        ("TEXTCOLOR",     (0, 1), (-1, 1),  C_TEXT),
        ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica"),
        ("FONTNAME",      (0, 1), (-1, 1),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0),  8),
        ("FONTSIZE",      (0, 1), (-1, 1),  22),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, 0),  10),
        ("BOTTOMPADDING", (0, 0), (-1, 0),  8),
        ("TOPPADDING",    (0, 1), (-1, 1),  10),
        ("BOTTOMPADDING", (0, 1), (-1, 1),  12),
        ("LINEABOVE",     (0, 0), (-1, 0),  0.5, C_BORDER),
        ("LINEBELOW",     (0, -1), (-1, -1), 0.5, C_BORDER),
        ("LINEBEFORE",    (1, 0), (1, -1),  0.5, C_BORDER),
        ("LINEBEFORE",    (2, 0), (2, -1),  0.5, C_BORDER),
        ("LINEBEFORE",    (3, 0), (3, -1),  0.5, C_BORDER),
        ("BOX",           (0, 0), (-1, -1), 0.5, C_BORDER),
    ]))
    els.append(stat_table)
    els.append(Spacer(1, 8 * mm))

    # Section index
    idx_style = ParagraphStyle(
        "IdxStyle", fontName="Helvetica", fontSize=9,
        textColor=C_TEXT2, alignment=TA_CENTER, leading=14,
    )
    els.append(Paragraph(
        "Contents: &nbsp;&nbsp;Class-wise Timetables &nbsp;|&nbsp; "
        "Teacher-wise Timetables &nbsp;|&nbsp; Room-wise Timetables",
        idx_style,
    ))
    els.append(PageBreak())
    return els


# =========================================================
# ENTITY PAGE  (class / teacher / room)
# =========================================================

def _entity_page(
    entity_label: str,
    entity_name:  str,
    lessons:      list,
    timetable:    Timetable,
    subjects:     dict,
    teachers:     dict,
    classes:      dict,
    color_map:    dict,
    styles:       dict,
    accent:       colors.Color,
    cell_primary,
    cell_secondary,
    cell_tertiary,
    co_teacher_id: Optional[str] = None,
    all_teachers:  Optional[dict] = None,
) -> list:
    """Build elements for one timetable page."""
    els = []

    # ── Section label + entity name ───────────────────────────────────────
    els.append(Paragraph(entity_label, styles["section_header"]))
    els.append(Paragraph(entity_name,  styles["entity_name"]))
    els.append(HRFlowable(
        width="100%", thickness=2, color=accent,
        spaceAfter=6, spaceBefore=0,
    ))

    # ── Build grid ────────────────────────────────────────────────────────
    ppd  = timetable.periods_per_day
    days = timetable.days

    # grid[day][period] = (lines: List[str], subject_id: str | None)
    grid = [[([], None) for _ in range(ppd)] for _ in range(days)]

    # Mark breaks
    for (day, period), brk in timetable.breaks.items():
        if 0 <= day < days and 0 <= period < ppd:
            lines, _ = grid[day][period]
            lines.append(f"BREAK")
            grid[day][period] = (lines, "__break__")

    merge_spans: Dict = {}

    for lb in lessons:
        ts = timetable.get_assignment(lb.id)
        if not ts:
            continue

        primary   = cell_primary(lb)
        secondary = cell_secondary(lb)
        tertiary  = cell_tertiary(lb)

        # Co-teacher annotation
        if co_teacher_id and all_teachers and len(lb.teacher_ids) > 1:
            others = [
                all_teachers[tid].name.split()[-1]
                for tid in lb.teacher_ids
                if tid != co_teacher_id and tid in all_teachers
            ]
            if others:
                co = " / ".join(others[:2])
                primary = f"{primary}\n+{co}"

        if lb.duration > 1:
            merge_spans[(ts.day, ts.start_period)] = lb.duration

        for i, period in enumerate(ts.get_periods()):
            lines, _ = grid[ts.day][period]
            if i == 0:
                cell_lines = [primary]
                if secondary: cell_lines.append(secondary)
                if tertiary:  cell_lines.append(tertiary)
                if lb.duration > 1:
                    cell_lines.append(f"[{lb.duration} periods]")
                lines.extend(cell_lines)
            grid[ts.day][period] = (lines, lb.subject_id)

    els.append(_build_table(
        grid, timetable, days, ppd,
        merge_spans, color_map, styles, accent,
    ))
    return els


# =========================================================
# TABLE BUILDER
# =========================================================

def _build_table(
    grid, timetable, days, ppd,
    merge_spans, color_map, styles, accent,
) -> Table:
    W, _ = landscape(A4)
    margin = 30 * mm
    usable = W - margin

    period_col_w = 18 * mm
    day_col_w    = (usable - period_col_w) / days

    # ── Identify continuation cells ───────────────────────────────────────
    spanned = set()
    for (day, start_p), dur in merge_spans.items():
        col = day + 1
        for offset in range(1, dur):
            spanned.add((start_p + offset, col))

    # ── Build table_data ──────────────────────────────────────────────────
    # Header row
    header_cells = [Paragraph("", styles["cell"])]
    for d in range(days):
        header_cells.append(
            Paragraph(DAY_NAMES[d], ParagraphStyle(
                "DayHdr", fontName="Helvetica-Bold", fontSize=8.5,
                textColor=C_WHITE, alignment=TA_CENTER,
            ))
        )
    table_data = [header_cells]

    for period in range(ppd):
        period_label = Paragraph(
            f"<b>P{period + 1}</b>",
            ParagraphStyle(
                "PLabel", fontName="Helvetica-Bold", fontSize=8,
                textColor=C_TEXT2, alignment=TA_CENTER,
            )
        )
        row = [period_label]
        for day in range(days):
            if (period, day + 1) in spanned:
                row.append("")
                continue
            lines, sid = grid[day][period]
            if not lines:
                row.append("")
                continue
            if sid == "__break__":
                row.append(Paragraph("🔔  Break", ParagraphStyle(
                    "BreakCell", fontName="Helvetica-Bold", fontSize=8,
                    textColor=colors.HexColor("#92400e"), alignment=TA_CENTER,
                )))
                continue
            # Subject name (first line) bold, rest normal
            parts = []
            for i, line in enumerate(lines):
                if i == 0:
                    parts.append(f"<b>{line}</b>")
                elif line.startswith("["):
                    parts.append(f'<font size="6.5" color="#7c3aed">{line}</font>')
                elif line.startswith("+"):
                    parts.append(f'<font size="6.5" color="#64748b">{line}</font>')
                else:
                    parts.append(f'<font size="7" color="#475569">{line}</font>')
            content = "<br/>".join(parts)
            row.append(Paragraph(content, styles["cell"]))
        table_data.append(row)

    # ── Column widths ─────────────────────────────────────────────────────
    col_widths = [period_col_w] + [day_col_w] * days
    row_height = max(18 * mm, (landscape(A4)[1] - 55 * mm) / (ppd + 1))

    table = Table(table_data, colWidths=col_widths, rowHeights=None)

    # ── Base style ────────────────────────────────────────────────────────
    cmds = [
        # Header row
        ("BACKGROUND",    (0, 0),  (-1, 0),   accent),
        ("TEXTCOLOR",     (0, 0),  (-1, 0),   C_WHITE),
        ("FONTNAME",      (0, 0),  (-1, 0),   "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0),  (-1, 0),   8.5),
        ("TOPPADDING",    (0, 0),  (-1, 0),   10),
        ("BOTTOMPADDING", (0, 0),  (-1, 0),   10),
        # Period label column
        ("BACKGROUND",    (0, 1),  (0, -1),   C_PERIOD_BG),
        ("FONTNAME",      (0, 1),  (0, -1),   "Helvetica-Bold"),
        ("FONTSIZE",      (0, 1),  (0, -1),   8),
        # All cells
        ("ALIGN",         (0, 0),  (-1, -1),  "CENTER"),
        ("VALIGN",        (0, 0),  (-1, -1),  "MIDDLE"),
        ("GRID",          (0, 0),  (-1, -1),  0.4, C_BORDER),
        ("FONTSIZE",      (1, 1),  (-1, -1),  7.5),
        ("TOPPADDING",    (1, 1),  (-1, -1),  5),
        ("BOTTOMPADDING", (1, 1),  (-1, -1),  5),
        ("LEFTPADDING",   (1, 1),  (-1, -1),  4),
        ("RIGHTPADDING",  (1, 1),  (-1, -1),  4),
        # Alternating row tint (light)
        *[("BACKGROUND", (1, r), (-1, r), C_ROW_ALT)
          for r in range(2, ppd + 1, 2)],
    ]

    # ── Per-cell subject colours ──────────────────────────────────────────
    for period in range(ppd):
        for day in range(days):
            if (period, day + 1) in spanned:
                continue
            _, sid = grid[day][period]
            col = day + 1
            row = period + 1
            if sid == "__break__":
                cmds.append(("BACKGROUND", (col, row), (col, row), C_AMBER_BG))
                cmds.append(("FONTNAME",   (col, row), (col, row), "Helvetica-Bold"))
            elif sid and sid in color_map:
                cmds.append(("BACKGROUND", (col, row), (col, row), color_map[sid]))

    # ── Multi-period SPAN + accent left border ────────────────────────────
    for (day, start_p), dur in merge_spans.items():
        col       = day + 1
        row_start = start_p + 1
        row_end   = start_p + dur

        cmds.append(("SPAN",   (col, row_start), (col, row_end)))
        cmds.append(("VALIGN", (col, row_start), (col, row_end), "MIDDLE"))
        cmds.append(("ALIGN",  (col, row_start), (col, row_end), "CENTER"))

        _, sid = grid[day][start_p]
        if sid and sid in color_map:
            cmds.append(("BACKGROUND", (col, row_start), (col, row_end), color_map[sid]))

        # Thicker left border on merged block to visually frame it
        cmds.append(("LINEBEFORE", (col, row_start), (col, row_end), 2.5, accent))
        # Outer box
        cmds.append(("BOX", (col, row_start), (col, row_end), 0.8, colors.HexColor("#94a3b8")))

    table.setStyle(TableStyle(cmds))
    return table