from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field, field_validator, ConfigDict
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status

from mock_data import db_mock
from app.services.image_service import image_service
from app.api.websocket import ws_manager

router = APIRouter(prefix="/api/ml", tags=["ML Detection Integration API"])

class CanonicalDetectionPayload(BaseModel):
    """
    Canonical ML Detection Input Contract (PS 26057).
    This represents the agreed integration boundary between the ML system and application layer.
    """
    model_config = ConfigDict(populate_by_name=True)

    target_id: str = Field(..., description="Unique physical target ID (e.g. TGT-023)")
    class_name: str = Field(..., alias="class", description="Target classification (e.g. debris_net, pipe_cylinder, wreck_structure)")
    confidence: float = Field(..., description="Classification confidence between 0.0 and 1.0")
    latitude: Optional[float] = Field(default=None, description="WGS84 latitude coordinate")
    longitude: Optional[float] = Field(default=None, description="WGS84 longitude coordinate")
    estimated_size_m: float = Field(..., description="Physical object dimension in meters")
    shadow_verified: bool = Field(default=True, description="U-Net acoustic shadow verification status")
    status: str = Field(default="pending_review", description="Review status (pending_review, verified, rejected)")
    timestamp: Optional[str] = Field(default=None, description="ISO-8601 UTC timestamp")
    sonar_image_ref: Optional[str] = Field(default=None, description="Path or URL to detected sonar evidence image")
    bounding_box: Optional[Dict[str, Any]] = Field(default=None, description="Optional bounding box coordinates {x, y, width, height}")
    segmentation: Optional[List[List[Union[float, int]]]] = Field(default=None, description="Polygon points [[x, y], ...]")
    mask_ref: Optional[str] = Field(default=None, description="Optional segmentation mask reference")

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v):
        try:
            val = float(v)
            return max(0.0, min(1.0, val))
        except (ValueError, TypeError):
            return 0.85

    @field_validator("status")
    @classmethod
    def normalize_status(cls, v):
        if not v:
            return "pending_review"
        v_clean = v.lower().strip()
        if v_clean in ["verified", "confirmed"]:
            return "confirmed"
        if v_clean == "rejected":
            return "rejected"
        return "pending_review"

class FrameDetectionsPayload(BaseModel):
    """
    Combined Sonar Frame Detection Payload.
    Allows submitting a single sonar frame image reference with multiple detected targets.
    """
    model_config = ConfigDict(populate_by_name=True)

    sonar_image_ref: str = Field(..., description="Full sonar frame image reference (e.g. survey_042_frame_0187.png)")
    mission_id: Optional[str] = Field(default=None, description="Target survey mission ID")
    timestamp: Optional[str] = Field(default=None, description="ISO-8601 UTC timestamp")
    detections: List[CanonicalDetectionPayload] = Field(..., description="List of target detections in this frame")


