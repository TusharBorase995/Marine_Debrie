from typing import Dict, Any

class DetectionValidationService:
    """
    Service boundary establishing the architecture for future confidence fusion & shadow verification:
    YOLO result + U-Net shadow result + geometric consistency -> confidence fusion -> status assignment.
    """

    def validate(self, detection: Dict[str, Any]) -> Dict[str, Any]:
        conf = detection.get("confidence", 0.85)
        shadow_verified = detection.get("shadow_verified", True)

        # Fusion logic
        fusion_score = round(conf * (1.02 if shadow_verified else 0.82), 2)
        fusion_score = min(0.99, max(0.10, fusion_score))

        detection["fusion_score"] = fusion_score
        if fusion_score >= 0.90:
            detection["status"] = "verified"
        elif fusion_score < 0.60:
            detection["status"] = "rejected"
        else:
            detection["status"] = "pending_review"

        return detection
