from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.db.repository import repo
from app.api.websocket import ws_manager

router = APIRouter(prefix="/api/targets", tags=["Consolidated Targets API"])

class TargetReviewPayload(BaseModel):
    action: str  # "confirm" | "reject"

@router.get("", response_model=List[dict])
def get_targets(
    cls: Optional[str] = Query(None, alias="class"),
    status_filter: Optional[str] = Query(None, alias="status"),
    mission_id: Optional[str] = Query(None)
):
    """
    GET /api/targets — returns list of unique physical targets consolidated from multiple sonar observations.
    Guarantees exactly ONE target record per physical seafloor object directly from PostgreSQL.
    Supports filtering by class, status, and mission_id.
    """
    try:
        return repo.get_consolidated_targets(cls_name=cls, status=status_filter, mission_id=mission_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot read targets from PostgreSQL. Please ensure PostgreSQL service ('sonar_db') is running. Error: {e}"
        )

@router.get("/{target_id}")
def get_target_detail(target_id: str):
    """
    GET /api/targets/{target_id} — returns details for a single physical target along with
    all associated repeated sonar observations / passes directly from PostgreSQL.
    """
    try:
        target = repo.get_target(target_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot read target from PostgreSQL: {e}"
        )
    if not target:
        raise HTTPException(status_code=404, detail=f"Physical target '{target_id}' not found")
    return target

@router.post("/{target_id}/review")
async def review_target(target_id: str, review_in: TargetReviewPayload):
    """
    POST /api/targets/{target_id}/review — Human-in-the-loop analyst action on a physical target.
    Accepts {"action": "confirm" | "reject"} and propagates verified/rejected status to all
    associated sonar observations of this physical object directly in PostgreSQL.
    """
    action = review_in.action.lower()
    if action not in ["confirm", "reject"]:
        raise HTTPException(status_code=400, detail="Action must be 'confirm' or 'reject'")

    new_status = "confirmed" if action == "confirm" else "rejected"

    # Persist review status into PostgreSQL database (mandatory)
    try:
        updated = repo.review_target(target_id, new_status)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot update target review in PostgreSQL. Please start the PostgreSQL service ('sonar_db'). Error: {e}"
        )

    if not updated:
        raise HTTPException(status_code=404, detail=f"Physical target '{target_id}' not found")

    await ws_manager.broadcast({
        "type": "TARGET_REVIEWED",
        "data": {
            "target_id": target_id,
            "status": new_status
        }
    })

    return updated

@router.delete("/{target_id}")
async def delete_target(target_id: str):
    """
    DELETE /api/targets/{target_id}
    Deletes physical target record and all associated multi-pass observations from PostgreSQL permanently.
    """
    try:
        deleted = repo.delete_target(target_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database Offline: Cannot delete target from PostgreSQL. Please start the PostgreSQL service ('sonar_db'). Error: {e}"
        )

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Target '{target_id}' not found")

    await ws_manager.broadcast({
        "type": "TARGET_DELETED",
        "data": {"target_id": target_id}
    })
    return {"message": f"Target '{target_id}' deleted successfully", "target_id": target_id}
