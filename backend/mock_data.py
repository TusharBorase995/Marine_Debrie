import math
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

"""
PS 26057 - Maritime Sonar Operations Database Repository Proxy

Strictly queries and persists to PostgreSQL database ('sonar_db').
All synthetic/mock data generators have been removed per specification.
Starts with 0 detections/targets until real data is ingested via backend APIs.
"""

TARGET_CLASSES = ["debris_net", "pipe_cylinder", "wreck_structure", "cargo_container", "naval_mine", "pipe_joint"]

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates initial compass bearing (0-359 deg) between two georeferenced coordinates."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    bearing = math.degrees(math.atan2(y, x))
    return round((bearing + 360) % 360, 1)


class DataRepository:
    """
    Database Proxy Repository for hydrographic survey missions, targets, detections, and vessel telemetry.
    Strictly queries and persists to PostgreSQL.
    """

    def __init__(self):
        self.base_lat = 32.6500
        self.base_lon = -117.5500
        self.vessel_track: List[Dict[str, Any]] = []
        self.surveys: List[Dict[str, Any]] = []
        self.jobs: Dict[str, Any] = {}
        self.next_det_id = 100
        self.next_tgt_id = 1
        self.active_vessel_index = 0

    @property
    def missions(self) -> List[Dict[str, Any]]:
        try:
            from app.db.repository import repo
            return repo.get_all_missions()
        except Exception:
            return []

    @property
    def targets(self) -> List[Dict[str, Any]]:
        try:
            from app.db.repository import repo
            return repo.get_consolidated_targets()
        except Exception:
            return []

    @property
    def detections(self) -> List[Dict[str, Any]]:
        try:
            from app.db.repository import repo
            return repo.get_all_detections()
        except Exception:
            return []

    def sync_from_db(self):
        """No-op as all properties read live directly from PostgreSQL."""
        pass

    def delete_mission(self, mission_id: str) -> bool:
        from app.db.repository import repo
        return repo.delete_mission(mission_id)

    def get_missions(self) -> List[Dict[str, Any]]:
        from app.db.repository import repo
        return repo.get_all_missions()

    def get_mission(self, mission_id: str) -> Optional[Dict[str, Any]]:
        from app.db.repository import repo
        return repo.get_mission(mission_id)

    def get_mission_detections(self, mission_id: str) -> List[Dict[str, Any]]:
        from app.db.repository import repo
        return repo.get_all_detections(mission_id=mission_id)

    def add_mission(self, mission_dict: Dict[str, Any]):
        from app.db.repository import repo
        return repo.create_or_update_mission(mission_dict)

    def get_consolidated_targets(
        self, 
        cls: Optional[str] = None, 
        status: Optional[str] = None,
        mission_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        from app.db.repository import repo
        return repo.get_consolidated_targets(cls_name=cls, status=status, mission_id=mission_id)

    def get_active_vessel_telemetry(self) -> Dict[str, Any]:
        """Returns telemetry of the survey vessel, reflecting active detections or idle standby."""
        dets = self.detections
        if dets:
            latest = dets[0]
            return {
                "latitude": latest.get("latitude"),
                "longitude": latest.get("longitude"),
                "timestamp": latest.get("timestamp") or datetime.now(timezone.utc).isoformat(),
                "heading": 0.0,
                "speed_knots": 0.0,
                "status": "Active Survey",
                "survey_id": latest.get("mission_id", "LIVE-STREAM"),
                "survey_leg": latest.get("survey_leg", "Live Feed"),
                "track_index": 0,
                "total_track_points": len(dets)
            }

        return {
            "latitude": None,
            "longitude": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "heading": 0.0,
            "speed_knots": 0.0,
            "status": "Standby - Awaiting Ingestion",
            "survey_id": None,
            "survey_leg": "Standby",
            "track_index": 0,
            "total_track_points": 0
        }


# Backwards compatibility aliases
MockDataRepository = DataRepository
db_mock = DataRepository()
