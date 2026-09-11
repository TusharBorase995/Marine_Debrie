import os
import io
import csv
import json
import zipfile
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, UploadFile, File, Request, Query, Response, Header, status
from pydantic import BaseModel, Field

from mock_data import db_mock
from app.services.image_service import image_service
from app.api.websocket import ws_manager

router = APIRouter(prefix="/api/missions", tags=["Mission Management API"])

class MissionCreatePayload(BaseModel):
    mission_id: Optional[str] = None
    survey_name: str = "Offshore Hydrographic Survey"
    description: Optional[str] = "Acoustic side-scan sonar hydrographic survey"
    ingestion_mode: str = Field(default="batch", description="'live' or 'batch'")
    created_at: Optional[str] = None
    status: Optional[str] = "in_progress"

def normalize_detection_item(item: dict, mission_id: str, default_image_ref: Optional[str] = None) -> dict:
    """Normalizes arbitrary raw detection dictionary into canonical Detection schema."""
    target_id = item.get("target_id") or f"TGT-{db_mock.next_tgt_id:03d}"
    cls = item.get("class") or item.get("category") or "debris_net"
    try:
        conf = float(item.get("confidence", 0.85))
    except (ValueError, TypeError):
        conf = 0.85

    raw_lat = item.get("latitude")
    lat = float(raw_lat) if raw_lat is not None else None

    raw_lon = item.get("longitude")
    lon = float(raw_lon) if raw_lon is not None else None

    try:
        size = float(item.get("estimated_size_m", 3.0))
    except (ValueError, TypeError):
        size = 3.0

    raw_status = str(item.get("status") or item.get("human_review_status") or "pending_review").lower().strip()
    if raw_status in ["confirmed", "verified"]:
        stat = "confirmed"
    elif raw_status == "rejected":
        stat = "rejected"
    else:
        stat = "pending_review"

    raw_img = item.get("sonar_image_ref") or default_image_ref
    evidence_img = image_service.resolve_image_ref(raw_img, target_id=target_id, target_class=cls)

    ts = item.get("timestamp") or datetime.now(timezone.utc).isoformat()
    db_mock.next_det_id += 1
    det_id = item.get("id") or item.get("observation_id") or f"det_{db_mock.next_det_id}"

    label_map = {
        "debris_net": "Debris Net",
        "pipe_cylinder": "Pipeline / Cylinder",
        "pipeline": "Subsea Pipeline",
        "cylinder": "Submerged Cylinder",
        "wreck_structure": "Shipwreck Structure",
        "shipwreck": "Shipwreck Structure",
        "cargo_container": "Cargo Container",
        "container": "Cargo Container",
        "naval_mine": "Acoustic Mine Hazard",
        "mine": "Acoustic Mine Hazard",
        "pipe_joint": "Pipeline Free-Span & Joint"
    }
    label = label_map.get(cls.lower(), cls.replace("_", " ").title())

    canonical = {
        "id": det_id,
        "target_id": target_id,
        "class": cls,
        "category": cls,  # Alias for compatibility
        "target_label": label,
        "confidence": round(conf, 2),
        "latitude": round(lat, 6),
        "longitude": round(lon, 6),
        "estimated_size_m": round(size, 1),
        "shadow_verified": bool(item.get("shadow_verified", True)),
        "status": stat,
        "human_review_status": stat,
        "timestamp": ts,
        "sonar_image_ref": evidence_img,
        "bounding_box": json.loads(raw_bbox) if isinstance(raw_bbox := item.get("bounding_box"), str) and raw_bbox.strip().startswith(("{", "[")) else item.get("bounding_box"),
        "segmentation": json.loads(raw_seg) if isinstance(raw_seg := item.get("segmentation"), str) and raw_seg.strip().startswith(("{", "[")) else item.get("segmentation"),
        "mask_ref": item.get("mask_ref"),
        "mission_id": mission_id,
        "pass_number": item.get("pass_number", 1),
        "survey_leg": item.get("survey_leg", f"{mission_id} Survey Run")
    }
    return canonical