async def _process_single_canonical_detection(payload: CanonicalDetectionPayload, mission_id: Optional[str] = None) -> Dict[str, Any]:
    """Internal helper to process, persist, and broadcast a single CanonicalDetectionPayload."""
    from app.db.repository import repo
    resolved_mission_id = repo.resolve_target_mission(mission_id, ingestion_mode="live")
    ts = payload.timestamp or datetime.now(timezone.utc).isoformat()
    
    # Resolve and normalize sonar evidence image reference
    evidence_image = image_service.resolve_image_ref(
        payload.sonar_image_ref,
        target_id=payload.target_id,
        target_class=payload.class_name
    )

    det_id = f"det_{db_mock.next_det_id + 1}"
    db_mock.next_det_id += 1

    # Map human-readable label
    label_map = {
        "debris_net": "Derelict Ghost Fishing Net",
        "pipe_cylinder": "Submerged Pipeline Segment",
        "wreck_structure": "Historic Shipwreck Structure",
        "cargo_container": "Submerged Cargo Container",
        "naval_mine": "Acoustic Mine Anomaly",
        "pipe_joint": "Pipeline Free-Span & Joint",
        "concrete_block": "Submerged Concrete Block",
        "tire": "Acoustic Tire Hazard"
    }
    label = label_map.get(payload.class_name.lower(), payload.class_name.replace("_", " ").title())

    record = {
        "id": det_id,
        "target_id": payload.target_id,
        "target_label": label,
        "class": payload.class_name,
        "category": payload.class_name,
        "confidence": round(payload.confidence, 2),
        "latitude": round(payload.latitude, 6) if payload.latitude is not None else None,
        "longitude": round(payload.longitude, 6) if payload.longitude is not None else None,
        "estimated_size_m": round(payload.estimated_size_m, 1),
        "shadow_verified": payload.shadow_verified,
        "status": payload.status,
        "human_review_status": payload.status,
        "timestamp": ts,
        "sonar_image_ref": evidence_image,
        "bounding_box": payload.bounding_box,
        "segmentation": payload.segmentation,
        "mask_ref": payload.mask_ref,
        "mission_id": resolved_mission_id,
        "pass_number": 1,
        "survey_leg": "ML Real-Time Stream"
    }

    # Store detection in repository
    db_mock.detections.insert(0, record)

    # Consolidate target: if target_id already exists, associate observation pass
    existing_tgt = next((t for t in db_mock.targets if t["target_id"] == payload.target_id), None)
    if existing_tgt:
        existing_tgt["observations"].append(record)
        existing_tgt["observation_count"] = len(existing_tgt["observations"])
        existing_tgt["fused_confidence"] = round(
            max(d["confidence"] for d in existing_tgt["observations"]) * 0.75 +
            (sum(d["confidence"] for d in existing_tgt["observations"]) / len(existing_tgt["observations"])) * 0.25,
            2
        )
        # Refine physical target canonical coordinates to centroid of all passes with coordinates
        valid_lats = [d["latitude"] for d in existing_tgt["observations"] if d.get("latitude") is not None]
        valid_lons = [d["longitude"] for d in existing_tgt["observations"] if d.get("longitude") is not None]
        existing_tgt["latitude"] = round(sum(valid_lats) / len(valid_lats), 6) if valid_lats else None
        existing_tgt["longitude"] = round(sum(valid_lons) / len(valid_lons), 6) if valid_lons else None
        existing_tgt["sonar_image_ref"] = evidence_image
        if payload.bounding_box:
            existing_tgt["bounding_box"] = payload.bounding_box
        if payload.segmentation:
            existing_tgt["segmentation"] = payload.segmentation
        if payload.mask_ref:
            existing_tgt["mask_ref"] = payload.mask_ref
    else:
        new_tgt = {
            "target_id": payload.target_id,
            "id": payload.target_id,
            "class": payload.class_name,
            "category": payload.class_name,
            "label": label,
            "latitude": round(payload.latitude, 6) if payload.latitude is not None else None,
            "longitude": round(payload.longitude, 6) if payload.longitude is not None else None,
            "estimated_size_m": round(payload.estimated_size_m, 1),
            "status": payload.status,
            "human_review_status": payload.status,
            "confidence": round(payload.confidence, 2),
            "fused_confidence": round(payload.confidence, 2),
            "observation_count": 1,
            "sonar_image_ref": evidence_image,
            "bounding_box": payload.bounding_box,
            "segmentation": payload.segmentation,
            "mask_ref": payload.mask_ref,
            "mission_id": resolved_mission_id,
            "observations": [record]
        }
        db_mock.targets.append(new_tgt)

    # Store detection in persistent PostgreSQL DB (mandatory)
    from app.db.repository import repo
    try:
        repo.insert_detection(record)
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot save ML detection in PostgreSQL. Please start the PostgreSQL service ('sonar_db'). Error: {ex}"
        )

    # Real-time WebSocket broadcast to all connected dashboards
    await ws_manager.broadcast({
        "type": "NEW_DETECTION",
        "data": record
    })

    return {
        "success": True,
        "message": f"ML detection '{payload.target_id}' ingested successfully.",
        "target_id": payload.target_id,
        "image_url": record.get("sonar_image_ref"),
        "detection": record
    }


@router.post("/detections", status_code=status.HTTP_201_CREATED)
async def ingest_ml_detection(payload: Union[FrameDetectionsPayload, CanonicalDetectionPayload]):
    """
    POST /api/ml/detections — Primary ML System Ingestion Endpoint.
    Accepts:
    1. Single target detection (CanonicalDetectionPayload)
    2. Combined sonar frame with multiple detections (FrameDetectionsPayload)
    Validates, stores, resolves evidence image, and broadcasts via WebSocket to connected dashboards.
    """
    if isinstance(payload, FrameDetectionsPayload):
        from app.db.repository import repo
        target_mission = repo.resolve_target_mission(payload.mission_id, ingestion_mode="live")
        results = []
        for det in payload.detections:
            if not det.sonar_image_ref and payload.sonar_image_ref:
                det.sonar_image_ref = payload.sonar_image_ref
            res = await _process_single_canonical_detection(det, mission_id=target_mission)
            results.append(res["detection"])
        return {
            "success": True,
            "message": f"Successfully ingested {len(results)} detections for frame '{payload.sonar_image_ref}'.",
            "count": len(results),
            "mission_id": target_mission,
            "sonar_image_ref": payload.sonar_image_ref,
            "detections": results
        }

    return await _process_single_canonical_detection(payload)

@router.post("/upload-evidence", status_code=status.HTTP_201_CREATED)
async def upload_sonar_evidence_image(
    file: UploadFile = File(...),
    target_id: Optional[str] = Form(None)
):
    """
    POST /api/ml/upload-evidence — Uploads raw or cropped sonar evidence image accompanying detection.
    Returns the public image reference URL.
    """
    image_url = await image_service.save_uploaded_image(file, target_id=target_id)
    return {
        "success": True,
        "sonar_image_ref": image_url
    }

