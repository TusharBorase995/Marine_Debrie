"""
Integration test script for PS 26057 Dashboard Backend & ML Output Integration.
Tests:
1. Health check (GET /api/health)
2. Live Mode Ingestion (POST /api/detections)
3. Batch Mode Ingestion with JSON (POST /api/missions/{id}/import)
4. Batch Mode Ingestion with ZIP package (detections.json + images)
5. Physical Target Consolidation (Multiple observations = 1 target)
6. Human-in-the-Loop Analyst Review (POST /api/detections/{id}/review)
7. Mission Export (GET /api/missions/{id}/export?format=json|csv)
"""

import io
import json
import zipfile
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200, f"Health check failed: {response.text}"
    data = response.json()
    assert data["status"] == "healthy"
    assert "live" in data["ingestion_modes"]
    assert "batch" in data["ingestion_modes"]
    print("[PASS] Health check passed")

def test_live_detection_ingestion():
    payload = {
        "target_id": "TGT-LIVE-01",
        "class": "debris_net",
        "confidence": 0.94,
        "latitude": 32.65123,
        "longitude": -117.55432,
        "estimated_size_m": 8.4,
        "shadow_verified": True,
        "status": "pending_review",
        "timestamp": "2026-09-04T10:22:31Z",
        "sonar_image_ref": "TGT-LIVE-01.png"
    }
    response = client.post("/api/detections", json=payload)
    assert response.status_code == 201, f"Live detection ingestion failed: {response.text}"
    data = response.json()
    assert data["success"] is True
    assert data["detection"]["target_id"] == "TGT-LIVE-01"
    assert data["detection"]["class"] == "debris_net"
    assert data["detection"]["status"] == "pending_review"
    assert data["detection"]["confidence"] == 0.94
    print("[PASS] Mode A Live detection ingestion passed")

def test_live_multipart_form_data_ingestion():
    detection_payload = {
        "target_id": "TGT-POSTMAN-01",
        "class": "pipe_cylinder",
        "confidence": 0.95,
        "latitude": 32.65432,
        "longitude": -117.55123,
        "estimated_size_m": 7.2,
        "shadow_verified": True,
        "status": "pending_review",
        "timestamp": "2026-09-05T12:00:00Z",
        "mission_id": "MISSION-LIVE-01"
    }
    dummy_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    
    response = client.post(
        "/api/detections",
        data={"detection": json.dumps(detection_payload)},
        files={"image": ("sonar_pipeline_contact.png", dummy_png, "image/png")}
    )
    assert response.status_code == 201, f"Multipart live detection ingestion failed: {response.text}"
    data = response.json()
    assert data["success"] is True
    assert data["target_id"] == "TGT-POSTMAN-01"
    assert data["image_url"] is not None
    assert "/uploads/detections/" in data["image_url"]
    assert data["detection"]["target_id"] == "TGT-POSTMAN-01"
    assert data["detection"]["sonar_image_ref"] == data["image_url"]
    print("[PASS] Mode A Live detection multipart/form-data (Postman simulation) passed")

def test_physical_target_consolidation():
    # Submit second observation of same target_id
    payload2 = {
        "target_id": "TGT-LIVE-01",
        "class": "debris_net",
        "confidence": 0.96,
        "latitude": 32.65125,
        "longitude": -117.55430,
        "estimated_size_m": 8.5,
        "shadow_verified": True,
        "status": "pending_review",
        "timestamp": "2026-09-04T10:25:00Z",
        "sonar_image_ref": "TGT-LIVE-01.png"
    }
    response = client.post("/api/detections", json=payload2)
    assert response.status_code == 201

    # Check targets: strictly ONE target record for TGT-LIVE-01 with 2 observations
    targets_resp = client.get("/api/targets")
    assert targets_resp.status_code == 200
    targets = targets_resp.json()
    matching = [t for t in targets if t["target_id"] == "TGT-LIVE-01"]
    assert len(matching) == 1, f"Expected exactly 1 consolidated target, got {len(matching)}"
    assert matching[0]["observation_count"] == 2
    print("[PASS] Physical target consolidation passed (Multiple observations = 1 target)")

