from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from mock_data import db_mock
from app.api.websocket import ws_manager
from app.db.repository import repo

router = APIRouter(prefix="/api/detections", tags=["Detections API"])

class ReviewPayload(BaseModel):
    action: Optional[str] = None  # "confirm" | "reject"
    status: Optional[str] = None  # "confirmed" | "rejected"

class CanonicalDetectionInput(BaseModel):
    target_id: Optional[str] = None
    class_name: Optional[str] = Field(default=None, alias="class")
    category: Optional[str] = None
    confidence: Optional[float] = 0.85
    latitude: Optional[float] = 32.6500
    longitude: Optional[float] = -117.5500
    estimated_size_m: Optional[float] = 3.0
    shadow_verified: Optional[bool] = True
    status: Optional[str] = "pending_review"
    timestamp: Optional[str] = None
    sonar_image_ref: Optional[str] = None
    bounding_box: Optional[Dict[str, Any]] = None
    mask_ref: Optional[str] = None
    mission_id: Optional[str] = "MISSION-LIVE"

@router.get("", response_model=List[dict])
def get_detections(
    cls: Optional[str] = Query(None, alias="class"),
    status_filter: Optional[str] = Query(None, alias="status"),
    target_id: Optional[str] = Query(None),
    mission_id: Optional[str] = Query(None)
):
    """
    GET /api/detections — returns list of individual sonar detections/observations directly from PostgreSQL.
    Supports class, status, target_id, and mission_id filtering.
    """
    try:
        return repo.get_all_detections(
            cls_name=cls,
            status=status_filter,
            target_id=target_id,
            mission_id=mission_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot read detections from PostgreSQL: {e}"
        )

@router.get("/targets", response_model=List[dict])
def get_consolidated_targets(
    cls: Optional[str] = Query(None, alias="class"),
    status_filter: Optional[str] = Query(None, alias="status"),
    mission_id: Optional[str] = Query(None)
):
    """
    GET /api/detections/targets — convenience alias returning consolidated physical targets directly from PostgreSQL.
    Enforces strictly ONE target record per physical seafloor object.
    """
    try:
        return repo.get_consolidated_targets(cls_name=cls, status=status_filter, mission_id=mission_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot read consolidated targets from PostgreSQL: {e}"
        )

import os
import json
import time
import uuid

DETECTIONS_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploads", "detections"
)
os.makedirs(DETECTIONS_UPLOAD_DIR, exist_ok=True)

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_detection(request: Request):
    """
    POST /api/detections — Mode A Live ML Stream Ingestion Endpoint.
    Accepts:
    1. multipart/form-data:
       - 'detection': JSON string containing canonical detection fields
       - 'image': PNG/JPG sonar evidence image associated with that detection
    2. application/json:
       - Direct canonical detection JSON object (or array)
    Saves image, associates image URL, persists detection in database, updates target consolidation,
    and broadcasts NEW_DETECTION via WebSocket in real time.
    """
    from app.api.missions import normalize_detection_item, consolidate_target_record
    from app.db.repository import repo, SonarRepository

    content_type = request.headers.get("content-type", "").lower()
    body = {}
    uploaded_image_file = None

    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        raw_detection = form.get("detection")
        uploaded_image_file = form.get("image") or form.get("file") or form.get("evidence")

        if raw_detection and isinstance(raw_detection, str):
            try:
                body = json.loads(raw_detection)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid JSON in 'detection' field: {str(e)}")
        else:
            # Fallback: fields sent as individual form-data key-values
            body = {}
            for k, v in form.items():
                if k not in ["image", "file", "evidence"] and isinstance(v, (str, int, float, bool)):
                    body[k] = v

    else:
        # Standard JSON body
        try:
            body = await request.json()
        except Exception:
            body = {}

    # Support batch list if sent directly to /api/detections
    if isinstance(body, list) or "detections" in body:
        from app.api.ml_integration import ingest_batch_detections
        return await ingest_batch_detections(body)

    if not isinstance(body, dict) or not body:
        raise HTTPException(status_code=400, detail="Missing detection payload. Send 'detection' JSON or form fields.")

    target_id_raw = body.get("target_id") or f"TGT-{db_mock.next_tgt_id:03d}"
    safe_tid = str(target_id_raw).replace("/", "_").replace("\\", "_")
    image_url = None
    image_id = None

    # Handle image upload if provided in multipart form
    if uploaded_image_file and hasattr(uploaded_image_file, "read"):
        img_bytes = await uploaded_image_file.read()
        if len(img_bytes) > 0:
            orig_name = uploaded_image_file.filename or f"{safe_tid}.png"
            ext = os.path.splitext(orig_name)[1].lower()
            if ext not in [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"]:
                ext = ".png"

            ts_token = int(time.time() * 1000)
            saved_filename = f"{safe_tid}_{ts_token}_{uuid.uuid4().hex[:6]}{ext}"
            filepath = os.path.join(DETECTIONS_UPLOAD_DIR, saved_filename)

            with open(filepath, "wb") as f:
                f.write(img_bytes)

            image_url = f"/uploads/detections/{saved_filename}"
            image_id = f"IMG-{safe_tid}-{ts_token}"
            mime_type = "image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png"

            try:
                SonarRepository.save_sonar_image(image_id, saved_filename, mime_type, img_bytes)
            except Exception as e:
                print(f"[DB] Image save warning: {e}")

            body["sonar_image_ref"] = image_url
            body["image_id"] = image_id

    mission_id = body.get("mission_id") or "MISSION-LIVE"
    canonical = normalize_detection_item(body, mission_id=mission_id)
    if image_url:
        canonical["sonar_image_ref"] = image_url
    if image_id:
        canonical["image_id"] = image_id

    # Ensure mission exists in repository & DB
    if not any(m["mission_id"] == mission_id for m in db_mock.missions):
        new_mission = {
            "mission_id": mission_id,
            "survey_name": f"Mission {mission_id} — Live Stream",
            "ingestion_mode": "live",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "detection_count": 0,
            "status": "in_progress"
        }
        try:
            repo.create_or_update_mission(new_mission)
            db_mock.missions.insert(0, new_mission)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Database Offline: Cannot create mission in PostgreSQL. Please start the PostgreSQL service ('sonar_db'). Error: {e}"
            )

    # Persist in PostgreSQL database (mandatory)
    try:
        repo.insert_detection(canonical)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot ingest detection into PostgreSQL. Please start the PostgreSQL service ('sonar_db'). Error: {e}"
        )

    # Store detection in memory cache & consolidate target
    db_mock.detections.insert(0, canonical)
    consolidate_target_record(canonical)

    # Broadcast via WebSocket to all connected dashboards immediately
    await ws_manager.broadcast({
        "type": "NEW_DETECTION",
        "data": canonical
    })

    return {
        "success": True,
        "message": f"Detection '{canonical['target_id']}' ingested successfully in Live Mode.",
        "target_id": canonical["target_id"],
        "image_url": canonical.get("sonar_image_ref"),
        "detection": canonical
    }

