import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, UploadFile, File, status
from mock_data import db_mock

router = APIRouter(prefix="/api/surveys", tags=["Surveys API"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")

@router.get("", response_model=List[dict])
def get_surveys():
    """GET /api/surveys — returns list of all uploaded sonar surveys."""
    res = []
    for s in db_mock.surveys:
        s_copy = dict(s)
        surv_id = s.get("survey_id") or s.get("id", "SURV-001")
        s_copy["id"] = surv_id
        s_copy["survey_id"] = surv_id
        s_copy["file_format"] = s.get("file_format") or s.get("file_type", "xtf")
        s_copy["file_size_bytes"] = s.get("file_size_bytes") or int(s.get("file_size_mb", 50) * 1024 * 1024)
        s_copy["ping_count"] = s.get("ping_count", 1240)
        res.append(s_copy)
    return res

@router.get("/{survey_id}")
def get_survey_by_id(survey_id: str):
    """GET /api/surveys/{survey_id} — returns details for single survey."""
    for s in db_mock.surveys:
        s_id = s.get("survey_id") or s.get("id")
        if s_id == survey_id or s.get("survey_id") == survey_id or s.get("id") == survey_id:
            s_copy = dict(s)
            s_copy["id"] = s_id
            s_copy["survey_id"] = s_id
            s_copy["file_format"] = s.get("file_format") or s.get("file_type", "xtf")
            s_copy["file_size_bytes"] = s.get("file_size_bytes") or int(s.get("file_size_mb", 50) * 1024 * 1024)
            s_copy["ping_count"] = s.get("ping_count", 1240)
            return s_copy
    raise HTTPException(status_code=404, detail=f"Survey '{survey_id}' not found")

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_survey(file: UploadFile = File(...)):
    """
    POST /api/surveys — accepts multipart upload of .XTF or .JSF sonar survey files.
    Creates survey record.
    """
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1].lower()
    
    if ext not in [".xtf", ".jsf", ".dat", ".png", ".jpg", ".tiff"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format '{ext}'. Must be side-scan sonar log (.XTF, .JSF) or waterfall image."
        )

    survey_id = f"SURV-{uuid.uuid4().hex[:4].upper()}"
    saved_filename = f"{survey_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    new_survey = {
        "survey_id": survey_id,
        "filename": file.filename,
        "file_type": ext.replace(".", "") or "xtf",
        "status": "uploaded",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "file_size_mb": round(os.path.getsize(file_path) / (1024 * 1024), 2),
        "file_path": file_path,
        "latitude": 32.6500,
        "longitude": -117.5500,
        "swath_width_m": 75.0,
        "frequency_khz": 410,
        "detection_count": 0,
        "sonar_image_ref": "/uploads/sonar_pipeline.jpg"
    }

    db_mock.surveys.insert(0, new_survey)
    return new_survey

@router.delete("/{survey_id}")
def delete_survey(survey_id: str):
    """DELETE /api/surveys/{survey_id} — deletes a survey record."""
    for idx, s in enumerate(db_mock.surveys):
        if s["survey_id"] == survey_id:
            deleted = db_mock.surveys.pop(idx)
            return {"message": f"Survey '{survey_id}' deleted successfully", "survey_id": survey_id}
    raise HTTPException(status_code=404, detail=f"Survey '{survey_id}' not found")
