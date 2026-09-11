from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, JSON, LargeBinary
from sqlalchemy.orm import relationship

from app.db.database import Base


class UserModel(Base):
    """
    SQLAlchemy model for Authenticated Platform Operators & Specialists.
    Enforces user-scoped data workspaces and access control.
    """
    __tablename__ = "users"

    user_id = Column(String(64), primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(128), default="Lead Marine Analyst", nullable=False)
    is_demo = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "is_demo": bool(self.is_demo),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class SonarImageModel(Base):
    """
    SQLAlchemy model for Sonar Evidence Images.
    Stores metadata and points to actual image stored in Neon Object Storage (sagar-images bucket).
    """
    __tablename__ = "sonar_images"

    image_id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(64), default="image/png", nullable=False)
    storage_key = Column(String(512), nullable=True)  # S3 Key in Neon Object Storage (sagar-images)
    image_bytes = Column(LargeBinary, nullable=True)   # Retained for backward-compatibility
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "image_id": self.image_id,
            "user_id": self.user_id,
            "filename": self.filename,
            "mime_type": self.mime_type,
            "storage_key": self.storage_key,
            "size_bytes": len(self.image_bytes) if self.image_bytes else 0,
            "url": f"/api/images/{self.image_id}",
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class MissionModel(Base):
    """
    SQLAlchemy model for Hydrographic Survey Missions.
    Represents completed bathymetric surveys or ongoing live streaming sessions.
    """
    __tablename__ = "missions"

    mission_id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    survey_name = Column(String(255), nullable=False)
    ingestion_mode = Column(String(32), default="batch", nullable=False)  # 'live' or 'batch'
    status = Column(String(32), default="completed", nullable=False)      # 'active', 'completed', 'archived'
    is_active = Column(Boolean, default=False, nullable=False)
    acoustic_freq = Column(String(32), default="410 kHz")
    swath_width_m = Column(Float, default=120.0)
    depth_m = Column(Float, default=84.2)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    targets = relationship("TargetModel", back_populates="mission", cascade="all, delete-orphan")

    def to_dict(self):
        targets_list = self.targets or []
        confirmed_count = sum(1 for t in targets_list if t.status in ["confirmed", "verified"])
        pending_count = sum(1 for t in targets_list if t.status == "pending_review")
        rejected_count = sum(1 for t in targets_list if t.status == "rejected")
        total_dets = sum(len(t.observations or []) for t in targets_list)

        return {
            "mission_id": self.mission_id,
            "user_id": self.user_id,
            "survey_name": self.survey_name,
            "ingestion_mode": self.ingestion_mode,
            "status": self.status,
            "is_active": bool(self.is_active),
            "acoustic_freq": self.acoustic_freq,
            "swath_width_m": self.swath_width_m,
            "depth_m": self.depth_m,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "target_count": len(targets_list),
            "detection_count": total_dets or len(targets_list),
            "confirmed_count": confirmed_count,
            "pending_count": pending_count,
            "rejected_count": rejected_count
        }