@router.get("/{detection_id}")
def get_detection_detail(detection_id: str):
    """GET /api/detections/{id} — single detection detail by ID or target_id directly from PostgreSQL."""
    try:
        d = repo.get_detection(detection_id)
        if not d:
            d = repo.get_target(detection_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot read detection from PostgreSQL: {e}"
        )
    if not d:
        raise HTTPException(status_code=404, detail=f"Detection or Target '{detection_id}' not found")
    return d

@router.post("/{detection_id}/review")
async def review_detection(detection_id: str, review_in: ReviewPayload):
    """
    POST /api/detections/{id}/review — Human-in-the-loop analyst action.
    Accepts {"action": "confirm" | "reject"} or {"status": "confirmed" | "rejected"}.
    Sets canonical status to 'confirmed' or 'rejected'.
    Updates target and all linked observations directly in PostgreSQL and broadcasts via WebSocket.
    """
    action_val = (review_in.action or review_in.status or "").lower().strip()
    if action_val in ["confirm", "confirmed", "verified"]:
        new_status = "confirmed"
    elif action_val in ["reject", "rejected"]:
        new_status = "rejected"
    else:
        raise HTTPException(status_code=400, detail="Review action must be 'confirm' or 'reject'")

    try:
        updated = repo.review_target(detection_id, new_status)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot update review in PostgreSQL: {e}"
        )

    if not updated:
        raise HTTPException(status_code=404, detail=f"Target or detection '{detection_id}' not found")

    target_id = updated.get("target_id") or detection_id
    await ws_manager.broadcast({
        "type": "TARGET_REVIEWED",
        "data": {
            "target_id": target_id,
            "status": new_status
        }
    })

    return updated

@router.delete("", status_code=status.HTTP_200_OK)
@router.delete("/all", status_code=status.HTTP_200_OK)
@router.post("/clear", status_code=status.HTTP_200_OK)
async def clear_all_detections():
    """
    DELETE /api/detections or POST /api/detections/clear
    Purges all detected objects and targets permanently from PostgreSQL database.
    Broadcasts 'ALL_DETECTIONS_CLEARED' event to all connected dashboards via WebSocket.
    """
    try:
        res = repo.clear_all()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot purge database in PostgreSQL: {e}"
        )

    await ws_manager.broadcast({
        "type": "ALL_DETECTIONS_CLEARED",
        "data": {}
    })
    return res

@router.delete("/{detection_id}", status_code=status.HTTP_200_OK)
async def delete_single_detection(detection_id: str):
    """
    DELETE /api/detections/{detection_id}
    Deletes a single target or detection record permanently from PostgreSQL database.
    """
    try:
        deleted = repo.delete_target(detection_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot delete detection from PostgreSQL: {e}"
        )

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Detection or Target '{detection_id}' not found")

    await ws_manager.broadcast({
        "type": "TARGET_DELETED",
        "data": {"target_id": detection_id}
    })
    return {"message": f"Detection or Target '{detection_id}' deleted successfully", "target_id": detection_id}

@router.post("/reset", status_code=status.HTTP_410_GONE)
async def reset_detections():
    """Demo reset endpoint permanently disabled in production."""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Demo reset endpoint has been removed. The system operates strictly with real data in PostgreSQL."
    )
