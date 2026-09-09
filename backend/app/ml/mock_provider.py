import random
import time
from datetime import datetime, timezone
from typing import Dict, Any, List
from .base import InferenceProvider

class MockInferenceProvider(InferenceProvider):
    """
    Mock implementation of InferenceProvider used for full-stack prototype development.
    Simulates target candidate generation from sonar log input without actual CV execution.
    """

    async def infer(self, input_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        survey_id = input_data.get("survey_id", "SURV-MOCK")
        base_lat = input_data.get("latitude", 32.6500)
        base_lon = input_data.get("longitude", -117.5500)

        candidate_presets = [
            {
                "class": "pipe_cylinder",
                "confidence": 0.94,
                "estimated_size_m": 4.5,
                "shadow_verified": True,
                "status": "verified",
                "bounding_box": {"x": 120, "y": 350, "width": 480, "height": 130},
                "sonar_image_ref": "/uploads/sonar_pipeline.jpg"
            },
            {
                "class": "debris_net",
                "confidence": 0.86,
                "estimated_size_m": 2.3,
                "shadow_verified": True,
                "status": "pending_review",
                "bounding_box": {"x": 340, "y": 180, "width": 240, "height": 210},
                "sonar_image_ref": "/uploads/sonar_debris.jpg"
            },
            {
                "class": "wreck_structure",
                "confidence": 0.91,
                "estimated_size_m": 11.2,
                "shadow_verified": True,
                "status": "verified",
                "bounding_box": {"x": 220, "y": 140, "width": 360, "height": 380},
                "sonar_image_ref": "/uploads/sonar_shipwreck.jpg"
            }
        ]

        # Select 2-3 candidate targets
        selected = random.sample(candidate_presets, random.choice([2, 3]))
        results = []

        for idx, preset in enumerate(selected):
            det_id = f"det_{survey_id[-3:]}_{idx + 1:02d}"
            target_id = f"TGT-{survey_id[-3:]}-{idx + 1:02d}"
            lat_off = (random.random() - 0.5) * 0.003
            lon_off = (random.random() - 0.5) * 0.003

            results.append({
                "id": det_id,
                "target_id": target_id,
                "target_label": f"Contact ({preset['class'].replace('_', ' ').title()})",
                "pass_number": 1,
                "survey_leg": f"{survey_id} Swath Leg {idx + 1}",
                "class": preset["class"],
                "confidence": preset["confidence"],
                "latitude": round(base_lat + lat_off, 6),
                "longitude": round(base_lon + lon_off, 6),
                "estimated_size_m": preset["estimated_size_m"],
                "shadow_verified": preset["shadow_verified"],
                "status": preset["status"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "bounding_box": preset["bounding_box"],
                "sonar_image_ref": preset["sonar_image_ref"]
            })

        return results
