import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc

from app.db.database import SessionLocal, engine, Base
import hashlib
import secrets
from app.db.models import MissionModel, TargetModel, ObservationModel, SonarImageModel, UserModel
from app.utils.bool_utils import parse_bool

logger = logging.getLogger("sonar_repository")

def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Hashes password using PBKDF2-HMAC-SHA256 with a unique salt."""
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}${key.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Verifies password against stored PBKDF2 hash."""
    try:
        if not stored_hash or "$" not in stored_hash:
            return False
        salt, key_hex = stored_hash.split("$", 1)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return secrets.compare_digest(key.hex(), key_hex)
    except Exception:
        return False

def init_tables():
    """Initializes database schema tables, ensuring all tables and columns exist without dropping any data."""
    try:
        with engine.connect() as conn:
            from sqlalchemy import inspect, text
            inspector = inspect(engine)
            if inspector.has_table("targets"):
                columns = [c["name"] for c in inspector.get_columns("targets")]
                # Migrate any missing columns non-destructively; NEVER drop tables
                if "segmentation" not in columns:
                    conn.execute(text("ALTER TABLE targets ADD COLUMN IF NOT EXISTS segmentation JSON;"))
                if "bounding_box" not in columns:
                    conn.execute(text("ALTER TABLE targets ADD COLUMN IF NOT EXISTS bounding_box JSON;"))
                if "image_id" not in columns:
                    conn.execute(text("ALTER TABLE targets ADD COLUMN IF NOT EXISTS image_id VARCHAR(64);"))
                if "shadow_verified" not in columns:
                    conn.execute(text("ALTER TABLE targets ADD COLUMN IF NOT EXISTS shadow_verified BOOLEAN DEFAULT FALSE;"))
                conn.commit()

            if inspector.has_table("sonar_images"):
                s_columns = [c["name"] for c in inspector.get_columns("sonar_images")]
                if "storage_key" not in s_columns:
                    conn.execute(text("ALTER TABLE sonar_images ADD COLUMN IF NOT EXISTS storage_key VARCHAR(512);"))
                conn.commit()

            if inspector.has_table("missions"):
                m_columns = [c["name"] for c in inspector.get_columns("missions")]
                if "is_active" not in m_columns:
                    conn.execute(text("ALTER TABLE missions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;"))
                conn.commit()

            # Non-destructively add user_id column to support user-scoped workspaces
            for tbl in ["missions", "targets", "observations", "sonar_images"]:
                if inspector.has_table(tbl):
                    tbl_cols = [c["name"] for c in inspector.get_columns(tbl)]
                    if "user_id" not in tbl_cols:
                        conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);"))
                    conn.commit()

        Base.metadata.create_all(bind=engine)

        # Seed pre-configured Tester Account and map legacy unassigned data
        with SessionLocal() as session:
            tester = session.query(UserModel).filter(UserModel.email == "tester@sagar.gov.in").first()
            if not tester:
                tester = UserModel(
                    user_id="USR-TESTER-001",
                    email="tester@sagar.gov.in",
                    password_hash=hash_password("Tester@123"),
                    full_name="Defense Hydrography Tester",
                    role="Lead Marine Analyst",
                    is_demo=True
                )
                session.add(tester)
                session.commit()
                logger.info("Default tester account seeded: tester@sagar.gov.in / Tester@123")

            # Associate any unassigned records with the tester account
            session.query(MissionModel).filter(MissionModel.user_id == None).update({"user_id": "USR-TESTER-001"})
            session.query(TargetModel).filter(TargetModel.user_id == None).update({"user_id": "USR-TESTER-001"})
            session.query(ObservationModel).filter(ObservationModel.user_id == None).update({"user_id": "USR-TESTER-001"})
            session.query(SonarImageModel).filter(SonarImageModel.user_id == None).update({"user_id": "USR-TESTER-001"})
            session.commit()

        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing tables: {e}")

