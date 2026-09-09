from fastapi import APIRouter, HTTPException, Response
from app.db.repository import SonarRepository

router = APIRouter(prefix="/api/images", tags=["PostgreSQL Binary Image Storage API"])

@router.get("/{image_id}")
def get_image(image_id: str):
    """
    GET /api/images/{image_id}
    Retrieves raw binary image payload (PNG/JPEG byte stream) directly from PostgreSQL BYTEA storage.
    """
    img_record = SonarRepository.get_sonar_image(image_id)
    if not img_record or not img_record.image_bytes:
        raise HTTPException(status_code=404, detail=f"Sonar image record '{image_id}' not found in PostgreSQL database.")

    return Response(
        content=img_record.image_bytes,
        media_type=img_record.mime_type or "image/png",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f"inline; filename={img_record.filename}"
        }
    )
