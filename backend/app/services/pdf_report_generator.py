import io
import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

import matplotlib
matplotlib.use("Agg")  # Non-interactive headless backend
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, KeepTogether, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DETECTIONS_DIR = os.path.join(BACKEND_DIR, "uploads", "detections")

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas for dynamic 'Page X of Y' pagination and running headers/footers.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Header (pages > 1)
        if self._pageNumber > 1:
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(40, 755, 572, 755)
            self.drawString(40, 760, "PS 26057 MARINE DEBRIS & ANOMALY DETECTION — OPERATIONAL MISSION REPORT")
            self.drawRightString(572, 760, getattr(self, "report_mission_id", "HYDROGRAPHIC SURVEY"))

        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(40, 36, 572, 36)
        
        self.drawString(40, 24, "CONFIDENTIAL & PROPRIETARY — OPERATIONAL MISSION REPORT")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(572, 24, page_str)
        self.restoreState()


class PDFReportGenerator:
    """
    Professional Hydrographic Mission PDF Report Generator.
    Built with ReportLab Flowables and Matplotlib vector/raster graphics.
    """

    # Color Palette
    PRIMARY = colors.HexColor("#0F172A")    # Deep Navy
    SECONDARY = colors.HexColor("#1E3A8A")  # Marine Blue
    ACCENT = colors.HexColor("#2563EB")     # Bright Blue
    TEXT_DARK = colors.HexColor("#1E293B")  # Slate 800
    TEXT_MUTED = colors.HexColor("#64748B") # Slate 500
    BORDER_LIGHT = colors.HexColor("#E2E8F0")
    BG_LIGHT = colors.HexColor("#F8FAFC")
    EMERALD = colors.HexColor("#059669")
    AMBER = colors.HexColor("#D97706")
    RED = colors.HexColor("#DC2626")

    @classmethod
    def _create_styles(cls) -> Dict[str, ParagraphStyle]:
        base = getSampleStyleSheet()
        styles = {}

        styles["ReportTitle"] = ParagraphStyle(
            "ReportTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=cls.PRIMARY
        )
        styles["ReportSubtitle"] = ParagraphStyle(
            "ReportSubtitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=cls.SECONDARY
        )
        styles["MetaTag"] = ParagraphStyle(
            "MetaTag",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#3B82F6")
        )
        styles["SectionHeader"] = ParagraphStyle(
            "SectionHeader",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=cls.PRIMARY,
            spaceAfter=6
        )
        styles["BodyDark"] = ParagraphStyle(
            "BodyDark",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=cls.TEXT_DARK
        )
        styles["BodyMuted"] = ParagraphStyle(
            "BodyMuted",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=cls.TEXT_MUTED
        )
        styles["AssessmentBox"] = ParagraphStyle(
            "AssessmentBox",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#0F172A")
        )
        styles["TableHeader"] = ParagraphStyle(
            "TableHeader",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=colors.white
        )
        styles["TableCell"] = ParagraphStyle(
            "TableCell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=cls.TEXT_DARK
        )
        styles["TableCellBold"] = ParagraphStyle(
            "TableCellBold",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=cls.TEXT_DARK
        )
        return styles

    @classmethod
    def _generate_classification_chart(cls, classifications: List[Dict[str, Any]]) -> Optional[io.BytesIO]:
        """Generates horizontal bar chart for target classes using matplotlib."""
        if not classifications:
            return None
        
        labels = [c["label"] for c in reversed(classifications)]
        counts = [c["count"] for c in reversed(classifications)]

        fig, ax = plt.subplots(figsize=(6.5, max(2.2, len(labels) * 0.45)), dpi=200)
        bars = ax.barh(labels, counts, color="#2563EB", height=0.55, edgecolor="#1D4ED8")
        
        ax.set_title("Target Classification Distribution", fontsize=10, fontweight="bold", color="#0F172A", pad=8)
        ax.set_xlabel("Detected Candidate Count", fontsize=8, color="#475569")
        ax.tick_params(axis="both", labelsize=8, colors="#334155")
        ax.grid(axis="x", linestyle="--", alpha=0.4)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.spines["left"].set_color("#CBD5E1")
        ax.spines["bottom"].set_color("#CBD5E1")

        # Add count labels on ends of bars
        for bar in bars:
            w = bar.get_width()
            ax.text(w + 0.15, bar.get_y() + bar.get_height()/2, f"{int(w)}", va="center", ha="left", fontsize=8, fontweight="bold", color="#1E293B")

        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return buf

    @classmethod
    def _generate_spatial_map(cls, targets: List[Dict[str, Any]]) -> Optional[io.BytesIO]:
        """Generates cartographic scatter plot for target geographic distribution."""
        valid_coords = [t for t in targets if t.get("latitude") and t.get("longitude")]
        if not valid_coords:
            return None

        lats = [float(t["latitude"]) for t in valid_coords]
        lons = [float(t["longitude"]) for t in valid_coords]
        classes = [t.get("label", "Target") for t in valid_coords]

        # Distinct colors for classes
        unique_classes = list(set(classes))
        palette = ["#2563EB", "#059669", "#D97706", "#DC2626", "#7C3AED", "#DB2777", "#0D9488", "#EA580C"]
        color_map = {cls_name: palette[i % len(palette)] for i, cls_name in enumerate(unique_classes)}

        fig, ax = plt.subplots(figsize=(6.5, 3.2), dpi=200)
        
        for cls_name in unique_classes:
            cls_lons = [lons[i] for i, c in enumerate(classes) if c == cls_name]
            cls_lats = [lats[i] for i, c in enumerate(classes) if c == cls_name]
            ax.scatter(cls_lons, cls_lats, color=color_map[cls_name], label=cls_name, s=45, alpha=0.85, edgecolors="#0F172A", linewidth=0.5)

        # Draw grid lines for sectors
        min_lon, max_lon = min(lons), max(lons)
        min_lat, max_lat = min(lats), max(lats)
        mid_lon = (min_lon + max_lon) / 2.0
        mid_lat = (min_lat + max_lat) / 2.0

        if abs(max_lon - min_lon) > 0.0001:
            ax.axvline(mid_lon, color="#94A3B8", linestyle=":", linewidth=1, alpha=0.7)
        if abs(max_lat - min_lat) > 0.0001:
            ax.axhline(mid_lat, color="#94A3B8", linestyle=":", linewidth=1, alpha=0.7)

        ax.set_title("Geographic Survey Area & Target Position Distribution", fontsize=10, fontweight="bold", color="#0F172A", pad=8)
        ax.set_xlabel("Longitude (WGS84)", fontsize=8, color="#475569")
        ax.set_ylabel("Latitude (WGS84)", fontsize=8, color="#475569")
        ax.tick_params(axis="both", labelsize=7.5, colors="#334155")
        ax.grid(True, linestyle="--", alpha=0.3)
        ax.legend(fontsize=7, loc="best", framealpha=0.85)

        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return buf

    @classmethod
    def _generate_confidence_chart(cls, conf_dist: List[Dict[str, Any]]) -> Optional[io.BytesIO]:
        """Generates confidence distribution bar chart."""
        if not conf_dist:
            return None

        labels = [d["range"] for d in conf_dist]
        counts = [d["count"] for d in conf_dist]

        fig, ax = plt.subplots(figsize=(6.5, 2.2), dpi=200)
        bar_colors = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444"]
        bars = ax.bar(labels, counts, color=bar_colors[:len(labels)], width=0.55, edgecolor="#1E293B", linewidth=0.5)

        ax.set_title("Detection Confidence Range Distribution", fontsize=10, fontweight="bold", color="#0F172A", pad=8)
        ax.set_ylabel("Target Count", fontsize=8, color="#475569")
        ax.tick_params(axis="both", labelsize=8, colors="#334155")
        ax.grid(axis="y", linestyle="--", alpha=0.4)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)

        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2, h + 0.1, f"{int(h)}", ha="center", va="bottom", fontsize=8, fontweight="bold", color="#1E293B")

        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return buf

    @classmethod
    def generate_pdf(cls, analysis: Dict[str, Any]) -> bytes:
        """
        Compiles the complete ReportLab PDF document story from the unified analysis result.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=40,
            rightMargin=40,
            topMargin=45,
            bottomMargin=45
        )

        styles = cls._create_styles()
        story = []

        m_data = analysis["mission"]
        kpis = analysis["kpis"]
        m_id = m_data.get("mission_id", "MISSION-001")

        # ----------------------------------------------------
        # COVER / HEADER BANNER
        # ----------------------------------------------------
        header_table_data = [
            [
                Paragraph('<font color="#2563EB"><b>HYDROGRAPHIC SURVEY MISSION REPORT</b></font><br/><font size="7" color="#64748B">PS 26057 ACOUSTIC OBJECT DETECTION SYSTEM</font>', styles["BodyDark"]),
                Paragraph(f'<font size="7" color="#64748B">STATUS:</font> <b>{m_data.get("status", "COMPLETED").upper()}</b><br/><font size="7" color="#64748B">INGESTION:</font> <b>{m_data.get("ingestion_mode", "BATCH")}</b>', styles["BodyDark"])
            ]
        ]
        header_table = Table(header_table_data, colWidths=[380, 152])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (1,0), (1,0), 'RIGHT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 4))
        story.append(HRFlowable(width="100%", thickness=1.5, color=cls.PRIMARY, spaceAfter=12))

        # Main Title
        story.append(Paragraph(f"{m_data.get('survey_name', 'Survey Mission')}", styles["ReportTitle"]))
        story.append(Spacer(1, 2))
        story.append(Paragraph(f"Mission Identifier: <b>{m_id}</b> | Survey Date: <b>{m_data.get('survey_date')}</b> | Generated: <b>{analysis.get('generated_at')}</b>", styles["BodyMuted"]))
        story.append(Spacer(1, 12))

        # ----------------------------------------------------
        # SECTION 1: MISSION OPERATIONAL SUMMARY (KPI CARDS)
        # ----------------------------------------------------
        story.append(Paragraph("1. Mission Operational Summary", styles["SectionHeader"]))
        
        kpi_table_data = [
            [
                Paragraph('<font size="7" color="#64748B">TOTAL TARGETS</font><br/><font size="16"><b>{}</b></font><br/><font size="7" color="#64748B">Acoustic Contacts</font>'.format(kpis["total_targets"]), styles["BodyDark"]),
                Paragraph('<font size="7" color="#059669">HIGH CONFIDENCE</font><br/><font size="16" color="#059669"><b>{}</b></font><br/><font size="7" color="#059669">&ge; 80% Threshold</font>'.format(kpis["high_confidence_count"]), styles["BodyDark"]),
                Paragraph('<font size="7" color="#D97706">PENDING REVIEW</font><br/><font size="16" color="#D97706"><b>{}</b></font><br/><font size="7" color="#D97706">Requires Action</font>'.format(kpis["pending_count"]), styles["BodyDark"]),
                Paragraph('<font size="7" color="#2563EB">SHADOW VERIFIED</font><br/><font size="16" color="#2563EB"><b>{}</b></font><br/><font size="7" color="#2563EB">{}% Verified</font>'.format(kpis["shadow_verified_count"], kpis["shadow_verified_pct"]), styles["BodyDark"]),
                Paragraph('<font size="7" color="#475569">TOP DENSITY AREA</font><br/><font size="11"><b>{}</b></font><br/><font size="7" color="#475569">Peak Spatial Sector</font>'.format(kpis["highest_density_sector"].split(' ')[0] + ' ' + kpis["highest_density_sector"].split(' ')[1] if ' ' in kpis["highest_density_sector"] else kpis["highest_density_sector"]), styles["BodyDark"])
            ]
        ]
        kpi_table = Table(kpi_table_data, colWidths=[106, 106, 106, 106, 108])
        kpi_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), cls.BG_LIGHT),
            ('BOX', (0,0), (-1,-1), 0.5, cls.BORDER_LIGHT),
            ('INNERGRID', (0,0), (-1,-1), 0.5, cls.BORDER_LIGHT),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(kpi_table)
        story.append(Spacer(1, 10))

        # ----------------------------------------------------
        # SECTION 2: KEY MISSION METRICS TABLE
        # ----------------------------------------------------
        story.append(Paragraph("2. Key Hydrographic Mission Metrics", styles["SectionHeader"]))
        meta_rows = [
            [
                Paragraph("<b>Survey Name:</b>", styles["TableCellBold"]), Paragraph(str(m_data.get("survey_name")), styles["TableCell"]),
                Paragraph("<b>Acoustic Frequency:</b>", styles["TableCellBold"]), Paragraph(str(m_data.get("acoustic_freq")), styles["TableCell"]),
            ],
            [
                Paragraph("<b>Mission Identifier:</b>", styles["TableCellBold"]), Paragraph(str(m_id), styles["TableCell"]),
                Paragraph("<b>Swath Width:</b>", styles["TableCellBold"]), Paragraph(f"{m_data.get('swath_width_m')} meters", styles["TableCell"]),
            ],
            [
                Paragraph("<b>Ingestion Mode:</b>", styles["TableCellBold"]), Paragraph(str(m_data.get("ingestion_mode")), styles["TableCell"]),
                Paragraph("<b>Survey Depth:</b>", styles["TableCellBold"]), Paragraph(f"{m_data.get('depth_m')} meters", styles["TableCell"]),
            ],
            [
                Paragraph("<b>Mean Confidence:</b>", styles["TableCellBold"]), Paragraph(f"{kpis['avg_confidence']}%", styles["TableCell"]),
                Paragraph("<b>Ground-Truth Progress:</b>", styles["TableCellBold"]), Paragraph(f"{kpis['review_completion_pct']}% ({kpis['confirmed_count'] + kpis['rejected_count']} of {kpis['total_targets']} reviewed)", styles["TableCell"]),
            ]
        ]
        meta_table = Table(meta_rows, colWidths=[130, 136, 130, 136])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.white),
            ('BOX', (0,0), (-1,-1), 0.5, cls.BORDER_LIGHT),
            ('INNERGRID', (0,0), (-1,-1), 0.5, cls.BORDER_LIGHT),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 12))

        # ----------------------------------------------------
        # SECTION 3: OPERATIONAL ASSESSMENT
        # ----------------------------------------------------
        story.append(Paragraph("3. Operational Assessment", styles["SectionHeader"]))
        assess_box = Table(
            [[Paragraph(f"<b>Mission Evaluation:</b> {analysis['operational_assessment']}", styles["AssessmentBox"])]],
            colWidths=[532]
        )
        assess_box.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EFF6FF")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#BFDBFE")),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ]))
        story.append(assess_box)
        story.append(Spacer(1, 14))

        # ----------------------------------------------------
        # SECTION 4: TARGET CLASSIFICATION ANALYSIS
        # ----------------------------------------------------
        story.append(Paragraph("4. Target Classification Analysis", styles["SectionHeader"]))
        
        # Embedded bar chart
        chart_buf = cls._generate_classification_chart(analysis["classification_analysis"])
        if chart_buf:
            story.append(RLImage(chart_buf, width=6.5*inch, height=2.3*inch))
            story.append(Spacer(1, 6))

        # Classification Table
        class_table_data = [
            [
                Paragraph("Target Classification", styles["TableHeader"]),
                Paragraph("Category Code", styles["TableHeader"]),
                Paragraph("Count", styles["TableHeader"]),
                Paragraph("% Total", styles["TableHeader"]),
                Paragraph("Avg Conf.", styles["TableHeader"]),
                Paragraph("Conf. Range", styles["TableHeader"])
            ]
        ]
        if not analysis["classification_analysis"]:
            class_table_data.append([Paragraph("No classifications recorded.", styles["TableCell"]), Paragraph("-", styles["TableCell"]), Paragraph("0", styles["TableCell"]), Paragraph("0%", styles["TableCell"]), Paragraph("0%", styles["TableCell"]), Paragraph("-", styles["TableCell"])])
        else:
            for item in analysis["classification_analysis"]:
                class_table_data.append([
                    Paragraph(f"<b>{item['label']}</b>", styles["TableCellBold"]),
                    Paragraph(f"<font color='#64748B'>{item['class']}</font>", styles["TableCell"]),
                    Paragraph(str(item["count"]), styles["TableCell"]),
                    Paragraph(f"{item['percentage']}%", styles["TableCell"]),
                    Paragraph(f"{item['avg_confidence']}%", styles["TableCell"]),
                    Paragraph(f"{item['min_confidence']}% – {item['max_confidence']}%", styles["TableCell"]),
                ])

        class_table = Table(class_table_data, colWidths=[140, 112, 60, 70, 75, 75])
        class_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), cls.PRIMARY),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('ALIGN', (2,0), (-1,-1), 'CENTER'),
            ('GRID', (0,0), (-1,-1), 0.5, cls.BORDER_LIGHT),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, cls.BG_LIGHT]),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(class_table)
        story.append(Spacer(1, 14))

        # ----------------------------------------------------
        # SECTION 5: GEOGRAPHIC TARGET DISTRIBUTION & AREA RANKING
        # ----------------------------------------------------
        story.append(KeepTogether([
            Paragraph("5. Geographic Target Distribution & Survey Area Ranking", styles["SectionHeader"]),
            Paragraph("Spatial concentration analysis dividing surveyed bounding box into geographic sectors:", styles["BodyMuted"]),
            Spacer(1, 4)
        ]))

        map_buf = cls._generate_spatial_map(analysis.get("priority_targets", []))
        if map_buf:
            story.append(RLImage(map_buf, width=6.5*inch, height=3.0*inch))
            story.append(Spacer(1, 6))

        sector_table_data = [
            [
                Paragraph("Rank", styles["TableHeader"]),
                Paragraph("Survey Sector Area", styles["TableHeader"]),
                Paragraph("Target Count", styles["TableHeader"]),
                Paragraph("% Total", styles["TableHeader"]),
                Paragraph("Dominant Detection Class", styles["TableHeader"]),
                Paragraph("Avg Conf.", styles["TableHeader"])
            ]
        ]
        if not analysis["sector_analysis"]:
            sector_table_data.append([Paragraph("1", styles["TableCell"]), Paragraph("Sector A1 (Unspecified / Uniform)", styles["TableCell"]), Paragraph(str(kpis["total_targets"]), styles["TableCell"]), Paragraph("100%", styles["TableCell"]), Paragraph("None", styles["TableCell"]), Paragraph(f"{kpis['avg_confidence']}%", styles["TableCell"])])
        else:
            for idx, sec in enumerate(analysis["sector_analysis"], start=1):
                sector_table_data.append([
                    Paragraph(f"<b>#{idx}</b>", styles["TableCellBold"]),
                    Paragraph(f"<b>{sec['sector_id']}</b>", styles["TableCellBold"]),
                    Paragraph(str(sec["target_count"]), styles["TableCell"]),
                    Paragraph(f"{sec['percentage']}%", styles["TableCell"]),
                    Paragraph(sec["dominant_class"], styles["TableCell"]),
                    Paragraph(f"{sec['avg_confidence']}%", styles["TableCell"])
                ])

        sec_table = Table(sector_table_data, colWidths=[45, 175, 75, 65, 112, 60])
        sec_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), cls.SECONDARY),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('ALIGN', (0,0), (0,-1), 'CENTER'),
            ('ALIGN', (2,0), (3,-1), 'CENTER'),
            ('ALIGN', (5,0), (5,-1), 'CENTER'),
            ('GRID', (0,0), (-1,-1), 0.5, cls.BORDER_LIGHT),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, cls.BG_LIGHT]),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(sec_table)
        story.append(Spacer(1, 14))

        # ----------------------------------------------------
        # SECTION 6: DETECTION CONFIDENCE ANALYSIS
        # ----------------------------------------------------
        story.append(KeepTogether([
            Paragraph("6. Detection Confidence Distribution", styles["SectionHeader"]),
            Paragraph("Statistical evaluation of acoustic inference confidence across candidate returns:", styles["BodyMuted"]),
            Spacer(1, 4)
        ]))

        conf_buf = cls._generate_confidence_chart(analysis["confidence_analysis"]["distribution"])
        if conf_buf:
            story.append(RLImage(conf_buf, width=6.5*inch, height=2.1*inch))
            story.append(Spacer(1, 6))

        # Stats summary row
        c_stats = analysis["confidence_analysis"]
        conf_summary_data = [
            [
                Paragraph(f"<b>Mean Confidence:</b> {c_stats['average']}%", styles["TableCellBold"]),
                Paragraph(f"<b>Median Confidence:</b> {c_stats['median']}%", styles["TableCellBold"]),
                Paragraph(f"<b>Min Confidence:</b> {c_stats['min']}%", styles["TableCellBold"]),
                Paragraph(f"<b>Max Confidence:</b> {c_stats['max']}%", styles["TableCellBold"])
            ]
        ]
        conf_sum_table = Table(conf_summary_data, colWidths=[133, 133, 133, 133])
        conf_sum_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), cls.BG_LIGHT),
            ('BOX', (0,0), (-1,-1), 0.5, cls.BORDER_LIGHT),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(conf_sum_table)
        story.append(Spacer(1, 14))

        # ----------------------------------------------------
        # SECTION 7 & 8: SHADOW VERIFICATION & REVIEW STATUS
        # ----------------------------------------------------
        story.append(KeepTogether([
            Paragraph("7. Acoustic Shadow Verification & 8. Human Review Status", styles["SectionHeader"]),
            Paragraph("Multi-factor validation separating automatic ML inference, physical shadow confirmation, and human sign-off:", styles["BodyMuted"]),
            Spacer(1, 6)
        ]))

        sh = analysis["shadow_verification"]
        rev = analysis["review_status"]

        dual_table_data = [
            [
                Paragraph("<b>ACOUSTIC SHADOW VERIFICATION</b>", styles["TableHeader"]),
                Paragraph("<b>HUMAN ANALYST REVIEW STATUS</b>", styles["TableHeader"])
            ],
            [
                Paragraph(
                    f"• <b>Shadow Verified:</b> {sh['verified_count']} ({sh['verified_pct']}%)<br/>"
                    f"• <b>Not Verified:</b> {sh['unverified_count']} ({sh['unverified_pct']}%)<br/>"
                    f"• <b>Unknown / Missing:</b> {sh['unknown_count']}<br/>"
                    f"<font size='7' color='#64748B'>U-Net acoustic acoustic shadow confirms relief & seafloor elevation.</font>",
                    styles["TableCell"]
                ),
                Paragraph(
                    f"• <b>Confirmed / Ground-Truthed:</b> {rev['confirmed_count']} ({rev['confirmed_pct']}%)<br/>"
                    f"• <b>Pending Review:</b> {rev['pending_count']} ({rev['pending_pct']}%)<br/>"
                    f"• <b>Rejected False Alarms:</b> {rev['rejected_count']} ({rev['rejected_pct']}%)<br/>"
                    f"<font size='7' color='#64748B'>Total Reviewed: {rev['reviewed_total']} of {kpis['total_targets']} ({rev['completion_pct']}% complete)</font>",
                    styles["TableCell"]
                )
            ]
        ]
        dual_table = Table(dual_table_data, colWidths=[266, 266])
        dual_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), cls.SECONDARY),
            ('BACKGROUND', (0,1), (-1,1), cls.BG_LIGHT),
            ('GRID', (0,0), (-1,-1), 0.5, cls.BORDER_LIGHT),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(dual_table)
        story.append(Spacer(1, 14))

        # ----------------------------------------------------
        # SECTION 9: REVIEW PRIORITY TARGETS
        # ----------------------------------------------------
        story.append(KeepTogether([
            Paragraph("9. Operator Review Priority Targets", styles["SectionHeader"]),
            Paragraph("Deterministic priority scoring weighting confidence, pending review status, shadow verification, and object size to guide analyst attention:", styles["BodyMuted"]),
            Spacer(1, 6)
        ]))

        priority_table_data = [
            [
                Paragraph("Priority", styles["TableHeader"]),
                Paragraph("Target ID", styles["TableHeader"]),
                Paragraph("Classification", styles["TableHeader"]),
                Paragraph("Confidence", styles["TableHeader"]),
                Paragraph("Shadow", styles["TableHeader"]),
                Paragraph("Est. Size", styles["TableHeader"]),
                Paragraph("Status", styles["TableHeader"]),
                Paragraph("Priority Score", styles["TableHeader"])
            ]
        ]

        top_priority_targets = analysis["priority_targets"][:15]
        if not top_priority_targets:
            priority_table_data.append([Paragraph("-", styles["TableCell"]), Paragraph("No targets registered", styles["TableCell"]), Paragraph("-", styles["TableCell"]), Paragraph("-", styles["TableCell"]), Paragraph("-", styles["TableCell"]), Paragraph("-", styles["TableCell"]), Paragraph("-", styles["TableCell"]), Paragraph("-", styles["TableCell"])])
        else:
            for item in top_priority_targets:
                stat_color = "#059669" if item["status"] == "confirmed" else ("#D97706" if item["status"] == "pending_review" else "#DC2626")
                priority_table_data.append([
                    Paragraph(f"<b>#{item['rank']}</b>", styles["TableCellBold"]),
                    Paragraph(f"<b>{item['target_id']}</b>", styles["TableCellBold"]),
                    Paragraph(item["label"], styles["TableCell"]),
                    Paragraph(f"{item['confidence']}%", styles["TableCell"]),
                    Paragraph(item["shadow_verified"], styles["TableCell"]),
                    Paragraph(f"{item['estimated_size_m']}m", styles["TableCell"]),
                    Paragraph(f"<font color='{stat_color}'><b>{item['status']}</b></font>", styles["TableCell"]),
                    Paragraph(f"<b>{item['priority_score']}</b> / 100", styles["TableCellBold"])
                ])

        p_table = Table(priority_table_data, colWidths=[45, 75, 115, 60, 65, 55, 65, 52])
        p_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), cls.PRIMARY),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('ALIGN', (0,0), (0,-1), 'CENTER'),
            ('ALIGN', (3,0), (7,-1), 'CENTER'),
            ('GRID', (0,0), (-1,-1), 0.5, cls.BORDER_LIGHT),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, cls.BG_LIGHT]),
            ('TOPPADDING', (0,0), (-1,-1), 3.5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ]))
        story.append(p_table)
        story.append(Spacer(1, 14))

        # ----------------------------------------------------
        # SECTION 10: DETECTION EVIDENCE GALLERY
        # ----------------------------------------------------
        story.append(KeepTogether([
            Paragraph("10. Detection Evidence Gallery", styles["SectionHeader"]),
            Paragraph("Acoustic side-scan sonar image snippets associated with priority target returns:", styles["BodyMuted"]),
            Spacer(1, 6)
        ]))

        gallery_targets = [t for t in analysis["priority_targets"] if t.get("sonar_image_ref")][:4]
        if not gallery_targets:
            gallery_box = Table(
                [[Paragraph("<i>No binary evidence images currently associated with targets in this mission. Evidence images will display automatically upon ingestion.</i>", styles["BodyMuted"])]],
                colWidths=[532]
            )
            gallery_box.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), cls.BG_LIGHT),
                ('BOX', (0,0), (-1,-1), 0.5, cls.BORDER_LIGHT),
                ('TOPPADDING', (0,0), (-1,-1), 8),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                ('ALIGN', (0,0), (-1,-1), 'CENTER')
            ]))
            story.append(gallery_box)
        else:
            gallery_cells = []
            for t in gallery_targets:
                img_ref = t["sonar_image_ref"]
                local_path = None
                
                # Check local filesystem
                if img_ref and img_ref.startswith("/uploads/detections/"):
                    fname = os.path.basename(img_ref)
                    cand = os.path.join(DETECTIONS_DIR, fname)
                    if os.path.exists(cand):
                        local_path = cand

                if local_path and os.path.exists(local_path):
                    try:
                        img_elem = RLImage(local_path, width=2.4*inch, height=1.4*inch)
                    except Exception:
                        img_elem = Paragraph("<font size='7' color='#DC2626'>Error loading image</font>", styles["BodyMuted"])
                else:
                    img_elem = Paragraph(f"<font size='7' color='#64748B'>Evidence: {os.path.basename(str(img_ref))}<br/>(Stored in PostgreSQL)</font>", styles["BodyMuted"])

                caption = Paragraph(
                    f"<b>{t['target_id']}</b>: {t['label']}<br/>"
                    f"<font size='7' color='#64748B'>Conf: {t['confidence']}% | Shadow: {t['shadow_verified']} | Size: {t['estimated_size_m']}m</font>",
                    styles["TableCell"]
                )
                gallery_cells.append([img_elem, caption])

            # Arrange into 2x2 grid
            grid_data = []
            for i in range(0, len(gallery_cells), 2):
                row_items = gallery_cells[i:i+2]
                if len(row_items) == 1:
                    row_items.append([Paragraph("", styles["BodyMuted"]), Paragraph("", styles["BodyMuted"])])
                grid_data.append([
                    Table([[row_items[0][0]], [row_items[0][1]]], colWidths=[255]),
                    Table([[row_items[1][0]], [row_items[1][1]]], colWidths=[255])
                ])

            g_table = Table(grid_data, colWidths=[266, 266])
            g_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ]))
            story.append(g_table)

        story.append(Spacer(1, 14))

        # ----------------------------------------------------
        # SECTION 11: MISSION TIMELINE & SECTION 12: DATA QUALITY
        # ----------------------------------------------------
        story.append(KeepTogether([
            Paragraph("11. Mission Timeline & 12. Analysis Quality Metrics", styles["SectionHeader"]),
            Spacer(1, 4)
        ]))

        timeline_items = analysis.get("timeline", [])
        dq = analysis.get("data_quality", {})

        t_text_list = []
        for t_item in timeline_items:
            t_text_list.append(f"• <b>{t_item['stage']}</b> ({t_item['timestamp']})<br/>&nbsp;&nbsp;<font color='#64748B'>{t_item['description']}</font>")

        dq_text = (
            f"• <b>Total Evaluated Targets:</b> {dq.get('total_targets', 0)}<br/>"
            f"• <b>Multi-Pass Swath Observations:</b> {dq.get('total_detections', 0)}<br/>"
            f"• <b>Valid Coordinate Coverage:</b> {dq.get('valid_coordinates', 0)} ({dq.get('coordinate_completeness_pct', 0)}%)<br/>"
            f"• <b>Missing Coordinates:</b> {dq.get('missing_coordinates', 0)}<br/>"
            f"• <b>Confidence Values Recorded:</b> {dq.get('valid_confidence', 0)}<br/>"
            f"• <b>Acoustic Shadow Verification Rate:</b> {kpis.get('shadow_verified_pct', 0)}%<br/>"
            f"• <b>Evidence Imagery Available:</b> {dq.get('evidence_available', 0)} ({dq.get('evidence_completeness_pct', 0)}%)<br/>"
            f"• <b>Pending Ground-Truth Reviews:</b> {dq.get('pending_review', 0)}"
        )

        t_dq_table_data = [
            [
                Paragraph("<b>OPERATIONAL MISSION TIMELINE</b>", styles["TableHeader"]),
                Paragraph("<b>DATA INTEGRITY & QUALITY AUDIT</b>", styles["TableHeader"])
            ],
            [
                Paragraph("<br/>".join(t_text_list) if t_text_list else "No timeline milestones logged.", styles["TableCell"]),
                Paragraph(dq_text, styles["TableCell"])
            ]
        ]
        t_dq_table = Table(t_dq_table_data, colWidths=[266, 266])
        t_dq_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), cls.SECONDARY),
            ('BACKGROUND', (0,1), (-1,1), cls.BG_LIGHT),
            ('GRID', (0,0), (-1,-1), 0.5, cls.BORDER_LIGHT),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(t_dq_table)
        story.append(Spacer(1, 14))

        # ----------------------------------------------------
        # SECTION 13: DETAILED TARGET REGISTER TABLE
        # ----------------------------------------------------
        story.append(KeepTogether([
            Paragraph("13. Detailed Physical Target Register", styles["SectionHeader"]),
            Paragraph("Consolidated physical seafloor targets verified across acoustic passes (1 Target = 1 Physical Location):", styles["BodyMuted"]),
            Spacer(1, 4)
        ]))

        reg_data = [
            [
                Paragraph("Target ID", styles["TableHeader"]),
                Paragraph("Classification", styles["TableHeader"]),
                Paragraph("Confidence", styles["TableHeader"]),
                Paragraph("Coordinates", styles["TableHeader"]),
                Paragraph("Est. Size", styles["TableHeader"]),
                Paragraph("Shadow", styles["TableHeader"]),
                Paragraph("Status", styles["TableHeader"]),
                Paragraph("Passes", styles["TableHeader"])
            ]
        ]

        if not analysis["priority_targets"]:
            reg_data.append([Paragraph("No targets recorded", styles["TableCell"]), Paragraph("-", styles["TableCell"]), Paragraph("-", styles["TableCell"]), Paragraph("-", styles["TableCell"]), Paragraph("-", styles["TableCell"]), Paragraph("-", styles["TableCell"]), Paragraph("-", styles["TableCell"]), Paragraph("-", styles["TableCell"])])
        else:
            for item in analysis["priority_targets"]:
                coord_str = f"{item['latitude']}, {item['longitude']}" if item["latitude"] is not None else "No GPS"
                stat_color = "#059669" if item["status"] == "confirmed" else ("#D97706" if item["status"] == "pending_review" else "#DC2626")
                reg_data.append([
                    Paragraph(f"<b>{item['target_id']}</b>", styles["TableCellBold"]),
                    Paragraph(item["label"], styles["TableCell"]),
                    Paragraph(f"{item['confidence']}%", styles["TableCell"]),
                    Paragraph(f"<font size='6.5'>{coord_str}</font>", styles["TableCell"]),
                    Paragraph(f"{item['estimated_size_m']}m", styles["TableCell"]),
                    Paragraph(item["shadow_verified"], styles["TableCell"]),
                    Paragraph(f"<font color='{stat_color}'><b>{item['status']}</b></font>", styles["TableCell"]),
                    Paragraph(str(item.get("observation_count", 1)), styles["TableCell"])
                ])

        reg_table = Table(reg_data, colWidths=[70, 110, 55, 115, 50, 55, 52, 25])
        reg_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), cls.PRIMARY),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('ALIGN', (2,0), (2,-1), 'CENTER'),
            ('ALIGN', (4,0), (-1,-1), 'CENTER'),
            ('GRID', (0,0), (-1,-1), 0.5, cls.BORDER_LIGHT),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, cls.BG_LIGHT]),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(reg_table)

        # Build document with dynamic NumberedCanvas
        def page_canvas_maker(*args, **kwargs):
            canv = NumberedCanvas(*args, **kwargs)
            canv.report_mission_id = f"MISSION: {m_id}"
            return canv

        doc.build(story, canvasmaker=page_canvas_maker)
        buffer.seek(0)
        return buffer.getvalue()

pdf_report_generator = PDFReportGenerator()
