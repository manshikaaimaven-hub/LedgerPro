"""
child_db.py
-----------
Sets up the SQLAlchemy engine and session for the CHILD database.
The child DB holds all business data:
  - Customers
  - Transactions
  - AppUsers (customer-role logins, Phase 4)
  - RestoreRequests (Phase 3)

Same pattern as parent_db.py — two separate engines, two separate session
factories. Routes that need to touch both DBs will take both as dependencies.
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase
from app.config import settings

class ChildBase(DeclarativeBase):
    pass

CHILD_DB_URL = (
    f"postgresql+psycopg2://"
    f"{settings.DB_USER}:"
    f"{settings.DB_PASS}@"
    f"{settings.DB_HOST}:"
    f"{settings.DB_PORT}/"
    f"{settings.CHILD_DB_NAME}"
)

engine = create_engine(CHILD_DB_URL, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_child_db() -> Session:
    """
    FastAPI dependency for the child database session.
    Yields a session and closes it after the request regardless of outcome.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_child_db_connection():
    """
    Called on app startup to verify child DB connectivity.
    Prints a clear success/failure message to the console.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Child DB connected")
    except Exception as e:
        print(f"❌ Child DB connection failed: {e}")
        raise