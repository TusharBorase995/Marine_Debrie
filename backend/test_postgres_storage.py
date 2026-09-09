import os
import sys

# Ensure backend root is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_postgres_storage")

from app.db.database import engine, SessionLocal, DATABASE_URL
from app.db.models import Base, MissionModel, TargetModel, ObservationModel, SonarImageModel
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

    # 2. Seed Initial Data
    logger.info("2. Force seeding database with missions, targets, observations, and binary images...")
    SonarRepository.seed_initial_data_if_empty(force=True)

    # 3. Query PostgreSQL Session
    with SessionLocal() as session:
        mission_count = session.query(MissionModel).count()
        target_count = session.query(TargetModel).count()
        observation_count = session.query(ObservationModel).count()
        image_count = session.query(SonarImageModel).count()

        logger.info(f"Database Stats:")
        logger.info(f"  - Missions: {mission_count}")
        logger.info(f"  - Targets: {target_count}")
        logger.info(f"  - Observations: {observation_count}")
        logger.info(f"  - Binary Images (BYTEA): {image_count}")

        assert mission_count > 0, "No missions found in DB!"
        assert target_count > 0, "No targets found in DB!"
        assert image_count > 0, "No binary sonar images found in DB!"

        # Inspect specific binary image record
        first_img = session.query(SonarImageModel).first()
        logger.info(f"Sample Binary Image in Database:")
        logger.info(f"  - ID: {first_img.image_id}")
        logger.info(f"  - Filename: {first_img.filename}")
        logger.info(f"  - MIME Type: {first_img.mime_type}")
        logger.info(f"  - Size: {len(first_img.image_bytes)} bytes")

        assert len(first_img.image_bytes) > 0, "Binary image payload in database is empty!"

    # 4. Verify FastAPI Image Endpoint (/api/images/{image_id})
    logger.info("4. Testing FastAPI endpoint /api/images/{image_id} streaming binary data from DB...")
    client = TestClient(app)
    response = client.get(f"/api/images/{first_img.image_id}")

    assert response.status_code == 200, f"Expected 200 OK from image API, got {response.status_code}"
    assert len(response.content) == len(first_img.image_bytes), "Streamed HTTP content length does not match database BYTEA length!"
    logger.info(f"Successfully retrieved binary image from DB via API (HTTP {response.status_code}, {len(response.content)} bytes)")

    # 5. Verify /api/health returns database engine status
    health_resp = client.get("/api/health")
    logger.info(f"Health status response: {health_resp.json()['database']}")

    logger.info("=== PostgreSQL Binary Image & Data Verification PASSED! ===")

if __name__ == "__main__":
    run_postgres_verification()
