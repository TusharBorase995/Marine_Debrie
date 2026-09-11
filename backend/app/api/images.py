from fastapi import APIRouter, HTTPException, Response
from app.db.repository import SonarRepository

router = APIRouter(prefix="/api/images", tags=["Sonar Image Storage API"])

@router.get("/{image_id}")
def get_image(image_id: str):
    """
    GET /api/images/{image_id}
    Retrieves raw binary image payload (PNG/JPEG byte stream) directly from Neon Object Storage ('sagar-images').
    The bucket remains strictly private while authorized application users fetch through this route.
    """
    result = SonarRepository.get_sonar_image_bytes(image_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Sonar image '{image_id}' not found in Neon Object Storage or database."
        )

    raw_bytes, filename, mime_type = result
    return Response(
        content=raw_bytes,
        media_type=mime_type or "image/png",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f"inline; filename={filename}"
        }
    )
