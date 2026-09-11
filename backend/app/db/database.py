import os
import logging
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("sonar_database")
logging.basicConfig(level=logging.INFO)

# Native .env / .env.local loader
for env_candidate in [
    os.path.join(os.path.dirname(__file__), "..", "..", ".env.local"),
    os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
    os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env.local"),
    os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"),
    os.path.join(os.getcwd(), ".env.local"),
    os.path.join(os.getcwd(), ".env")
]:
    if os.path.exists(env_candidate):
        try:
            with open(env_candidate, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        # Do not overwrite if already set in process environment
                        if k.strip() not in os.environ:
                            os.environ[k.strip()] = v.strip().strip("'\"")
        except Exception:
            pass

# Primary database configured for PostgreSQL; can be overridden by DATABASE_URL env var
DEFAULT_POSTGRES_URL = "postgresql://postgres:postgres@localhost:5432/sonar_db"
raw_db_url = os.getenv("DATABASE_URL", "").strip()

if raw_db_url:
    # Heroku/Render/Supabase/Neon compatibility: rewrite postgres:// to postgresql://
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)
    DATABASE_URL = raw_db_url
else:
    DATABASE_URL = DEFAULT_POSTGRES_URL

# Handle environments where port 5432 is blocked (transparent Neon WSS fallback)
final_db_url = DATABASE_URL
if "neon.tech" in DATABASE_URL:
    try:
        parsed = urlparse(DATABASE_URL)
        neon_host = parsed.hostname
        neon_port = parsed.port or 5432

        from app.db.neon_bridge import is_tcp_port_reachable, ensure_neon_bridge

        if not is_tcp_port_reachable(neon_host, neon_port, timeout=2.0):
            logger.info(f"Direct TCP port {neon_port} to Neon appears restricted by local network. Activating Neon WSS bridge over port 443...")
            bridge_port = ensure_neon_bridge(neon_host, neon_port)

            # Rewrite URL to connect to local bridge with sslmode=disable (TLS terminates over WSS on port 443)
            query_params = dict(parse_qsl(parsed.query))
            query_params["sslmode"] = "disable"
            query_params.pop("channel_binding", None)

            netloc = f"{parsed.username}:{parsed.password}@127.0.0.1:{bridge_port}"
            final_db_url = urlunparse((
                parsed.scheme,
                netloc,
                parsed.path,
                parsed.params,
                urlencode(query_params),
                parsed.fragment
            ))
            logger.info(f"Routing database traffic via local Neon bridge on port {bridge_port}")
        else:
            logger.info("Direct TCP connection to Neon PostgreSQL verified.")
    except Exception as e:
        logger.warning(f"Neon connectivity check bypassed ({e}). Using configured URL.")

logger.info(f"Configuring Database with URL scheme: {final_db_url.split('://')[0]}://...")

def create_db_engine(url: str):
    """Creates a SQLAlchemy PostgreSQL engine with robust pooling and auto-recovery."""
    return create_engine(
        url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # Automatically ping and reconnect dropped connections
        pool_recycle=300,
        connect_args={"connect_timeout": 10},
        echo=False
    )

engine = create_db_engine(final_db_url)
try:
    with engine.connect() as conn:
        logger.info("Successfully connected to PostgreSQL database!")
except Exception as e:
    target_host = final_db_url.split("@")[-1] if "@" in final_db_url else final_db_url
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
