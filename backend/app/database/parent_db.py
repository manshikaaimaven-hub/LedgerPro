"""
parent_db.py
------------
Sets up the SQLAlchemy engine and session for the PARENT database.
The parent DB holds:
  - Owner accounts (the manufacturer who logs in)
  - Backup records (used in Phase 3 for restore)

Why a separate DB?
  Backups need to survive even if the child DB is wiped or a record is
  hard-deleted. Keeping them in a separate DB is the safety net.

get_parent_db() is a FastAPI dependency — use it in route functions like:
    def my_route(db: Session = Depends(get_parent_db)): ...
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase
from app.config import settings

class ParentBase(DeclarativeBase):
    pass

PARENT_DB_URL = (
    f"postgresql+psycopg2://"
    f"{settings.DB_USER}:"
    f"{settings.DB_PASS}@"
    f"{settings.DB_HOST}:"
    f"{settings.DB_PORT}/"
    f"{settings.PARENT_DB_NAME}"
)

engine = create_engine(PARENT_DB_URL, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_parent_db() -> Session:
    """
    FastAPI dependency that yields a database session.
    Automatically closes the session after the request finishes,
    even if an exception occurs (the finally block guarantees cleanup).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_parent_db_connection():
    """
    Called once on app startup to verify the parent DB is reachable.
    If it fails, the app logs the error and exits — better than serving
    requests that will all fail anyway.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Parent DB connected")
    except Exception as e:
        print(f"❌ Parent DB connection failed: {e}")
        raise