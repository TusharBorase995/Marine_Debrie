import csv
import io
import json
from fastapi import APIRouter, Query, Response, HTTPException, status
from app.db.repository import repo

router = APIRouter(prefix="/api/reports", tags=["Reports API"])

@router.get("/export")
def export_reports(
    format: str = Query("json", description="Export format: 'json' or 'csv'"),
    dataset: str = Query("targets", description="Dataset type: 'targets' or 'detections'")
):
    """
    GET /api/reports/export?format=json|csv&dataset=targets|detections
    Generates downloadable report containing target detections directly from PostgreSQL.
    """
    try:
        if dataset.lower() == "detections":
            items = repo.get_all_detections()
        else:
            items = repo.get_consolidated_targets()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot export reports from PostgreSQL: {e}"
        )

    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Target ID", "Classification", "Confidence (%)", "Latitude", "Longitude",
            "Estimated Size (m)", "Shadow Verified", "Status", "Timestamp",
            "Sonar Image Ref", "Observations Count", "Bounding Box"
        ])
        for item in items:
            tid = item.get("target_id", item.get("id"))
            cls = item.get("class", item.get("category", ""))
            conf = item.get("fused_confidence", item.get("confidence", 0))
            conf_str = f"{round(float(conf) * 100)}%" if conf is not None else "N/A"
            lat = item.get("latitude")
            lon = item.get("longitude")
            size = item.get("estimated_size_m", "")
            shadow = item.get("shadow_verified", True)
            stat = item.get("status", item.get("human_review_status", "pending_review"))
            ts = item.get("timestamp", "")
            img = item.get("sonar_image_ref", "")
            obs_count = item.get("observation_count", len(item.get("observations", [])) or 1)
            bbox = json.dumps(item.get("bounding_box")) if item.get("bounding_box") else ""

            writer.writerow([
                tid, cls, conf_str, lat, lon, size, shadow, stat, ts, img, obs_count, bbox
            ])
        filename = f"marine_debris_{dataset}.csv"
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    # JSON export
    json_str = json.dumps(items, indent=2)
    filename = f"marine_debris_{dataset}.json"
    return Response(
        content=json_str,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