@router.post("/detection-with-image", status_code=status.HTTP_201_CREATED)
async def ingest_detection_with_image(
    target_id: str = Form(...),
    class_name: str = Form(..., alias="class"),
    confidence: float = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    estimated_size_m: float = Form(...),
    shadow_verified: bool = Form(True),
    status_str: str = Form("pending_review", alias="status"),
    timestamp: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """
    POST /api/ml/detection-with-image — Multipart endpoint allowing image binary upload + JSON metadata together.
    """
    image_url = None
    if file:
        image_url = await image_service.save_uploaded_image(file, target_id=target_id)

    payload = CanonicalDetectionPayload(
        target_id=target_id,
        class_name=class_name,
        confidence=confidence,
        latitude=latitude,
        longitude=longitude,
        estimated_size_m=estimated_size_m,
        shadow_verified=shadow_verified,
        status=status_str,
        timestamp=timestamp,
        sonar_image_ref=image_url
    )
    return await ingest_ml_detection(payload)

@router.post("/simulate", status_code=status.HTTP_400_BAD_REQUEST)
async def simulate_ml_detection():
    """
    Mock detection simulation has been removed per PS 26057 specification.
    """
    raise HTTPException(
        status_code=400,
        detail="Mock detection simulation has been removed. Ingest real ML detections via POST /api/detections with multipart/form-data or JSON."
    )

@router.post("/batch", status_code=status.HTTP_201_CREATED)
async def ingest_batch_detections(payload: Dict[str, Any]):
    """
    POST /api/ml/batch — Ingests a batch JSON containing an array of detection objects.
    Accepts format:
    {
      "survey_id": "SURV-001",
      "detections": [ { ... }, { ... } ]
    }
    or direct list: [ { ... }, { ... } ]
    """
    det_list = payload.get("detections") if isinstance(payload, dict) and "detections" in payload else (payload if isinstance(payload, list) else [])
    if not isinstance(det_list, list) or len(det_list) == 0:
        raise HTTPException(status_code=400, detail="Payload must contain a non-empty 'detections' array.")

    top_level_image = payload.get("sonar_image_ref") if isinstance(payload, dict) else None
    from app.db.repository import repo
    specified_mission = (payload.get("mission_id") or payload.get("survey_id")) if isinstance(payload, dict) else None
    default_mission = repo.resolve_target_mission(specified_mission, ingestion_mode="batch")
    results = []
    for item in det_list:
        try:
            raw_lat = item.get("latitude")
            raw_lon = item.get("longitude")
            canonical = CanonicalDetectionPayload(
                target_id=item.get("target_id") or f"TGT-{db_mock.next_tgt_id:03d}",
                class_name=item.get("class") or item.get("class_name") or "debris_net",
                confidence=float(item.get("confidence", 0.85)),
                latitude=float(raw_lat) if raw_lat is not None else None,
                longitude=float(raw_lon) if raw_lon is not None else None,
                estimated_size_m=float(item.get("estimated_size_m", 3.0)),
                shadow_verified=bool(item.get("shadow_verified", True)),
                status=str(item.get("status", "pending_review")),
                timestamp=item.get("timestamp"),
                sonar_image_ref=item.get("sonar_image_ref") or top_level_image,
                bounding_box=item.get("bounding_box"),
                segmentation=item.get("segmentation"),
                mask_ref=item.get("mask_ref")
            )
            item_mission = item.get("mission_id") or default_mission
            res = await _process_single_canonical_detection(canonical, mission_id=item_mission)
            results.append(res["detection"])
        except Exception as ex:
            print(f"[Batch Ingestion Warning] Skipping item: {ex}")
            continue

    return {
        "success": True,
        "message": f"Successfully ingested {len(results)} ML detections in batch.",
        "count": len(results),
        "detections": results
    }

@router.post("/batch-upload", status_code=status.HTTP_201_CREATED)
async def upload_batch_json_file(file: UploadFile = File(...)):
    """
    POST /api/ml/batch-upload — Upload a detections.json file directly.
    """
    import json
    content = await file.read()
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file format: {str(e)}")
    
    return await ingest_batch_detections(data)

@router.get("/sample-batch", status_code=status.HTTP_400_BAD_REQUEST)
def get_sample_batch():
    """
    Sample prototype dataset has been removed for production deployable operation.
    """
    raise HTTPException(
        status_code=400,
        detail="Sample prototype datasets are disabled. Only real batch or API detection data is accepted."
    )

@router.post("/load-sample", status_code=status.HTTP_400_BAD_REQUEST)
async def load_sample_dataset():
    """
    Sample prototype dataset loading is disabled for production deployable operation.
    """
    raise HTTPException(
        status_code=400,
        detail="Sample prototype datasets are disabled. Ingest real survey detection batches via POST /api/missions/{mission_id}/import."
    )