def consolidate_target_record(canonical: dict):
    """Consolidates or updates a physical target in the database repository."""
    target_id = canonical["target_id"]
    existing_tgt = next((t for t in db_mock.targets if t["target_id"] == target_id), None)
    
    if existing_tgt:
        # Avoid duplicate observations
        if not any(o.get("id") == canonical["id"] for o in existing_tgt.get("observations", [])):
            existing_tgt["observations"].append(canonical)
        existing_tgt["observation_count"] = len(existing_tgt["observations"])
        
        # Fused multi-pass confidence
        obs_confs = [d.get("confidence", 0.85) for d in existing_tgt["observations"]]
        fused_conf = round(max(obs_confs) * 0.75 + (sum(obs_confs) / len(obs_confs)) * 0.25, 2)
        existing_tgt["confidence"] = fused_conf
        existing_tgt["fused_confidence"] = fused_conf
        
        # Centroid coordinates
        existing_tgt["latitude"] = round(sum(d["latitude"] for d in existing_tgt["observations"]) / len(existing_tgt["observations"]), 6)
        existing_tgt["longitude"] = round(sum(d["longitude"] for d in existing_tgt["observations"]) / len(existing_tgt["observations"]), 6)
        existing_tgt["sonar_image_ref"] = canonical["sonar_image_ref"]
        if canonical.get("bounding_box"):
            existing_tgt["bounding_box"] = canonical["bounding_box"]
        if canonical.get("segmentation"):
            existing_tgt["segmentation"] = canonical["segmentation"]
        if canonical.get("mask_ref"):
            existing_tgt["mask_ref"] = canonical["mask_ref"]
    else:
        new_tgt = {
            "target_id": target_id,
            "id": target_id,
            "class": canonical["class"],
            "category": canonical["class"],
            "label": canonical["target_label"],
            "latitude": canonical["latitude"],
            "longitude": canonical["longitude"],
            "estimated_size_m": canonical["estimated_size_m"],
            "status": canonical["status"],
            "human_review_status": canonical["status"],
            "confidence": canonical["confidence"],
            "fused_confidence": canonical["confidence"],
            "observation_count": 1,
            "sonar_image_ref": canonical["sonar_image_ref"],
            "bounding_box": canonical.get("bounding_box"),
            "segmentation": canonical.get("segmentation"),
            "mask_ref": canonical.get("mask_ref"),
            "mission_id": canonical["mission_id"],
            "observations": [canonical]
        }
        db_mock.targets.append(new_tgt)

@router.get("", response_model=List[dict])
def get_missions(x_user_id: Optional[str] = Header(None, alias="x-user-id")):
    """GET /api/missions — List all missions with live computed summary metrics directly from PostgreSQL."""
    try:
        from app.db.repository import repo
        return repo.get_all_missions(user_id=x_user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot load missions from PostgreSQL: {e}"
        )

@router.get("/active")
def get_active_mission(x_user_id: Optional[str] = Header(None, alias="x-user-id")):
    """GET /api/missions/active — Returns the currently active survey mission from PostgreSQL."""
    from app.db.repository import repo
    try:
        active = repo.get_active_mission(user_id=x_user_id)
        return {"active_mission": active}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot read active mission from PostgreSQL: {e}"
        )

@router.post("/deactivate")
async def deactivate_missions(x_user_id: Optional[str] = Header(None, alias="x-user-id")):
    """POST /api/missions/deactivate — Clears active mission selection."""
    from app.db.repository import repo
    try:
        repo.deactivate_all_missions(user_id=x_user_id)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {e}")
    await ws_manager.broadcast({
        "type": "MISSION_DEACTIVATED",
        "data": {}
    })
    return {"success": True, "message": "All missions deactivated"}

@router.post("/{mission_id}/active")
async def set_active_mission(mission_id: str, x_user_id: Optional[str] = Header(None, alias="x-user-id")):
    """POST /api/missions/{mission_id}/active — Sets the specified mission as active in PostgreSQL."""
    from app.db.repository import repo
    try:
        updated = repo.set_active_mission(mission_id, user_id=x_user_id)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {e}")
    if not updated:
        raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found")
    await ws_manager.broadcast({
        "type": "MISSION_ACTIVATED",
        "data": {"mission_id": mission_id, "mission": updated}
    })
    return {"success": True, "active_mission": updated}

@router.post("", status_code=status.HTTP_201_CREATED)
def create_mission(payload: MissionCreatePayload, x_user_id: Optional[str] = Header(None, alias="x-user-id")):
    """POST /api/missions — Register a new mission record directly in PostgreSQL."""
    from app.db.repository import repo
    m_id = payload.mission_id or repo.generate_next_mission_id()
    mission_record = {
        "mission_id": m_id,
        "user_id": x_user_id,
        "survey_name": payload.survey_name or f"Survey Mission {m_id.split('-')[-1]}",
        "description": payload.description or "Acoustic side-scan sonar hydrographic survey",
        "ingestion_mode": payload.ingestion_mode,
        "created_at": payload.created_at or datetime.now(timezone.utc).isoformat(),
        "detection_count": 0,
        "status": payload.status or ("in_progress" if payload.ingestion_mode == "live" else "completed"),
        "is_active": True
    }
    try:
        created = repo.create_or_update_mission(mission_record, user_id=x_user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: PostgreSQL is not active or unreachable. Please start your PostgreSQL service ('sonar_db') to save missions permanently. Error: {e}"
        )
    return created