def test_batch_json_import():
    mission_id = "MISSION-BATCH-TEST"
    batch_payload = {
        "mission_id": mission_id,
        "survey_name": "Offshore Survey Test",
        "created_at": "2026-09-04T14:30:00Z",
        "detections": [
            {
                "target_id": "TGT-B01",
                "class": "pipe_cylinder",
                "confidence": 0.91,
                "latitude": 32.6450,
                "longitude": -117.5500,
                "estimated_size_m": 12.0,
                "shadow_verified": True,
                "status": "pending_review",
                "timestamp": "2026-09-04T14:31:00Z",
                "sonar_image_ref": "TGT-B01.png"
            },
            {
                "target_id": "TGT-B02",
                "class": "wreck_structure",
                "confidence": 0.95,
                "latitude": 32.6480,
                "longitude": -117.5520,
                "estimated_size_m": 25.0,
                "shadow_verified": True,
                "status": "pending_review",
                "timestamp": "2026-09-04T14:35:00Z",
                "sonar_image_ref": "TGT-B02.png"
            }
        ]
    }
    response = client.post(f"/api/missions/{mission_id}/import", json=batch_payload)
    assert response.status_code == 201, f"Batch import failed: {response.text}"
    data = response.json()
    assert data["success"] is True
    assert data["count"] == 2
    assert data["mission"]["mission_id"] == mission_id
    assert data["mission"]["ingestion_mode"] == "batch"
    print("[PASS] Mode B Batch JSON import passed")

def test_batch_zip_import():
    mission_id = "MISSION-ZIP-TEST"
    detections_json_content = json.dumps({
        "mission_id": mission_id,
        "survey_name": "Deep Shelf Acoustic Scan",
        "created_at": "2026-09-04T15:00:00Z",
        "detections": [
            {
                "target_id": "TGT-Z01",
                "class": "debris_net",
                "confidence": 0.88,
                "latitude": 32.6550,
                "longitude": -117.5450,
                "estimated_size_m": 5.0,
                "shadow_verified": True,
                "status": "pending_review",
                "timestamp": "2026-09-04T15:05:00Z",
                "sonar_image_ref": "images/TGT-Z01.png"
            }
        ]
    })

    # Create in-memory zip
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as z:
        z.writestr("detections.json", detections_json_content)
        # Dummy 1x1 png bytes
        dummy_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        z.writestr("images/TGT-Z01.png", dummy_png)
    zip_buffer.seek(0)

    response = client.post(
        f"/api/missions/{mission_id}/import",
        files={"file": ("mission_package.zip", zip_buffer.getvalue(), "application/zip")}
    )
    assert response.status_code == 201, f"ZIP import failed: {response.text}"
    data = response.json()
    assert data["success"] is True
    assert data["count"] == 1
    assert "TGT-Z01.png" in data["detections"][0]["sonar_image_ref"]
    print("[PASS] Mode B Batch ZIP package import passed")

def test_human_review_and_sync():
    target_id = "TGT-LIVE-01"
    # Confirm
    resp = client.post(f"/api/detections/{target_id}/review", json={"action": "confirm"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "confirmed"

    # Verify physical target status synced
    target_resp = client.get(f"/api/targets/{target_id}")
    assert target_resp.status_code == 200
    tgt = target_resp.json()
    assert tgt["status"] == "confirmed"

    # Reject
    resp_rej = client.post(f"/api/detections/{target_id}/review", json={"action": "reject"})
    assert resp_rej.status_code == 200
    assert resp_rej.json()["status"] == "rejected"
    print("[PASS] Human-in-the-loop analyst review passed")

def test_mission_export():
    mission_id = "MISSION-BATCH-TEST"
    # JSON export
    resp_json = client.get(f"/api/missions/{mission_id}/export?format=json")
    assert resp_json.status_code == 200
    assert resp_json.headers["content-type"] == "application/json"
    exported = resp_json.json()
    assert exported["mission"]["mission_id"] == mission_id
    assert len(exported["detections"]) == 2

    # CSV export
    resp_csv = client.get(f"/api/missions/{mission_id}/export?format=csv")
    assert resp_csv.status_code == 200
    assert "text/csv" in resp_csv.headers["content-type"]
    csv_text = resp_csv.text
    assert "Target ID" in csv_text
    assert "TGT-B01" in csv_text
    print("[PASS] Mission export (JSON and CSV) passed")

if __name__ == "__main__":
    print("\n--- Running PS 26057 Integration Test Suite ---")
    test_health()
    test_live_detection_ingestion()
    test_live_multipart_form_data_ingestion()
    test_physical_target_consolidation()
    test_batch_json_import()
    test_batch_zip_import()
    test_human_review_and_sync()
    test_mission_export()
    print("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===")
