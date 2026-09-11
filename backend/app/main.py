import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Ensure backend root is in sys.path for mock_data import
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from mock_data import db_mock
from app.api import missions, detections, targets, surveys, jobs, vessel, reports, websocket, ml_integration, images, auth

app = FastAPI(
    title="PS 26057 - AI Marine Debris Operations System Backend",
    description="FastAPI application layer for side-scan sonar object detection, georeferencing, and human-in-the-loop analyst review.",
    version="1.0.0"
)

# CORS Configuration for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount sample uploads directory for sonar evidence imagery
UPLOAD_DIR = os.path.join(backend_dir, "uploads")
DETECTIONS_DIR = os.path.join(backend_dir, "uploads", "detections")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DETECTIONS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/detections", StaticFiles(directory=DETECTIONS_DIR), name="detections")

# Mount API & WebSocket Routers
app.include_router(auth.router)
app.include_router(missions.router)
app.include_router(detections.router)
app.include_router(targets.router)
app.include_router(ml_integration.router)
app.include_router(surveys.router)
app.include_router(jobs.router)
app.include_router(vessel.router)
app.include_router(reports.router)
app.include_router(websocket.router)
app.include_router(images.router)

from app.db import init_tables, repo

@app.on_event("startup")
def on_startup():
    try:
        init_tables()
    except Exception as e:
        print(f"[DB] Startup initialization warning: {e}")

@app.get("/")
def root():
    return {
        "status": "online",
        "system": "PS 26057 AI Marine Debris Operations Workstation",
        "version": "1.0.0",
        "docs": "/docs"
    }

from app.db.database import engine

@app.get("/api/health")
def health_check():
    """System Health Endpoint per API contract specification."""
    db_type = "postgresql"
    db_status = "connected"
    db_error = None
    db_version = None
    db_name = "sonar_db"
    db_port = 5432

    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            row = conn.execute(text("SELECT version(), current_database(), inet_server_port();")).fetchone()
            if row:
                db_version = row[0].split(",")[0] if row[0] else "PostgreSQL"
                db_name = row[1] or "sonar_db"
                db_port = row[2] or 5432
    except Exception as e:
        db_status = "disconnected"
        db_error = str(e)

    overall_status = "healthy" if db_status == "connected" else "degraded"
    return {
        "status": overall_status,
        "system": "PS 26057 Marine Hazard Detection Dashboard",
        "version": "1.0.0",
        "ingestion_modes": ["live", "batch"],
        "database": {
            "engine": db_type,
            "url_scheme": str(engine.url).split("://")[0],
            "status": db_status,
            "error": db_error,
            "version": db_version,
            "database_name": db_name,
            "server_port": db_port
        },
        "endpoints": {
            "live_detection": "POST /api/detections",
            "batch_import": "POST /api/missions/{mission_id}/import",
            "missions": "GET /api/missions",
            "detections": "GET /api/detections",
            "review": "POST /api/detections/{id}/review",
            "live_websocket": "WS /ws/live-feed",
            "export": "GET /api/missions/{mission_id}/export?format=json|csv"
        },
        "stats": {
            "missions_count": len(db_mock.missions),
            "targets_count": len(db_mock.targets),
            "detections_count": len(db_mock.detections)
        }
    }

