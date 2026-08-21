"""
parent_db.py
------------
Sets up the SQLAlchemy engine, session factory, and FastAPI dependency
for the PARENT database used by LedgerPro.

The Parent DB stores data that must remain available independently of
the Child DB, including:
  - Owner accounts and authentication data
  - Backup records used for data restoration
  - Permanent records that must survive Child DB deletion

Why a separate Parent DB?
  The Parent DB acts as the permanent safety layer for LedgerPro.
  Child DB data may be deleted or wiped during business deletion,
  while the Parent DB remains available for backup and restoration.

This module provides:
  - ParentBase: SQLAlchemy declarative base for Parent DB models.
  - PARENT_DB_URL: PostgreSQL connection URL for the Parent DB.
  - engine: SQLAlchemy engine used to communicate with the Parent DB.
  - SessionLocal: Session factory for creating Parent DB sessions.
  - get_parent_db(): FastAPI dependency that provides a database
    session to route functions and closes it after each request.
  - test_parent_db_connection(): Verifies Parent DB connectivity
    during application startup.

Example usage in a FastAPI route:
    def my_route(db: Session = Depends(get_parent_db)):
        ...

The Parent DB engine and session are completely separate from the
Child DB engine and session to maintain database-level isolation.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase

from app.config import settings


# ───────────────────────────────────────────────────────────────
# Parent Database Base
# ───────────────────────────────────────────────────────────────
class ParentBase(DeclarativeBase):
    pass


# ───────────────────────────────────────────────────────────────
# Parent Database Connection URL
# ───────────────────────────────────────────────────────────────
PARENT_DB_URL = (
    f"postgresql+psycopg2://"
    f"{settings.DB_USER}:"
    f"{settings.DB_PASS}@"
    f"{settings.DB_HOST}:"
    f"{settings.DB_PORT}/"
    f"{settings.PARENT_DB_NAME}"
)


# ───────────────────────────────────────────────────────────────
# Parent Database Engine
# ───────────────────────────────────────────────────────────────
engine = create_engine(PARENT_DB_URL, echo=False)


# ───────────────────────────────────────────────────────────────
# Parent Database Session Factory
# ───────────────────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ───────────────────────────────────────────────────────────────
# Parent Database Session Dependency
# ───────────────────────────────────────────────────────────────
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

# ───────────────────────────────────────────────────────────────
# Parent Database Connection Test
# ───────────────────────────────────────────────────────────────
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