class TargetModel(Base):
    """
    SQLAlchemy model for Unique Physical Targets on the seafloor.
    Strictly enforces 1 Physical Target = 1 Record = 1 GIS Marker.
    Consolidates multiple multi-pass acoustic observations.
    """
    __tablename__ = "targets"

    target_id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    mission_id = Column(String(64), ForeignKey("missions.mission_id", ondelete="CASCADE"), nullable=True, index=True)
    image_id = Column(String(64), ForeignKey("sonar_images.image_id", ondelete="SET NULL"), nullable=True)
    target_class = Column(String(64), nullable=False, index=True)  # e.g. 'debris_net', 'pipe_cylinder'
    label = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=True, index=True)
    longitude = Column(Float, nullable=True, index=True)
    estimated_size_m = Column(Float, default=3.0)
    fused_confidence = Column(Float, default=0.85)
    status = Column(String(32), default="pending_review", index=True)  # 'pending_review', 'confirmed', 'rejected'
    sonar_image_ref = Column(String(512), nullable=True)
    bounding_box = Column(JSON, nullable=True)
    segmentation = Column(JSON, nullable=True)
    mask_ref = Column(String(512), nullable=True)
    shadow_verified = Column(Boolean, default=False, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    mission = relationship("MissionModel", back_populates="targets")
    image = relationship("SonarImageModel")
    observations = relationship("ObservationModel", back_populates="target", cascade="all, delete-orphan", order_by="ObservationModel.pass_number")

    def to_dict(self):
        obs_dicts = [obs.to_dict() for obs in (self.observations or [])]
        image_url = f"/api/images/{self.image_id}" if self.image_id else self.sonar_image_ref
        latest_obs = obs_dicts[-1] if obs_dicts else {}
        shadow_val = self.shadow_verified
        if shadow_val is None:
            shadow_val = latest_obs.get("shadow_verified")
        return {
            "target_id": self.target_id,
            "id": self.target_id,  # Compatibility alias
            "user_id": self.user_id,
            "mission_id": self.mission_id or "MISSION-001",
            "image_id": self.image_id,
            "class": self.target_class,
            "category": self.target_class,
            "label": self.label or self.target_class.replace("_", " ").title(),
            "latitude": round(self.latitude, 6) if self.latitude is not None else None,
            "longitude": round(self.longitude, 6) if self.longitude is not None else None,
            "estimated_size_m": round(self.estimated_size_m, 1),
            "confidence": round(self.fused_confidence, 2),
            "fused_confidence": round(self.fused_confidence, 2),
            "shadow_verified": bool(shadow_val) if shadow_val is not None else False,
            "status": self.status,
            "human_review_status": self.status,
            "sonar_image_ref": image_url,
            "bounding_box": self.bounding_box if self.bounding_box is not None else latest_obs.get("bounding_box"),
            "segmentation": self.segmentation if self.segmentation is not None else latest_obs.get("segmentation"),
            "mask_ref": self.mask_ref or latest_obs.get("mask_ref"),
            "observation_count": len(obs_dicts) or 1,
            "observations": obs_dicts,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class ObservationModel(Base):
    """
    SQLAlchemy model for Individual ML Detections / Acoustic Swath Passes.
    Each detection links to its parent physical TargetModel.
    """
    __tablename__ = "observations"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    target_id = Column(String(64), ForeignKey("targets.target_id", ondelete="CASCADE"), nullable=False, index=True)
    mission_id = Column(String(64), nullable=True, index=True)
    image_id = Column(String(64), ForeignKey("sonar_images.image_id", ondelete="SET NULL"), nullable=True)
    pass_number = Column(Integer, default=1)
    survey_leg = Column(String(128), nullable=True)
    target_class = Column(String(64), nullable=False)
    confidence = Column(Float, default=0.85)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    estimated_size_m = Column(Float, default=3.0)
    shadow_verified = Column(Boolean, default=False)
    status = Column(String(32), default="pending_review")
    bounding_box = Column(JSON, nullable=True)
    segmentation = Column(JSON, nullable=True)
    mask_ref = Column(String(512), nullable=True)
    sonar_image_ref = Column(String(512), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    target = relationship("TargetModel", back_populates="observations")
    image = relationship("SonarImageModel")

    def to_dict(self):
        image_url = f"/api/images/{self.image_id}" if self.image_id else self.sonar_image_ref
        return {
            "id": self.id,
            "user_id": self.user_id,
            "target_id": self.target_id,
            "mission_id": self.mission_id or "MISSION-001",
            "image_id": self.image_id,
            "pass_number": self.pass_number,
            "survey_leg": self.survey_leg or f"Swath Pass {self.pass_number}",
            "class": self.target_class,
            "category": self.target_class,
            "confidence": round(self.confidence, 2),
            "latitude": round(self.latitude, 6) if self.latitude is not None else None,
            "longitude": round(self.longitude, 6) if self.longitude is not None else None,
            "estimated_size_m": round(self.estimated_size_m, 1),
            "shadow_verified": bool(self.shadow_verified) if self.shadow_verified is not None else False,
            "status": self.status,
            "human_review_status": self.status,
            "bounding_box": self.bounding_box,
            "segmentation": self.segmentation,
            "mask_ref": self.mask_ref,
            "sonar_image_ref": image_url,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }
