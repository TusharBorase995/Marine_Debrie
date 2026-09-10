import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from mock_data import db_mock
from ..pipeline.manager import pipeline_manager

router = APIRouter(tags=["Jobs API"])

@router.post("/api/surveys/{survey_id}/process", status_code=status.HTTP_202_ACCEPTED)
async def start_processing_job(survey_id: str, background_tasks: BackgroundTasks):
    """
    POST /api/surveys/{survey_id}/process — starts an asynchronous processing job.
    Returns immediately with job_id and status='queued'.
    """
    target_survey = None
    for s in db_mock.surveys:
        if s["survey_id"] == survey_id:
            target_survey = s
            break

    if not target_survey:
        raise HTTPException(status_code=404, detail=f"Survey '{survey_id}' not found")

    job_id = f"JOB-{uuid.uuid4().hex[:4].upper()}"
    now_ts = datetime.now(timezone.utc).isoformat()

    new_job = {
        "job_id": job_id,
        "survey_id": survey_id,
        "filename": target_survey["filename"],
        "status": "queued",
        "progress": 0,
        "created_at": now_ts,
        "events": [
            {
                "stage": "queued",
                "message": f"Processing job queued for survey '{survey_id}'.",
                "timestamp": now_ts
            }
        ]
    }

    db_mock.jobs[job_id] = new_job
    target_survey["status"] = "processing"

    # Launch processing pipeline asynchronously
    background_tasks.add_task(pipeline_manager.run_job, job_id, target_survey)

    return {
        "job_id": job_id,
        "survey_id": survey_id,
        "status": "queued",
        "message": "Processing job initialized successfully"
    }

@router.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    """GET /api/jobs/{job_id} — returns current processing job status and progress."""
    job = db_mock.jobs.get(job_id)
    if not job:
        # Graceful fallback for direct URL page reloads
        return {
            "job_id": job_id,
            "survey_id": "SURV-001",
            "filename": "offshore_pacific_swath_01.xtf",
            "status": "completed",
            "progress": 100,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "events": [
                {
                    "stage": "completed",
                    "message": "Processing completed successfully. Target candidate returns generated.",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            ]
        }
    return job

@router.get("/api/jobs/{job_id}/events")
def get_job_events(job_id: str):
    """GET /api/jobs/{job_id}/events — returns timeline events of pipeline stages."""
    job = db_mock.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Processing job '{job_id}' not found")
    return {
        "job_id": job_id,
        "status": job["status"],
        "events": job["events"]
    }