@router.delete("/{mission_id}", status_code=status.HTTP_200_OK)
async def delete_mission(mission_id: str, x_user_id: Optional[str] = Header(None, alias="x-user-id")):
    """DELETE /api/missions/{mission_id} — Delete mission and its cascaded targets from PostgreSQL permanently."""
    from app.db.repository import repo
    try:
        m = repo.get_mission(mission_id, user_id=x_user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot access PostgreSQL: {e}"
        )
    if not m:
        raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found")
    try:
        repo.delete_mission(mission_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: PostgreSQL is not active or unreachable. Please start your PostgreSQL service ('sonar_db') to delete missions. Error: {e}"
        )
    await ws_manager.broadcast({
        "type": "MISSION_DELETED",
        "data": {"mission_id": mission_id}
    })
    return {"message": f"Mission '{mission_id}' deleted successfully", "mission_id": mission_id}

@router.get("/{mission_id}")
def get_mission_detail(mission_id: str, x_user_id: Optional[str] = Header(None, alias="x-user-id")):
    """GET /api/missions/{mission_id} — Single mission metadata directly from PostgreSQL."""
    from app.db.repository import repo
    try:
        m = repo.get_mission(mission_id, user_id=x_user_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot read mission from PostgreSQL: {e}"
        )
    if not m:
        raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found")
    return m

@router.get("/{mission_id}/detections", response_model=List[dict])
def get_mission_detections(mission_id: str):
    """GET /api/missions/{mission_id}/detections — List canonical detections for a mission directly from PostgreSQL."""
    from app.db.repository import repo
    try:
        m = repo.get_mission(mission_id)
        if not m:
            raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found")
        return repo.get_all_detections(mission_id=mission_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot read detections from PostgreSQL: {e}"
        )

@router.post("/{mission_id}/import", status_code=status.HTTP_201_CREATED)
async def import_mission_batch(
    mission_id: str,
    request: Request,
    file: Optional[UploadFile] = File(None)
):
    """
    POST /api/missions/{mission_id}/import — Mission Batch Import Endpoint.
    Accepts:
    1. ZIP archive containing detections.json + images/
    2. JSON file upload (.json)
    3. Direct JSON payload body
    Validates, extracts sonar evidence images, normalizes into canonical Detection objects,
    and stores them under the unified data model.
    """
    survey_name = f"Survey {mission_id}"
    created_at = datetime.now(timezone.utc).isoformat()
    raw_detections: List[dict] = []

    top_image_ref = None

    if file:
        content = await file.read()
        filename_lower = file.filename.lower()

        if filename_lower.endswith(".zip"):
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as z:
                    # 1. First extract all images in archive
                    for zip_info in z.infolist():
                        if zip_info.is_dir():
                            continue
                        name_lower = zip_info.filename.lower()
                        if any(name_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"]):
                            img_data = z.read(zip_info.filename)
                            image_service.save_binary_image(img_data, os.path.basename(zip_info.filename))

                    # 2. Locate and parse detections.json
                    json_file_name = next(
                        (f for f in z.namelist() if f.lower().endswith("detections.json") or f.lower().endswith(".json")),
                        None
                    )
                    if not json_file_name:
                        raise HTTPException(status_code=400, detail="ZIP package missing 'detections.json'")

                    json_bytes = z.read(json_file_name)
                    parsed_json = json.loads(json_bytes.decode("utf-8"))
                    
                    if isinstance(parsed_json, dict):
                        survey_name = parsed_json.get("survey_name", survey_name)
                        created_at = parsed_json.get("created_at", created_at)
                        raw_detections = parsed_json.get("detections", [])
                        top_image_ref = parsed_json.get("sonar_image_ref")
                    elif isinstance(parsed_json, list):
                        raw_detections = parsed_json

            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to process ZIP package: {str(e)}")

        elif filename_lower.endswith(".json"):
            try:
                parsed_json = json.loads(content.decode("utf-8"))
                if isinstance(parsed_json, dict):
                    survey_name = parsed_json.get("survey_name", survey_name)
                    created_at = parsed_json.get("created_at", created_at)
                    raw_detections = parsed_json.get("detections", [])
                    top_image_ref = parsed_json.get("sonar_image_ref")
                elif isinstance(parsed_json, list):
                    raw_detections = parsed_json
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="File must be .zip package or .json file")

    else:
        # Fallback: check if JSON body was sent
        try:
            body = await request.json()
            if isinstance(body, dict):
                survey_name = body.get("survey_name", survey_name)
                created_at = body.get("created_at", created_at)
                raw_detections = body.get("detections", [])
                top_image_ref = body.get("sonar_image_ref")
            elif isinstance(body, list):
                raw_detections = body
        except Exception:
            raise HTTPException(status_code=400, detail="Must provide a file (.zip/.json) or JSON body")

    if not isinstance(raw_detections, list) or len(raw_detections) == 0:
        raise HTTPException(status_code=400, detail="No detection items found in import payload.")

    canonical_list = []
    # Persist batch detections and mission to PostgreSQL database (mandatory)
    try:
        from app.db.repository import repo
        for item in raw_detections:
            canonical = normalize_detection_item(item, mission_id, default_image_ref=top_image_ref)
            repo.insert_detection(canonical)
            db_mock.detections.insert(0, canonical)
            consolidate_target_record(canonical)
            canonical_list.append(canonical)

        mission_record = {
            "mission_id": mission_id,
            "survey_name": survey_name,
            "ingestion_mode": "batch",
            "created_at": created_at,
            "detection_count": len(canonical_list),
            "status": "completed"
        }
        repo.create_or_update_mission(mission_record)
        db_mock.add_mission(mission_record)
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot import batch package to PostgreSQL. Please start the PostgreSQL service ('sonar_db'). Error: {ex}"
        )

    # Broadcast batch loaded event over WebSocket
    await ws_manager.broadcast({
        "type": "MISSION_IMPORTED",
        "data": {
            "mission_id": mission_id,
            "survey_name": survey_name,
            "count": len(canonical_list)
        }
    })

    return {
        "success": True,
        "message": f"Successfully imported mission '{mission_id}' with {len(canonical_list)} detections.",
        "mission": db_mock.get_mission(mission_id),
        "count": len(canonical_list),
        "detections": canonical_list
    }