class SonarRepository:
    """
    Data Access Repository for Hydrographic Survey System.
    Handles persistence in PostgreSQL database and Neon Object Storage (sagar-images).
    """

    @staticmethod
    def get_session() -> Session:
        return SessionLocal()

    @classmethod
    def save_sonar_image(cls, image_id: str, filename: str, mime_type: str, raw_bytes: bytes, user_id: Optional[str] = None) -> SonarImageModel:
        """
        Saves sonar image into Neon Object Storage ('sagar-images' private bucket)
        and persists metadata into Neon PostgreSQL.
        """
        from app.services.s3_storage import s3_storage

        # S3 object key in sagar-images
        storage_key = f"images/{image_id}_{filename}"
        s3_key = s3_storage.upload_file(raw_bytes, storage_key, mime_type=mime_type)

        with cls.get_session() as session:
            img = session.query(SonarImageModel).filter(SonarImageModel.image_id == image_id).first()
            if not img:
                img = SonarImageModel(
                    image_id=image_id,
                    user_id=user_id,
                    filename=filename,
                    mime_type=mime_type,
                    storage_key=s3_key or storage_key,
                    image_bytes=None  # Image binary lives in Neon Object Storage
                )
                session.add(img)
            else:
                img.filename = filename
                img.mime_type = mime_type
                img.storage_key = s3_key or storage_key
                if user_id:
                    img.user_id = user_id
            session.commit()
            session.refresh(img)
            return img

    @classmethod
    def create_user(cls, email: str, password: str, full_name: str, role: str) -> Dict[str, Any]:
        """Registers a new user in Neon PostgreSQL with independent data workspace."""
        with cls.get_session() as session:
            clean_email = email.strip().lower()
            existing = session.query(UserModel).filter(UserModel.email == clean_email).first()
            if existing:
                raise ValueError(f"An account with email '{clean_email}' already exists.")

            import uuid
            user_id = f"USR-{uuid.uuid4().hex[:10].upper()}"
            user = UserModel(
                user_id=user_id,
                email=clean_email,
                password_hash=hash_password(password),
                full_name=full_name.strip() or "Marine Specialist",
                role=role.strip() if role else "Lead Marine Analyst",
                is_demo=False
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            return user.to_dict()

    @classmethod
    def authenticate_user(cls, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticates user against Neon PostgreSQL."""
        with cls.get_session() as session:
            clean_email = email.strip().lower()
            user = session.query(UserModel).filter(UserModel.email == clean_email).first()
            if not user or not verify_password(password, user.password_hash):
                return None
            return user.to_dict()

    @classmethod
    def get_user(cls, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves user profile from Neon PostgreSQL."""
        with cls.get_session() as session:
            user = session.query(UserModel).filter(UserModel.user_id == user_id).first()
            return user.to_dict() if user else None

    @classmethod
    def delete_user_and_all_data(cls, user_id: str) -> bool:
        """
        Permanently deletes user account, all associated missions, targets, observations in Neon PostgreSQL,
        and all image files in Neon Object Storage (sagar-images).
        """
        from app.services.s3_storage import s3_storage

        with cls.get_session() as session:
            user = session.query(UserModel).filter(UserModel.user_id == user_id).first()
            if not user:
                return False

            if user.is_demo:
                raise ValueError("Demo tester account is protected and cannot be deleted.")

            # 1. Delete all images from Neon Object Storage ('sagar-images')
            user_images = session.query(SonarImageModel).filter(SonarImageModel.user_id == user_id).all()
            for img in user_images:
                if img.storage_key:
                    try:
                        s3_storage.delete_file(img.storage_key)
                    except Exception as e:
                        logger.warning(f"Error deleting object {img.storage_key} from S3: {e}")

            # 2. Delete database records in Neon PostgreSQL
            session.query(ObservationModel).filter(ObservationModel.user_id == user_id).delete()
            session.query(TargetModel).filter(TargetModel.user_id == user_id).delete()
            session.query(MissionModel).filter(MissionModel.user_id == user_id).delete()
            session.query(SonarImageModel).filter(SonarImageModel.user_id == user_id).delete()
            session.delete(user)
            session.commit()
            logger.info(f"User {user_id} and all associated data permanently deleted from Neon.")
            return True

    @classmethod
    def get_sonar_image(cls, image_id: str) -> Optional[SonarImageModel]:
        """Retrieves sonar image record from PostgreSQL database by image_id."""
        with cls.get_session() as session:
            return session.query(SonarImageModel).filter(SonarImageModel.image_id == image_id).first()

    @classmethod
    def get_sonar_image_bytes(cls, image_id: str) -> Optional[tuple]:
        """
        Retrieves binary image data from Neon Object Storage (or fallback BYTEA).
        Returns tuple: (bytes_data, filename, mime_type)
        """
        from app.services.s3_storage import s3_storage

        with cls.get_session() as session:
            img = session.query(SonarImageModel).filter(SonarImageModel.image_id == image_id).first()
            if not img:
                return None

            # 1. Fetch from Neon Object Storage if storage_key is present
            if img.storage_key:
                s3_data = s3_storage.download_file(img.storage_key)
                if s3_data:
                    return (s3_data, img.filename, img.mime_type or "image/png")

            # 2. Fallback to BYTEA in PostgreSQL if present
            if img.image_bytes:
                return (img.image_bytes, img.filename, img.mime_type or "image/png")

            return None

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
    def get_all_missions(cls, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with cls.get_session() as session:
            query = session.query(MissionModel).options(
                selectinload(MissionModel.targets).selectinload(TargetModel.observations)
            )
            if user_id:
                if user_id == "USR-TESTER-001":
                    query = query.filter((MissionModel.user_id == user_id) | (MissionModel.user_id == None))
                else:
                    query = query.filter(MissionModel.user_id == user_id)
            missions = query.order_by(desc(MissionModel.created_at)).all()
            return [m.to_dict() for m in missions]

    @classmethod
    def get_mission(cls, mission_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with cls.get_session() as session:
            query = session.query(MissionModel).options(
                selectinload(MissionModel.targets).selectinload(TargetModel.observations)
            ).filter(MissionModel.mission_id == mission_id)
            if user_id and user_id != "USR-TESTER-001":
                query = query.filter(MissionModel.user_id == user_id)
            m = query.first()
            return m.to_dict() if m else None

    @classmethod
    def get_active_mission(cls, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Returns the mission currently marked as active for the specified user or generally."""
        with cls.get_session() as session:
            query = (
                session.query(MissionModel)
                .options(selectinload(MissionModel.targets).selectinload(TargetModel.observations))
                .filter(MissionModel.is_active == True)
            )
            if user_id:
                if user_id == "USR-TESTER-001":
                    query = query.filter((MissionModel.user_id == user_id) | (MissionModel.user_id == None))
                else:
                    query = query.filter(MissionModel.user_id == user_id)
            m = query.first()
            return m.to_dict() if m else None

    @classmethod
    def set_active_mission(cls, mission_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Marks specified mission as active and deactivates all others for the user."""
        with cls.get_session() as session:
            target_m = session.query(MissionModel).filter(MissionModel.mission_id == mission_id).first()
            if not target_m:
                return None
            deact_query = session.query(MissionModel).filter(MissionModel.mission_id != mission_id)
            if user_id and user_id != "USR-TESTER-001":
                deact_query = deact_query.filter(MissionModel.user_id == user_id)
            deact_query.update({"is_active": False}, synchronize_session=False)
            target_m.is_active = True
            session.commit()
            session.refresh(target_m)
            return target_m.to_dict()

    @classmethod
    def deactivate_all_missions(cls, user_id: Optional[str] = None) -> bool:
        """Clears active flag from missions."""
        with cls.get_session() as session:
            query = session.query(MissionModel)
            if user_id and user_id != "USR-TESTER-001":
                query = query.filter(MissionModel.user_id == user_id)
            query.update({"is_active": False}, synchronize_session=False)
            session.commit()
            return True

    @classmethod
    def generate_next_mission_id(cls) -> str:
        """
        Calculates the next serial mission ID based on existing missions (e.g. MISSION-001, MISSION-002).
        Never produces random timestamps or hashes.
        """
        import re
        with cls.get_session() as session:
            missions = session.query(MissionModel.mission_id).all()
            highest_num = 0
            for (m_id,) in missions:
                match = re.search(r"MISSION-(\d+)", str(m_id).upper())
                if match:
                    try:
                        num = int(match.group(1))
                        if num > highest_num:
                            highest_num = num
                    except ValueError:
                        pass
            if highest_num == 0:
                highest_num = len(missions)
            return f"MISSION-{highest_num + 1:03d}"

    @classmethod
    def create_serial_mission(cls, ingestion_mode: str = "live", survey_name: Optional[str] = None, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Creates the next sequential serial mission (e.g. MISSION-001, MISSION-002)
        and sets it as active.
        """
        next_id = cls.generate_next_mission_id()
        num_str = next_id.split("-")[-1]
        name = survey_name or f"Survey Mission {num_str}"
        new_mission = {
            "mission_id": next_id,
            "user_id": user_id,
            "survey_name": name,
            "description": f"Sequential acoustic hydrographic survey mission {num_str}.",
            "ingestion_mode": ingestion_mode,
            "status": "in_progress" if ingestion_mode == "live" else "completed",
            "is_active": True
        }
        return cls.create_or_update_mission(new_mission, user_id=user_id)

    @classmethod
    def resolve_target_mission(cls, specified_mission_id: Optional[str] = None, ingestion_mode: str = "live", user_id: Optional[str] = None) -> str:
        """
        Pushes incoming detection data to:
        1. Explicit valid existing mission_id if provided.
        2. Currently selected active mission (if one exists).
        3. ONLY if NO mission is active, creates a new serial-wise mission (e.g. MISSION-002)
           and marks it active.
        """
        # 1. Check if an explicit valid mission was provided and exists
        if specified_mission_id and str(specified_mission_id).strip() not in ["", "None", "MISSION-LIVE", "ALL"]:
            clean_id = str(specified_mission_id).strip()
            existing = cls.get_mission(clean_id, user_id=user_id)
            if existing:
                return clean_id

        # 2. Check if an active mission is currently selected
        active = cls.get_active_mission(user_id=user_id)
        if active:
            return active["mission_id"]

        # 3. No mission is active: create a sequential serial mission and set active
        new_m = cls.create_serial_mission(ingestion_mode=ingestion_mode, user_id=user_id)
        return new_m["mission_id"]

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
    def create_or_update_mission(cls, mission_dict: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        with cls.get_session() as session:
            m_id = mission_dict.get("mission_id") or cls.generate_next_mission_id()
            existing = session.query(MissionModel).filter(MissionModel.mission_id == m_id).first()
            is_act = bool(mission_dict.get("is_active", False))
            target_user_id = user_id or mission_dict.get("user_id")

            if existing:
                existing.survey_name = mission_dict.get("survey_name", existing.survey_name)
                existing.ingestion_mode = mission_dict.get("ingestion_mode", existing.ingestion_mode)
                existing.status = mission_dict.get("status", existing.status)
                if target_user_id and not existing.user_id:
                    existing.user_id = target_user_id
                if "description" in mission_dict:
                    existing.description = mission_dict["description"]
                if "is_active" in mission_dict:
                    existing.is_active = is_act
                    if is_act:
                        deact_q = session.query(MissionModel).filter(MissionModel.mission_id != m_id)
                        if target_user_id and target_user_id != "USR-TESTER-001":
                            deact_q = deact_q.filter(MissionModel.user_id == target_user_id)
                        deact_q.update({"is_active": False}, synchronize_session=False)
            else:
                if is_act:
                    deact_q = session.query(MissionModel)
                    if target_user_id and target_user_id != "USR-TESTER-001":
                        deact_q = deact_q.filter(MissionModel.user_id == target_user_id)
                    deact_q.update({"is_active": False}, synchronize_session=False)
                num_suffix = m_id.split("-")[-1]
                default_name = f"Survey Mission {num_suffix}"
                existing = MissionModel(
                    mission_id=m_id,
                    user_id=target_user_id,
                    survey_name=mission_dict.get("survey_name", default_name),
                    ingestion_mode=mission_dict.get("ingestion_mode", "batch"),
                    status=mission_dict.get("status", "completed"),
                    is_active=is_act,
                    acoustic_freq=mission_dict.get("acoustic_freq", "410 kHz"),
                    swath_width_m=float(mission_dict.get("swath_width_m", 120.0)),
                    depth_m=float(mission_dict.get("depth_m", 84.2)),
                    description=mission_dict.get("description", f"Acoustic hydrographic survey mission {num_suffix}.")
                )
                session.add(existing)
            session.commit()
            session.refresh(existing)
            return existing.to_dict()

    @classmethod
    def get_consolidated_targets(cls, cls_name: Optional[str] = None, status: Optional[str] = None, mission_id: Optional[str] = None, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with cls.get_session() as session:
            query = session.query(TargetModel).options(selectinload(TargetModel.observations))
            if user_id:
                if user_id == "USR-TESTER-001":
                    query = query.filter((TargetModel.user_id == user_id) | (TargetModel.user_id == None))
                else:
                    query = query.filter(TargetModel.user_id == user_id)
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
    def get_all_detections(cls, cls_name: Optional[str] = None, status: Optional[str] = None, target_id: Optional[str] = None, mission_id: Optional[str] = None, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with cls.get_session() as session:
            query = session.query(ObservationModel)
            if user_id:
                if user_id == "USR-TESTER-001":
                    query = query.filter((ObservationModel.user_id == user_id) | (ObservationModel.user_id == None))
                else:
                    query = query.filter(ObservationModel.user_id == user_id)
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
    def insert_detection(cls, det: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Inserts an individual detection/observation into the database.
        Automatically finds or creates the parent physical TargetModel,
        recalculates centroid coordinates & fused confidence, enforcing 1 Target = 1 Record.
        """
        with cls.get_session() as session:
            target_uid = user_id or det.get("user_id")
            target_id = det.get("target_id") or f"TGT-{int(datetime.now().timestamp() * 1000) % 10000:04d}"
            det_id = det.get("id") or f"det_{int(datetime.now().timestamp() * 1000)}"
            cls_name = det.get("class") or det.get("category") or "debris_net"
            conf = float(det.get("confidence", 0.85))
            lat = float(det["latitude"]) if det.get("latitude") is not None else None
            lon = float(det["longitude"]) if det.get("longitude") is not None else None
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
                        user_id=target_uid,
                        survey_name=f"Mission {mission_id}",
                        ingestion_mode="live",
                        status="in_progress",
                        description="Live acoustic survey session."
                    )
                    session.add(m_record)
                    session.flush()
                elif target_uid and not m_record.user_id:
                    m_record.user_id = target_uid

            shadow_status = parse_bool(det.get("shadow_verified"), False)

            # Check for existing parent target
            target = session.query(TargetModel).filter(TargetModel.target_id == target_id).first()
            if not target:
                target = TargetModel(
                    target_id=target_id,
                    user_id=target_uid,
                    mission_id=mission_id,
                    image_id=image_id,
                    target_class=cls_name,
                    label=det.get("target_label") or cls_name.replace("_", " ").title(),
                    latitude=lat,
                    longitude=lon,
                    estimated_size_m=size,
                    fused_confidence=conf,
                    shadow_verified=shadow_status,
                    status=stat,
                    sonar_image_ref=img_ref,
                    bounding_box=det.get("bounding_box"),
                    segmentation=det.get("segmentation"),
                    mask_ref=det.get("mask_ref")
                )
                session.add(target)
                session.flush()
                pass_num = 1
            else:
                if target_uid and not target.user_id:
                    target.user_id = target_uid
                if "shadow_verified" in det and det.get("shadow_verified") is not None:
                    target.shadow_verified = shadow_status
                # Target exists: recalculate pass count and centroid
                existing_obs = session.query(ObservationModel).filter(ObservationModel.target_id == target_id).all()
                pass_num = len(existing_obs) + 1
                all_confs = [o.confidence for o in existing_obs if o.confidence is not None] + [conf]
                all_lats = [o.latitude for o in existing_obs if o.latitude is not None]
                if lat is not None:
                    all_lats.append(lat)
                all_lons = [o.longitude for o in existing_obs if o.longitude is not None]
                if lon is not None:
                    all_lons.append(lon)
                target.fused_confidence = round(max(all_confs) * 0.75 + (sum(all_confs) / len(all_confs)) * 0.25, 2) if all_confs else conf
                target.latitude = round(sum(all_lats) / len(all_lats), 6) if all_lats else None
                target.longitude = round(sum(all_lons) / len(all_lons), 6) if all_lons else None
                if img_ref:
                    target.sonar_image_ref = img_ref
                if image_id:
                    target.image_id = image_id
                if det.get("bounding_box"):
                    target.bounding_box = det.get("bounding_box")
                if det.get("segmentation"):
                    target.segmentation = det.get("segmentation")
                if det.get("mask_ref"):
                    target.mask_ref = det.get("mask_ref")

            obs = session.query(ObservationModel).filter(ObservationModel.id == det_id).first()
            if obs:
                if target_uid and not obs.user_id:
                    obs.user_id = target_uid
                obs.target_id = target_id
                obs.mission_id = mission_id
                obs.image_id = image_id
                obs.pass_number = pass_num
                obs.target_class = cls_name
                obs.confidence = conf
                obs.latitude = lat
                obs.longitude = lon
                obs.estimated_size_m = size
                obs.shadow_verified = shadow_status
                obs.status = stat
                obs.bounding_box = det.get("bounding_box")
                obs.segmentation = det.get("segmentation")
                obs.mask_ref = det.get("mask_ref")
                if img_ref:
                    obs.sonar_image_ref = img_ref
            else:
                obs = ObservationModel(
                    id=det_id,
                    user_id=target_uid,
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
                    shadow_verified=shadow_status,
                    status=stat,
                    bounding_box=det.get("bounding_box"),
                    segmentation=det.get("segmentation"),
                    mask_ref=det.get("mask_ref"),
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
