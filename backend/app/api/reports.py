from typing import Optional
from fastapi import APIRouter, Query, Response, HTTPException, status
from app.db.repository import repo
from app.services.report_analysis_service import report_analysis_service
from app.services.pdf_report_generator import pdf_report_generator
from app.services.excel_report_generator import excel_report_generator
from mock_data import db_mock

router = APIRouter(prefix="/api/reports", tags=["Reports API"])

@router.get("/analysis")
def get_reports_analysis(mission_id: Optional[str] = Query(None, description="Optional mission filter")):
    """
    GET /api/reports/analysis?mission_id=...
    Returns calculated statistical analysis for dashboard live preview.
    """
    try:
        if mission_id and mission_id != "ALL":
            mission = repo.get_mission(mission_id) or db_mock.get_mission(mission_id) or {
                "mission_id": mission_id, "survey_name": f"Survey {mission_id}", "status": "completed"
            }
            targets = repo.get_consolidated_targets(mission_id=mission_id)
            detections = repo.get_all_detections(mission_id=mission_id)
        else:
            missions = repo.get_all_missions()
            mission = missions[0] if missions else {
                "mission_id": "MISSION-CONSOLIDATED", "survey_name": "Consolidated Survey Register", "status": "completed"
            }
            targets = repo.get_consolidated_targets()
            detections = repo.get_all_detections()

        # Fallback to in-memory if empty
        if not targets and not detections and mission_id:
            targets = [t for t in db_mock.targets if t.get("mission_id") == mission_id]
            detections = db_mock.get_mission_detections(mission_id)

        return report_analysis_service.analyze_mission(mission, targets, detections)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report analysis: {str(e)}"
        )

@router.get("/export")
def export_reports(
    format: str = Query("pdf", description="Export format: 'pdf' or 'excel'"),
    mission_id: Optional[str] = Query(None, description="Optional mission identifier")
):
    """
    GET /api/reports/export?format=pdf|excel&mission_id=...
    Generates unified operational mission report in PDF or multi-sheet Excel format.
    """
    try:
        if mission_id and mission_id != "ALL":
            mission = repo.get_mission(mission_id) or db_mock.get_mission(mission_id) or {
                "mission_id": mission_id, "survey_name": f"Survey {mission_id}", "status": "completed"
            }
            targets = repo.get_consolidated_targets(mission_id=mission_id)
            detections = repo.get_all_detections(mission_id=mission_id)
        else:
            missions = repo.get_all_missions()
            mission = missions[0] if missions else {
                "mission_id": "MISSION-CONSOLIDATED", "survey_name": "Consolidated Survey Register", "status": "completed"
            }
            targets = repo.get_consolidated_targets()
            detections = repo.get_all_detections()

        # Fallback to in-memory if empty
        if not targets and not detections and mission_id:
            targets = [t for t in db_mock.targets if t.get("mission_id") == mission_id]
            detections = db_mock.get_mission_detections(mission_id)

        analysis = report_analysis_service.analyze_mission(mission, targets, detections)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot export reports: {e}"
        )

    fmt = (format or "").lower().strip()
    raw_title = mission.get("survey_name") or mission_id
    clean_title = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in str(raw_title).replace("—", "-").replace("–", "-").replace(" ", "_")).strip("_") or mission_id

    if fmt == "pdf":
        try:
            pdf_bytes = pdf_report_generator.generate_pdf(analysis)
            filename = f"{clean_title}_Operational_Report.pdf"
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "Access-Control-Expose-Headers": "Content-Disposition"
                }
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate PDF report: {str(e)}"
            )

    elif fmt in ["excel", "xlsx"]:
        try:
            excel_bytes = excel_report_generator.generate_excel(analysis, detections=detections)
            filename = f"{clean_title}_Operational_Report.xlsx"
            return Response(
                content=excel_bytes,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "Access-Control-Expose-Headers": "Content-Disposition"
                }
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate Excel report: {str(e)}"
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid export format '{format}'. Supported formats are 'pdf' and 'excel'."
        )

