import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("sonar_database")
logging.basicConfig(level=logging.INFO)

# Native .env loader
for env_candidate in [
    os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
    os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"),
    os.path.join(os.getcwd(), ".env")
]:
    if os.path.exists(env_candidate):
        try:
            with open(env_candidate, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip().strip("'\"")
        except Exception:
            pass

# Primary database configured for PostgreSQL; can be overridden by DATABASE_URL env var
DEFAULT_POSTGRES_URL = "postgresql://postgres:postgres@localhost:5432/sonar_db"
DEFAULT_SQLITE_URL = "sqlite:///./sonar_db.sqlite3"
raw_db_url = os.getenv("DATABASE_URL", "").strip()

if raw_db_url:
    # Heroku/Render/Supabase compatibility: rewrite postgres:// to postgresql://
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)
    DATABASE_URL = raw_db_url
else:
    DATABASE_URL = DEFAULT_POSTGRES_URL

logger.info(f"Configuring Database with URL scheme: {DATABASE_URL.split('://')[0]}://...")

def create_db_engine(url: str):
    """Creates a SQLAlchemy engine with robust pooling and auto-recovery."""
    if url.startswith("sqlite"):
        return create_engine(
            url,
            connect_args={"check_same_thread": False},
            echo=False
        )
    else:
        # PostgreSQL engine configuration
        return create_engine(
            url,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,  # Automatically reconnect dropped cloud connections (Supabase/Neon)
            pool_recycle=300,
            echo=False
        )

if DATABASE_URL.startswith("sqlite"):
    logger.info(f"Explicit SQLite mode configured: {DATABASE_URL}")
    engine = create_db_engine(DATABASE_URL)
else:
    try:
        engine = create_db_engine(DATABASE_URL)
        with engine.connect() as conn:
            logger.info("Successfully connected to PostgreSQL database!")
    except Exception as e:
        target_host = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL
        err_msg = (
            f"\n"
            f"================================================================================\n"
            f"FATAL DATABASE ERROR: Unable to connect to PostgreSQL at '{target_host}'.\n"
            f"Details: {e}\n"
            f"--------------------------------------------------------------------------------\n"
            f"To prevent data fragmentation / split data across multiple databases,\n"
            f"silent fallback to SQLite is disabled.\n\n"
            f"Please verify that:\n"
            f"  1. PostgreSQL service is running\n"
            f"  2. Credentials in backend/.env are correct\n"
            f"  3. Database 'sonar_db' exists\n\n"
            f"(If you explicitly wish to run in local offline demo mode without PostgreSQL,\n"
            f" set DATABASE_URL=sqlite:///./sonar_db.sqlite3 in your backend/.env file).\n"
            f"================================================================================\n"
        )
        logger.error(err_msg)
        raise RuntimeError(err_msg) from e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI dependency for yielding database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
