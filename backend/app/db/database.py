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
    """Creates a SQLAlchemy PostgreSQL engine with robust pooling and auto-recovery."""
    return create_engine(
        url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # Automatically ping and reconnect dropped connections
        pool_recycle=300,
        connect_args={"connect_timeout": 5},
        echo=False
    )

engine = create_db_engine(DATABASE_URL)
try:
    with engine.connect() as conn:
        logger.info("Successfully connected to PostgreSQL database!")
except Exception as e:
    target_host = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL
    logger.warning(
        f"Unable to connect to PostgreSQL at '{target_host}' on startup ({e}). "
        f"The server is running in degraded mode and will re-attempt connection when PostgreSQL is started."
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI dependency for yielding database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
