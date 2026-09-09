import os
import uuid
import shutil
from typing import Optional
from fastapi import UploadFile

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DETECTIONS_DIR = os.path.join(BACKEND_DIR, "uploads", "detections")
os.makedirs(DETECTIONS_DIR, exist_ok=True)

class ImageService:
    """
    Service abstraction for managing detected sonar evidence images.
    Saves uploaded/imported image files and provides their public URL paths.
    No hardcoded mock images or fake fallback mappings.
    """

    @staticmethod
    def save_binary_image(data: bytes, filename: str) -> str:
        """Saves binary image data (e.g. from zip extraction) and returns public URL."""
        base_name = os.path.basename(filename)
        filepath = os.path.join(DETECTIONS_DIR, base_name)
        with open(filepath, "wb") as buffer:
            buffer.write(data)
        return f"/uploads/detections/{base_name}"

    @staticmethod
    async def save_uploaded_image(file: UploadFile, target_id: Optional[str] = None) -> str:
        """Saves an uploaded image file from ML inference and returns its public URL path."""
        orig_name = file.filename or "sonar_evidence.png"
        ext = os.path.splitext(orig_name)[1].lower() or ".png"
        if ext not in [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"]:
            ext = ".png"
        
        safe_tid = (target_id or "TGT").replace("/", "_").replace("\\", "_")
        filename = f"{safe_tid}_{uuid.uuid4().hex[:8]}{ext}"
        filepath = os.path.join(DETECTIONS_DIR, filename)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return f"/uploads/detections/{filename}"

    @staticmethod
    def resolve_image_ref(image_ref: Optional[str], target_id: Optional[str] = None, target_class: Optional[str] = None) -> Optional[str]:
        """
        Normalizes sonar image reference to a valid server URL path.
        Returns None if no evidence image is associated (never returns a fake mock image).
        """
        if not image_ref or not str(image_ref).strip():
            # Check if an image already exists on disk for this target
            if target_id:
                for ext in [".png", ".jpg", ".jpeg"]:
                    candidate = f"{target_id}{ext}"
                    if os.path.exists(os.path.join(DETECTIONS_DIR, candidate)):
                        return f"/uploads/detections/{candidate}"
            return None

        ref = str(image_ref).strip()

        if ref.startswith("http://") or ref.startswith("https://"):
            return ref

        if ref.startswith("/uploads/"):
            return ref

        if ref.startswith("/detections/"):
            # Map to /uploads/detections/
            return ref.replace("/detections/", "/uploads/detections/")

        if ref.startswith("/api/images/"):
            return ref

        # Filename or relative path (e.g. "images/TGT-001.png" or "TGT-001.png")
        clean_filename = os.path.basename(ref)
        if clean_filename:
            return f"/uploads/detections/{clean_filename}"

        return None

image_service = ImageService()
