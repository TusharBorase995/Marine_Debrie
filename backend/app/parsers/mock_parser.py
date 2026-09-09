import os
import random
from typing import Dict, Any
from .base import SonarParser

class MockXTFJSFParser(SonarParser):
    """
    Mock implementation of SonarParser for .XTF and .JSF side-scan sonar binary files.
    """

    def parse(self, file_path: str) -> Dict[str, Any]:
        file_name = os.path.basename(file_path)
        ext = os.path.splitext(file_name)[1].lower()

        return {
            "file_name": file_name,
            "file_type": ext.replace(".", "") or "xtf",
            "file_size_bytes": os.path.getsize(file_path) if os.path.exists(file_path) else 45000000,
            "ping_count": random.randint(1800, 3400),
            "frequency_khz": 410 if ext == ".xtf" else 300,
            "swath_width_m": 75.0,
            "transducer_altitude_m": 12.5,
            "heading_deg": 48.5,
            "vessel_speed_knots": 4.2
        }
