import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc

from app.db.database import SessionLocal, engine, Base
from app.db.models import MissionModel, TargetModel, ObservationModel, SonarImageModel

logger = logging.getLogger("sonar_repository")

def init_tables():
    """Initializes database schema tables, handling schema migration for image_id columns."""
    try:
        with engine.connect() as conn:
            from sqlalchemy import inspect
            inspector = inspect(engine)
            if inspector.has_table("targets"):
                columns = [c["name"] for c in inspector.get_columns("targets")]
                if "image_id" not in columns:
                    logger.info("Migrating database schema: Recreating tables to support image_id column...")
                    Base.metadata.drop_all(bind=engine)

        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing tables: {e}")

class SonarRepository:
    """
    Data Access Repository for Hydrographic Survey System.
    Handles persistence in PostgreSQL database.
    """

    @staticmethod
    def get_session() -> Session:
        return SessionLocal()

    @classmethod
    def save_sonar_image(cls, image_id: str, filename: str, mime_type: str, raw_bytes: bytes) -> SonarImageModel:
        """Saves binary image payload (PNG/JPEG byte stream) directly into PostgreSQL BYTEA storage."""
        with cls.get_session() as session:
            img = session.query(SonarImageModel).filter(SonarImageModel.image_id == image_id).first()
            if not img:
                img = SonarImageModel(
                    image_id=image_id,
                    filename=filename,
                    mime_type=mime_type,
                    image_bytes=raw_bytes
                )
                session.add(img)
            else:
                img.filename = filename
                img.mime_type = mime_type
                img.image_bytes = raw_bytes
            session.commit()
            session.refresh(img)
            return img

    @classmethod
    def get_sonar_image(cls, image_id: str) -> Optional[SonarImageModel]:
        """Retrieves binary image record from PostgreSQL storage by image_id."""
        with cls.get_session() as session:
            return session.query(SonarImageModel).filter(SonarImageModel.image_id == image_id).first()

    @classmethod
    def purge_all_data(cls):
        """Purges all records from the database. Zero automatic seed data."""
        with cls.get_session() as session:
            session.query(ObservationModel).delete()
            session.query(TargetModel).delete()
            session.query(MissionModel).delete()
            session.query(SonarImageModel).delete()
            session.commit()
            logger.info("Database records purged.")

    @classmethod
    def get_all_missions(cls) -> List[Dict[str, Any]]:
        with cls.get_session() as session:
            missions = (
                session.query(MissionModel)
                .options(selectinload(MissionModel.targets).selectinload(TargetModel.observations))
                .order_by(desc(MissionModel.created_at))
                .all()
            )
            return [m.to_dict() for m in missions]

    @classmethod
    def get_mission(cls, mission_id: str) -> Optional[Dict[str, Any]]:
        with cls.get_session() as session:
            m = (
                session.query(MissionModel)
                .options(selectinload(MissionModel.targets).selectinload(TargetModel.observations))
                .filter(MissionModel.mission_id == mission_id)
                .first()
            )
            return m.to_dict() if m else None

    @classmethod
    def delete_mission(cls, mission_id: str) -> bool:
        """Deletes a mission and all its cascaded targets/observations from PostgreSQL."""
        with cls.get_session() as session:
            m = session.query(MissionModel).filter(MissionModel.mission_id == mission_id).first()
            if m:
                session.delete(m)
                session.commit()
                return True
            return False

    @classmethod
    def create_or_update_mission(cls, mission_dict: Dict[str, Any]) -> Dict[str, Any]:
        with cls.get_session() as session:
            m_id = mission_dict.get("mission_id", f"MISSION-{int(datetime.now().timestamp())}")
            existing = session.query(MissionModel).filter(MissionModel.mission_id == m_id).first()
            if existing:
                existing.survey_name = mission_dict.get("survey_name", existing.survey_name)
                existing.ingestion_mode = mission_dict.get("ingestion_mode", existing.ingestion_mode)
                existing.status = mission_dict.get("status", existing.status)
                if "description" in mission_dict:
                    existing.description = mission_dict["description"]
            else:
                existing = MissionModel(
                    mission_id=m_id,
                    survey_name=mission_dict.get("survey_name", f"Survey Mission {m_id}"),
                    ingestion_mode=mission_dict.get("ingestion_mode", "batch"),
                    status=mission_dict.get("status", "completed"),
                    acoustic_freq=mission_dict.get("acoustic_freq", "410 kHz"),
                    swath_width_m=float(mission_dict.get("swath_width_m", 120.0)),
                    depth_m=float(mission_dict.get("depth_m", 84.2)),
                    description=mission_dict.get("description", "Imported hydrographic survey batch.")
                )
                session.add(existing)
            session.commit()
            session.refresh(existing)
            return existing.to_dict()

    @classmethod
    def get_consolidated_targets(cls, cls_name: Optional[str] = None, status: Optional[str] = None, mission_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with cls.get_session() as session:
            query = session.query(TargetModel).options(selectinload(TargetModel.observations))
            if cls_name and cls_name != "ALL":
                query = query.filter(TargetModel.target_class == cls_name.lower())
            if status and status != "ALL":
                norm_stat = "confirmed" if status.lower() in ["confirmed", "verified"] else status.lower()
                query = query.filter(TargetModel.status == norm_stat)
            if mission_id and mission_id != "ALL":
                query = query.filter(TargetModel.mission_id == mission_id)
            targets = query.order_by(desc(TargetModel.fused_confidence)).all()
            return [t.to_dict() for t in targets]

    @classmethod
    def get_target(cls, target_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves single physical target with all observations by target_id or observation_id."""
        with cls.get_session() as session:
            target = (
                session.query(TargetModel)
                .options(selectinload(TargetModel.observations))
                .filter(TargetModel.target_id == target_id)
                .first()
            )
            if not target:
                obs = session.query(ObservationModel).filter(ObservationModel.id == target_id).first()
                if obs:
                    target = (
                        session.query(TargetModel)
                        .options(selectinload(TargetModel.observations))
                        .filter(TargetModel.target_id == obs.target_id)
                        .first()
                    )
            return target.to_dict() if target else None

    @classmethod
    def get_all_detections(cls, cls_name: Optional[str] = None, status: Optional[str] = None, target_id: Optional[str] = None, mission_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with cls.get_session() as session:
            query = session.query(ObservationModel)
            if cls_name and cls_name != "ALL":
                query = query.filter(ObservationModel.target_class == cls_name.lower())
            if status and status != "ALL":
                norm_stat = "confirmed" if status.lower() in ["confirmed", "verified"] else status.lower()
                query = query.filter(ObservationModel.status == norm_stat)
            if target_id and target_id != "ALL":
                query = query.filter(ObservationModel.target_id == target_id)
            if mission_id and mission_id != "ALL":
                query = query.filter(ObservationModel.mission_id == mission_id)
            observations = query.order_by(desc(ObservationModel.timestamp)).all()
            return [o.to_dict() for o in observations]

    @classmethod
    def get_detection(cls, detection_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves single detection by observation id or target_id."""
        with cls.get_session() as session:
            obs = session.query(ObservationModel).filter(ObservationModel.id == detection_id).first()
            if not obs:
                obs = session.query(ObservationModel).filter(ObservationModel.target_id == detection_id).first()
            return obs.to_dict() if obs else None

    @classmethod
    def insert_detection(cls, det: Dict[str, Any]) -> Dict[str, Any]:
        """
        Inserts an individual detection/observation into the database.
        Automatically finds or creates the parent physical TargetModel,
        recalculates centroid coordinates & fused confidence, enforcing 1 Target = 1 Record.
        """
        with cls.get_session() as session:
            target_id = det.get("target_id") or f"TGT-{int(datetime.now().timestamp() * 1000) % 10000:04d}"
            det_id = det.get("id") or f"det_{int(datetime.now().timestamp() * 1000)}"
            cls_name = det.get("class") or det.get("category") or "debris_net"
            conf = float(det.get("confidence", 0.85))
            lat = float(det.get("latitude", 32.6500))
            lon = float(det.get("longitude", -117.5500))
            size = float(det.get("estimated_size_m", 3.0))
            stat = det.get("status", "pending_review")
            if stat in ["verified", "confirmed"]:
                stat = "confirmed"
            mission_id = det.get("mission_id", "MISSION-LIVE")
            img_ref = det.get("sonar_image_ref")
            image_id = det.get("image_id")

            # Ensure mission exists
            if mission_id:
                m_record = session.query(MissionModel).filter(MissionModel.mission_id == mission_id).first()
                if not m_record:
                    m_record = MissionModel(
                        mission_id=mission_id,
                        survey_name=f"Mission {mission_id}",
                        ingestion_mode="live",
                        status="in_progress",
                        description="Live acoustic survey session."
                    )
                    session.add(m_record)
                    session.flush()

            # Check for existing parent target
            target = session.query(TargetModel).filter(TargetModel.target_id == target_id).first()
            if not target:
                target = TargetModel(
                    target_id=target_id,
                    mission_id=mission_id,
                    image_id=image_id,
                    target_class=cls_name,
                    label=det.get("target_label") or cls_name.replace("_", " ").title(),
                    latitude=lat,
                    longitude=lon,
                    estimated_size_m=size,
                    fused_confidence=conf,
                    status=stat,
                    sonar_image_ref=img_ref
                )
                session.add(target)
                session.flush()
                pass_num = 1
            else:
                # Target exists: recalculate pass count and centroid
                existing_obs = session.query(ObservationModel).filter(ObservationModel.target_id == target_id).all()
                pass_num = len(existing_obs) + 1
                all_confs = [o.confidence for o in existing_obs] + [conf]
                all_lats = [o.latitude for o in existing_obs] + [lat]
                all_lons = [o.longitude for o in existing_obs] + [lon]
                target.fused_confidence = round(max(all_confs) * 0.75 + (sum(all_confs) / len(all_confs)) * 0.25, 2)
                target.latitude = round(sum(all_lats) / len(all_lats), 6)
                target.longitude = round(sum(all_lons) / len(all_lons), 6)
                if img_ref:
                    target.sonar_image_ref = img_ref
                if image_id:
                    target.image_id = image_id

            obs = session.query(ObservationModel).filter(ObservationModel.id == det_id).first()
            if obs:
                obs.target_id = target_id
                obs.mission_id = mission_id
                obs.image_id = image_id
                obs.pass_number = pass_num
                obs.target_class = cls_name
                obs.confidence = conf
                obs.latitude = lat
                obs.longitude = lon
                obs.estimated_size_m = size
                obs.shadow_verified = bool(det.get("shadow_verified", True))
                obs.status = stat
                obs.bounding_box = det.get("bounding_box")
                if img_ref:
                    obs.sonar_image_ref = img_ref
            else:
                obs = ObservationModel(
                    id=det_id,
                    target_id=target_id,
                    mission_id=mission_id,
                    image_id=image_id,
                    pass_number=pass_num,
                    survey_leg=det.get("survey_leg", f"Swath Pass {pass_num}"),
                    target_class=cls_name,
                    confidence=conf,
                    latitude=lat,
                    longitude=lon,
                    estimated_size_m=size,
                    shadow_verified=bool(det.get("shadow_verified", True)),
                    status=stat,
                    bounding_box=det.get("bounding_box"),
                    sonar_image_ref=img_ref
                )
                session.add(obs)
            session.commit()
            session.refresh(obs)
            session.refresh(target)
            return {
                "detection": obs.to_dict(),
                "target": target.to_dict()
            }

    @classmethod
    def review_target(cls, target_id: str, new_status: str) -> Optional[Dict[str, Any]]:
        """Updates review status for target and all its linked multi-pass observations."""
        norm_status = "confirmed" if new_status in ["confirmed", "verified", "confirm"] else "rejected"
        with cls.get_session() as session:
            target = (
                session.query(TargetModel)
                .options(selectinload(TargetModel.observations))
                .filter(TargetModel.target_id == target_id)
                .first()
            )
            if not target:
                # Try finding target by observation ID
                obs = session.query(ObservationModel).filter(ObservationModel.id == target_id).first()
                if obs:
                    target_id = obs.target_id
                    target = (
                        session.query(TargetModel)
                        .options(selectinload(TargetModel.observations))
                        .filter(TargetModel.target_id == target_id)
                        .first()
                    )

            if not target:
                return None

            target.status = norm_status
            session.query(ObservationModel).filter(ObservationModel.target_id == target_id).update({"status": norm_status})
            session.commit()
            session.refresh(target)
            return target.to_dict()

    @classmethod
    def delete_target(cls, target_id: str) -> bool:
        """Deletes target record and all linked observations from database."""
        with cls.get_session() as session:
            target = session.query(TargetModel).filter(TargetModel.target_id == target_id).first()
            if not target:
                obs = session.query(ObservationModel).filter(ObservationModel.id == target_id).first()
                if obs:
                    target_id = obs.target_id
                    target = session.query(TargetModel).filter(TargetModel.target_id == target_id).first()
            if target:
                session.delete(target)
                session.commit()
                return True
            return False

    @classmethod
    def clear_all(cls) -> Dict[str, Any]:
        """Purges all targets and observations from the database."""
        with cls.get_session() as session:
            obs_cnt = session.query(ObservationModel).count()
            tgt_cnt = session.query(TargetModel).count()
            session.query(ObservationModel).delete()
            session.query(TargetModel).delete()
            session.commit()
            return {
                "status": "success",
                "message": f"Purged {obs_cnt} detections across {tgt_cnt} targets from database.",
                "cleared_detections": obs_cnt,
                "cleared_targets": tgt_cnt
            }

repo = SonarRepository()
