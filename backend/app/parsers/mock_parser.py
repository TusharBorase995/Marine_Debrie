import os
from typing import Dict, Any
from .base import SonarParser

class MockXTFJSFParser(SonarParser):
    """
    SonarParser for .XTF and .JSF side-scan sonar binary files.
    """

    def parse(self, file_path: str) -> Dict[str, Any]:
        file_name = os.path.basename(file_path)
        ext = os.path.splitext(file_name)[1].lower()
        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

        return {
            "file_name": file_name,
            "file_type": ext.replace(".", "") or "xtf",
            "file_size_bytes": file_size,
            "ping_count": 0,
            "frequency_khz": 410 if ext == ".xtf" else 300,
            "swath_width_m": 75.0,
            "transducer_altitude_m": 12.5,
            "heading_deg": 0.0,
            "vessel_speed_knots": 0.0
        }
