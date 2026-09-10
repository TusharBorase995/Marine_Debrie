import os
import sys

# Ensure backend root is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_postgres_storage")

from app.db.database import engine, SessionLocal
from app.db.models import MissionModel, SonarImageModel
from app.db.repository import init_tables, SonarRepository
from fastapi.testclient import TestClient
from app.main import app

def run_postgres_verification():
    logger.info("=== Starting PostgreSQL Binary Image & Data Persistence Verification ===")
    url_scheme = str(engine.url).split("://")[0]
    logger.info(f"Active Database Engine URL Scheme: {url_scheme}")
    logger.info(f"Full Database URL (masked): {str(engine.url).split('@')[-1] if '@' in str(engine.url) else str(engine.url)}")

    # 1. Initialize Tables
    logger.info("1. Initializing schema tables (including sonar_images BYTEA)...")
    init_tables()

    # 2. Seed Test Binary Image Payload and Mission
    test_image_id = "IMG-VERIFY-001"
    # Minimal valid 1x1 PNG byte sequence
    sample_png = (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
        b'\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00'
        b'\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82'
    )
    logger.info(f"2. Persisting sample binary sonar image ({len(sample_png)} bytes) into PostgreSQL BYTEA storage...")
    SonarRepository.save_sonar_image(
        image_id=test_image_id,
        filename="test_acoustic_sonar.png",
        mime_type="image/png",
        raw_bytes=sample_png
    )

    SonarRepository.create_or_update_mission({
        "mission_id": "MISSION-PG-VERIFY",
        "survey_name": "PostgreSQL Storage Verification Mission",
        "ingestion_mode": "batch"
    })

    # 3. Query PostgreSQL Session
    with SessionLocal() as session:
        mission_count = session.query(MissionModel).count()
        image_count = session.query(SonarImageModel).count()

        logger.info(f"Database Stats:")
        logger.info(f"  - Missions: {mission_count}")
        logger.info(f"  - Binary Images (BYTEA): {image_count}")

        assert mission_count > 0, "No missions found in DB!"
        assert image_count > 0, "No binary sonar images found in DB!"

        # Inspect specific binary image record
        first_img = session.query(SonarImageModel).filter(SonarImageModel.image_id == test_image_id).first()
        assert first_img is not None, f"Image {test_image_id} not found in DB!"
        logger.info(f"Sample Binary Image in Database:")
        logger.info(f"  - ID: {first_img.image_id}")
        logger.info(f"  - Filename: {first_img.filename}")
        logger.info(f"  - MIME Type: {first_img.mime_type}")
        logger.info(f"  - Size: {len(first_img.image_bytes)} bytes")

        assert len(first_img.image_bytes) == len(sample_png), "Binary image payload length mismatch!"

    # 4. Verify FastAPI Image Endpoint (/api/images/{image_id})
    logger.info(f"4. Testing FastAPI endpoint /api/images/{test_image_id} streaming binary data from DB...")
    client = TestClient(app)
    response = client.get(f"/api/images/{test_image_id}")

    assert response.status_code == 200, f"Expected 200 OK from image API, got {response.status_code}"
    assert len(response.content) == len(sample_png), "Streamed HTTP content length does not match database BYTEA length!"
    assert response.headers.get("content-type") == "image/png", "Incorrect MIME content-type returned!"
    logger.info(f"Successfully retrieved binary image from DB via API (HTTP {response.status_code}, {len(response.content)} bytes)")

    # 5. Verify /api/health returns database engine status
    health_resp = client.get("/api/health")
    assert health_resp.status_code == 200, f"Health check failed with {health_resp.status_code}"
    logger.info(f"Health status response: {health_resp.json()['database']}")
    assert health_resp.json()["database"]["status"] == "connected"

    # Teardown test artifacts
    from app.db.repository import repo
    repo.delete_mission(test_mission_id)
    with repo.get_session() as s:
        from app.db.models import SonarImageModel
        s.query(SonarImageModel).filter(SonarImageModel.image_id == test_image_id).delete()
        s.commit()

    logger.info("=== PostgreSQL Binary Image & Data Verification PASSED! ===")

if __name__ == "__main__":
    run_postgres_verification()
