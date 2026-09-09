from typing import List, Dict, Any
from fastapi import APIRouter
from mock_data import db_mock

router = APIRouter(prefix="/api/vessel-track", tags=["Vessel Telemetry API"])

@router.get("", response_model=List[dict])
def get_vessel_track():
    """
    GET /api/vessel-track — returns simulated survey vessel trajectory points:
    [{ "latitude": float, "longitude": float, "timestamp": "ISO 8601", "heading": float, "speed_knots": float }]
    """
    return db_mock.vessel_track

@router.get("/telemetry", response_model=Dict[str, Any])
def get_vessel_telemetry():
    """
    GET /api/vessel-track/telemetry — returns real-time telemetry of the active hydrographic survey vessel:
    {
      "latitude": float,
      "longitude": float,
      "heading": float,
      "speed_knots": float,
      "status": "Surveying",
      "survey_id": "OFFSHORE-001",
      "survey_leg": str
    }
    """
    return db_mock.get_active_vessel_telemetry()