@router.get("/{mission_id}/analysis")
def get_mission_analysis(mission_id: str):
    """
    GET /api/missions/{mission_id}/analysis
    Returns the unified, deterministic statistical report analysis for live preview in the dashboard.
    """
    from app.db.repository import repo
    from app.services.report_analysis_service import report_analysis_service

    mission = repo.get_mission(mission_id) or db_mock.get_mission(mission_id)
    if not mission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Mission '{mission_id}' not found")

    targets = repo.get_consolidated_targets(mission_id=mission_id)
    detections = repo.get_all_detections(mission_id=mission_id)

    # Fallback to in-memory if empty
    if not targets and not detections:
        targets = [t for t in db_mock.targets if t.get("mission_id") == mission_id]
        detections = db_mock.get_mission_detections(mission_id)

    return report_analysis_service.analyze_mission(mission, targets, detections)


@router.get("/{mission_id}/export")
def export_mission(
    mission_id: str,
    format: str = Query("pdf", description="Export format: 'pdf' or 'excel'")
):
    """
    GET /api/missions/{mission_id}/export?format=pdf|excel
    Generates professional operational mission reports (PDF or multi-sheet Excel).
    """
    from app.db.repository import repo
    from app.services.report_analysis_service import report_analysis_service
    from app.services.pdf_report_generator import pdf_report_generator
    from app.services.excel_report_generator import excel_report_generator

    mission = repo.get_mission(mission_id) or db_mock.get_mission(mission_id)
    if not mission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Mission '{mission_id}' not found")

    targets = repo.get_consolidated_targets(mission_id=mission_id)
    detections = repo.get_all_detections(mission_id=mission_id)

    # Fallback to in-memory if empty
    if not targets and not detections:
        targets = [t for t in db_mock.targets if t.get("mission_id") == mission_id]
        detections = db_mock.get_mission_detections(mission_id)

    # Single source of truth calculation
    analysis = report_analysis_service.analyze_mission(mission, targets, detections)

    fmt = (format or "").lower().strip()
    raw_name = mission.get("survey_name") or mission_id
    clean_mission_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in str(raw_name).replace("—", "-").replace("–", "-").replace(" ", "_")).strip("_") or mission_id

    if fmt == "pdf":
        try:
            pdf_bytes = pdf_report_generator.generate_pdf(analysis)
            filename = f"{clean_mission_name}_Operational_Report.pdf"
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
            filename = f"{clean_mission_name}_Operational_Report.xlsx"
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

    elif fmt == "json":
        import json
        payload = {
            "mission": mission,
            "targets": targets,
            "detections": detections,
            "analysis": analysis
        }
        filename = f"{clean_mission_name}_Operational_Report.json"
        return Response(
            content=json.dumps(payload, indent=2, default=str),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    elif fmt == "csv":
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Target ID", "Class", "Confidence", "Latitude", "Longitude", "Size (m)", "Status", "Sonar Image Ref"])
        for det in detections:
            writer.writerow([
                det.get("target_id") or det.get("id", ""),
                det.get("class") or det.get("category", ""),
                det.get("confidence", ""),
                det.get("latitude", ""),
                det.get("longitude", ""),
                det.get("estimated_size_m", ""),
                det.get("status", ""),
                det.get("sonar_image_ref", "")
            ])
        filename = f"{clean_mission_name}_Operational_Report.csv"
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid export format '{format}'. Supported formats are 'pdf', 'excel', 'csv', and 'json'."
        )

