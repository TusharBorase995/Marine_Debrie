import io
from typing import Dict, Any, List
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, PieChart, Reference

class ExcelReportGenerator:
    """
    Professional 10-Sheet Operational Mission Excel Workbook Generator.
    Uses openpyxl with native styling, number formats, auto-width, and embedded charts.
    """

    # Brand Colors
    HEADER_FILL = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    SUBHEADER_FILL = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    ZEBRA_FILL = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    ACCENT_FILL = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
    
    HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    TITLE_FONT = Font(name="Calibri", size=14, bold=True, color="0F172A")
    BOLD_FONT = Font(name="Calibri", size=10, bold=True, color="1E293B")
    REGULAR_FONT = Font(name="Calibri", size=10, color="1E293B")
    MUTED_FONT = Font(name="Calibri", size=9, color="64748B", italic=True)

    THIN_BORDER = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )

    @classmethod
    def _apply_table_styling(cls, ws, min_row: int, max_row: int, min_col: int, max_col: int, is_zebra: bool = True):
        for col_idx in range(min_col, max_col + 1):
            cell = ws.cell(row=min_row, column=col_idx)
            cell.fill = cls.HEADER_FILL
            cell.font = cls.HEADER_FONT
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        for row_idx in range(min_row + 1, max_row + 1):
            fill = cls.ZEBRA_FILL if (is_zebra and row_idx % 2 == 0) else PatternFill(fill_type=None)
            for col_idx in range(min_col, max_col + 1):
                c = ws.cell(row=row_idx, column=col_idx)
                if fill.fill_type:
                    c.fill = fill
                c.border = cls.THIN_BORDER
                if not c.font or c.font.name != "Calibri":
                    c.font = cls.REGULAR_FONT

    @classmethod
    def _auto_column_widths(cls, ws):
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or '')
                if cell.number_format and '%' in cell.number_format:
                    val += '%'
                max_len = max(max_len, len(val))
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    @classmethod
    def generate_excel(cls, analysis: Dict[str, Any]) -> bytes:
        wb = openpyxl.Workbook()
        # Remove default sheet
        wb.remove(wb.active)

        mission = analysis["mission"]
        kpis = analysis["kpis"]
        m_id = mission.get("mission_id", "MISSION-001")

        # =====================================================================
        # SHEET 1: EXECUTIVE SUMMARY
        # =====================================================================
        ws1 = wb.create_sheet(title="Executive Summary")
        ws1.views.sheetView[0].showGridLines = True
        
        ws1.cell(row=1, column=1, value="HYDROGRAPHIC SURVEY MISSION — OPERATIONAL SUMMARY").font = cls.TITLE_FONT
        ws1.cell(row=2, column=1, value=f"Mission ID: {m_id} | Survey: {mission.get('survey_name')} | Date: {mission.get('survey_date')}").font = cls.MUTED_FONT

        # Operational Assessment Box
        ws1.cell(row=4, column=1, value="Operational Assessment:").font = cls.BOLD_FONT
        ws1.merge_cells("A5:F6")
        assess_cell = ws1.cell(row=5, column=1, value=analysis["operational_assessment"])
        assess_cell.font = cls.REGULAR_FONT
        assess_cell.fill = cls.ACCENT_FILL
        assess_cell.alignment = Alignment(wrap_text=True, vertical="top")

        # KPI Matrix
        kpi_rows = [
            ("Total Physical Targets", kpis["total_targets"]),
            ("Multi-Pass Acoustic Detections", kpis["total_detections"]),
            ("Mean Classification Confidence", f"{kpis['avg_confidence']}%"),
            ("High Confidence Targets (>= 80%)", kpis["high_confidence_count"]),
            ("Low Confidence Targets (< 70%)", kpis["low_confidence_count"]),
            ("Acoustic Shadow Verified", f"{kpis['shadow_verified_count']} ({kpis['shadow_verified_pct']}%)"),
            ("Shadow Unverified", kpis["shadow_unverified_count"]),
            ("Pending Human Review", kpis["pending_count"]),
            ("Confirmed Ground-Truth Targets", kpis["confirmed_count"]),
            ("Rejected / False Alarms", kpis["rejected_count"]),
            ("Analyst Review Completion", f"{kpis['review_completion_pct']}%"),
            ("Highest Density Spatial Sector", kpis["highest_density_sector"]),
            ("Acoustic Frequency", mission.get("acoustic_freq", "410 kHz")),
            ("Survey Swath Width", f"{mission.get('swath_width_m')} m"),
            ("Operating Depth", f"{mission.get('depth_m')} m")
        ]

        ws1.cell(row=8, column=1, value="Mission Metric").font = cls.HEADER_FONT
        ws1.cell(row=8, column=1).fill = cls.HEADER_FILL
        ws1.cell(row=8, column=2, value="Recorded Value").font = cls.HEADER_FONT
        ws1.cell(row=8, column=2).fill = cls.HEADER_FILL

        for i, (metric, val) in enumerate(kpi_rows, start=9):
            ws1.cell(row=i, column=1, value=metric).font = cls.BOLD_FONT
            c2 = ws1.cell(row=i, column=2, value=val)
            c2.font = cls.REGULAR_FONT
            c2.alignment = Alignment(horizontal="right")
            ws1.cell(row=i, column=1).border = cls.THIN_BORDER
            c2.border = cls.THIN_BORDER

        cls._auto_column_widths(ws1)

        # =====================================================================
        # SHEET 2: TARGET DETECTIONS (Detailed Master Register)
        # =====================================================================
        ws2 = wb.create_sheet(title="Target Detections")
        ws2.views.sheetView[0].showGridLines = True
        ws2.freeze_panes = "A2"

        headers_s2 = [
            "Target ID", "Classification Label", "Class Code", "Confidence (%)",
            "Latitude (WGS84)", "Longitude (WGS84)", "Estimated Size (m)",
            "Shadow Verified", "Review Status", "Priority Score",
            "Observation Count", "Sonar Image Reference"
        ]
        ws2.append(headers_s2)

        for t in analysis.get("priority_targets", []):
            ws2.append([
                t["target_id"],
                t["label"],
                t["class"],
                t["confidence"] / 100.0,
                t["latitude"],
                t["longitude"],
                t["estimated_size_m"],
                t["shadow_verified"],
                t["status"],
                t["priority_score"],
                t.get("observation_count", 1),
                t.get("sonar_image_ref") or "None"
            ])

        cls._apply_table_styling(ws2, 1, max(2, len(analysis.get("priority_targets", [])) + 1), 1, len(headers_s2))
        
        # Percentage formatting on confidence
        for row in range(2, len(analysis.get("priority_targets", [])) + 2):
            ws2.cell(row=row, column=4).number_format = "0.0%"
            if ws2.cell(row=row, column=5).value is not None:
                ws2.cell(row=row, column=5).number_format = "0.000000"
                ws2.cell(row=row, column=6).number_format = "0.000000"

        ws2.auto_filter.ref = f"A1:{get_column_letter(len(headers_s2))}{max(2, len(analysis.get('priority_targets', [])) + 1)}"
        cls._auto_column_widths(ws2)

        # =====================================================================
        # SHEET 3: CLASSIFICATION ANALYSIS
        # =====================================================================
        ws3 = wb.create_sheet(title="Classification Analysis")
        ws3.views.sheetView[0].showGridLines = True
        ws3.freeze_panes = "A2"

        headers_s3 = ["Classification Label", "Category Code", "Target Count", "% of Total", "Average Confidence", "Min Confidence", "Max Confidence"]
        ws3.append(headers_s3)

        classes_data = analysis.get("classification_analysis", [])
        for c in classes_data:
            ws3.append([
                c["label"],
                c["class"],
                c["count"],
                c["percentage"] / 100.0,
                c["avg_confidence"] / 100.0,
                c["min_confidence"] / 100.0,
                c["max_confidence"] / 100.0
            ])

        cls._apply_table_styling(ws3, 1, max(2, len(classes_data) + 1), 1, len(headers_s3))

        for row in range(2, len(classes_data) + 2):
            ws3.cell(row=row, column=4).number_format = "0.0%"
            ws3.cell(row=row, column=5).number_format = "0.0%"
            ws3.cell(row=row, column=6).number_format = "0.0%"
            ws3.cell(row=row, column=7).number_format = "0.0%"

        # Native OpenPyXL BarChart
        if classes_data:
            chart1 = BarChart()
            chart1.type = "col"
            chart1.style = 10
            chart1.title = "Target Count by Classification"
            chart1.y_axis.title = "Candidate Count"
            chart1.x_axis.title = "Class"
            data_ref = Reference(ws3, min_col=3, min_row=1, max_row=len(classes_data) + 1)
            cats_ref = Reference(ws3, min_col=1, min_row=2, max_row=len(classes_data) + 1)
            chart1.add_data(data_ref, titles_from_data=True)
            chart1.set_categories(cats_ref)
            chart1.legend = None
            chart1.width = 16
            chart1.height = 10
            ws3.add_chart(chart1, "I2")

        cls._auto_column_widths(ws3)

        # =====================================================================
        # SHEET 4: SURVEY AREA RANKING
        # =====================================================================
        ws4 = wb.create_sheet(title="Survey Area Ranking")
        ws4.views.sheetView[0].showGridLines = True
        ws4.freeze_panes = "A2"

        headers_s4 = ["Rank", "Survey Sector", "Target Count", "% of Total", "Dominant Class", "Average Confidence"]
        ws4.append(headers_s4)

        sec_data = analysis.get("sector_analysis", [])
        for idx, s in enumerate(sec_data, start=1):
            ws4.append([
                idx,
                s["sector_id"],
                s["target_count"],
                s["percentage"] / 100.0,
                s["dominant_class"],
                s["avg_confidence"] / 100.0
            ])

        cls._apply_table_styling(ws4, 1, max(2, len(sec_data) + 1), 1, len(headers_s4))
        for row in range(2, len(sec_data) + 2):
            ws4.cell(row=row, column=4).number_format = "0.0%"
            ws4.cell(row=row, column=6).number_format = "0.0%"

        cls._auto_column_widths(ws4)

        # =====================================================================
        # SHEET 5: REVIEW ANALYSIS
        # =====================================================================
        ws5 = wb.create_sheet(title="Review Analysis")
        ws5.views.sheetView[0].showGridLines = True
        ws5.freeze_panes = "A2"

        headers_s5 = ["Review Category", "Target Count", "% of Total", "Analyst Action Requirement"]
        ws5.append(headers_s5)

        rev = analysis["review_status"]
        ws5.append(["Confirmed / Ground-Truthed", rev["confirmed_count"], rev["confirmed_pct"] / 100.0, "Verified physical target"])
        ws5.append(["Pending Review", rev["pending_count"], rev["pending_pct"] / 100.0, "Requires operator inspection"])
        ws5.append(["Rejected / False Alarms", rev["rejected_count"], rev["rejected_pct"] / 100.0, "Filtered non-target anomaly"])

        cls._apply_table_styling(ws5, 1, 4, 1, len(headers_s5))
        for row in range(2, 5):
            ws5.cell(row=row, column=3).number_format = "0.0%"

        # Pie Chart for Review Status
        pie = PieChart()
        pie.title = "Human Review Status Distribution"
        data_ref = Reference(ws5, min_col=2, min_row=1, max_row=4)
        labels_ref = Reference(ws5, min_col=1, min_row=2, max_row=4)
        pie.add_data(data_ref, titles_from_data=True)
        pie.set_categories(labels_ref)
        pie.width = 14
        pie.height = 9
        ws5.add_chart(pie, "F2")

        cls._auto_column_widths(ws5)

        # =====================================================================
        # SHEET 6: CONFIDENCE ANALYSIS
        # =====================================================================
        ws6 = wb.create_sheet(title="Confidence Analysis")
        ws6.views.sheetView[0].showGridLines = True
        ws6.freeze_panes = "A2"

        headers_s6 = ["Confidence Range", "Target Count", "% of Total", "Risk Interpretation"]
        ws6.append(headers_s6)

        c_dist = analysis["confidence_analysis"]["distribution"]
        risk_labels = {
            "90%–100% (Very High)": "High certainty acoustic signature",
            "80%–89% (High)": "Strong acoustic signature",
            "70%–79% (Moderate)": "Candidate return requiring cross-pass check",
            "< 70% (Low)": "Low confidence return"
        }
        for d in c_dist:
            ws6.append([
                d["range"],
                d["count"],
                d["pct"] / 100.0,
                risk_labels.get(d["range"], "Candidate return")
            ])

        cls._apply_table_styling(ws6, 1, len(c_dist) + 1, 1, len(headers_s6))
        for row in range(2, len(c_dist) + 2):
            ws6.cell(row=row, column=3).number_format = "0.0%"

        # Summary Statistics Table
        ws6.cell(row=len(c_dist) + 3, column=1, value="Metric").font = cls.HEADER_FONT
        ws6.cell(row=len(c_dist) + 3, column=1).fill = cls.SUBHEADER_FILL
        ws6.cell(row=len(c_dist) + 3, column=2, value="Value").font = cls.HEADER_FONT
        ws6.cell(row=len(c_dist) + 3, column=2).fill = cls.SUBHEADER_FILL

        c_metrics = [
            ("Mean Confidence", f"{analysis['confidence_analysis']['average']}%"),
            ("Median Confidence", f"{analysis['confidence_analysis']['median']}%"),
            ("Minimum Confidence", f"{analysis['confidence_analysis']['min']}%"),
            ("Maximum Confidence", f"{analysis['confidence_analysis']['max']}%"),
        ]
        for idx, (m, v) in enumerate(c_metrics, start=len(c_dist) + 4):
            ws6.cell(row=idx, column=1, value=m).font = cls.BOLD_FONT
            ws6.cell(row=idx, column=2, value=v).font = cls.REGULAR_FONT
            ws6.cell(row=idx, column=1).border = cls.THIN_BORDER
            ws6.cell(row=idx, column=2).border = cls.THIN_BORDER

        cls._auto_column_widths(ws6)

        # =====================================================================
        # SHEET 7: DATA QUALITY
        # =====================================================================
        ws7 = wb.create_sheet(title="Data Quality")
        ws7.views.sheetView[0].showGridLines = True
        ws7.freeze_panes = "A2"

        headers_s7 = ["Data Quality Metric", "Evaluated Count", "Compliance / Completeness Rate"]
        ws7.append(headers_s7)

        dq = analysis["data_quality"]
        dq_rows = [
            ("Total Physical Targets", dq["total_targets"], "100.0%"),
            ("Multi-Pass Acoustic Observations", dq["total_detections"], "100.0%"),
            ("Valid Coordinate Coverage", dq["valid_coordinates"], f"{dq['coordinate_completeness_pct']}%"),
            ("Missing Coordinates", dq["missing_coordinates"], f"{round((dq['missing_coordinates'] / dq['total_targets'] * 100), 1) if dq['total_targets'] else 0.0}%"),
            ("Confidence Values Recorded", dq["valid_confidence"], "100.0%"),
            ("Acoustic Shadow Verification Rate", dq["shadow_verified"], f"{kpis['shadow_verified_pct']}%"),
            ("Evidence Imagery Associated", dq["evidence_available"], f"{dq['evidence_completeness_pct']}%"),
            ("Missing Evidence Imagery", dq["missing_evidence"], f"{round((dq['missing_evidence'] / dq['total_targets'] * 100), 1) if dq['total_targets'] else 0.0}%"),
            ("Pending Ground-Truth Reviews", dq["pending_review"], f"{round((dq['pending_review'] / dq['total_targets'] * 100), 1) if dq['total_targets'] else 0.0}%"),
        ]
        for item in dq_rows:
            ws7.append([item[0], item[1], item[2]])

        cls._apply_table_styling(ws7, 1, len(dq_rows) + 1, 1, len(headers_s7))
        cls._auto_column_widths(ws7)

        # =====================================================================
        # SHEET 8: MISSION TIMELINE
        # =====================================================================
        ws8 = wb.create_sheet(title="Mission Timeline")
        ws8.views.sheetView[0].showGridLines = True
        ws8.freeze_panes = "A2"

        headers_s8 = ["Event Stage", "Timestamp (UTC)", "Operational Milestone Description"]
        ws8.append(headers_s8)

        t_items = analysis.get("timeline", [])
        for ti in t_items:
            ws8.append([ti["stage"], str(ti["timestamp"]), ti["description"]])

        cls._apply_table_styling(ws8, 1, max(2, len(t_items) + 1), 1, len(headers_s8))
        cls._auto_column_widths(ws8)

        # =====================================================================
        # SHEET 9: PRIORITY TARGETS
        # =====================================================================
        ws9 = wb.create_sheet(title="Priority Targets")
        ws9.views.sheetView[0].showGridLines = True
        ws9.freeze_panes = "A2"

        headers_s9 = [
            "Rank", "Target ID", "Classification", "Confidence",
            "Acoustic Shadow", "Estimated Size (m)", "Status",
            "Priority Score", "Latitude", "Longitude"
        ]
        ws9.append(headers_s9)

        for t in analysis.get("priority_targets", []):
            ws9.append([
                t["rank"],
                t["target_id"],
                t["label"],
                t["confidence"] / 100.0,
                t["shadow_verified"],
                t["estimated_size_m"],
                t["status"],
                t["priority_score"],
                t["latitude"],
                t["longitude"]
            ])

        cls._apply_table_styling(ws9, 1, max(2, len(analysis.get("priority_targets", [])) + 1), 1, len(headers_s9))
        for row in range(2, len(analysis.get("priority_targets", [])) + 2):
            ws9.cell(row=row, column=4).number_format = "0.0%"
            if ws9.cell(row=row, column=9).value is not None:
                ws9.cell(row=row, column=9).number_format = "0.000000"
                ws9.cell(row=row, column=10).number_format = "0.000000"

        cls._auto_column_widths(ws9)

        # =====================================================================
        # SHEET 10: EVIDENCE INDEX
        # =====================================================================
        ws10 = wb.create_sheet(title="Evidence Index")
        ws10.views.sheetView[0].showGridLines = True
        ws10.freeze_panes = "A2"

        headers_s10 = ["Target ID", "Classification", "Confidence", "Coordinates", "Evidence Reference / URL", "Shadow Verification"]
        ws10.append(headers_s10)

        for t in analysis.get("priority_targets", []):
            coord_str = f"{t['latitude']}, {t['longitude']}" if t['latitude'] is not None else "N/A"
            ws10.append([
                t["target_id"],
                t["label"],
                t["confidence"] / 100.0,
                coord_str,
                t.get("sonar_image_ref") or "No Evidence Image",
                t["shadow_verified"]
            ])

        cls._apply_table_styling(ws10, 1, max(2, len(analysis.get("priority_targets", [])) + 1), 1, len(headers_s10))
        for row in range(2, len(analysis.get("priority_targets", [])) + 2):
            ws10.cell(row=row, column=3).number_format = "0.0%"

        cls._auto_column_widths(ws10)

        # Save workbook to in-memory bytes
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()

excel_report_generator = ExcelReportGenerator()
