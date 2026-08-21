"""
create_database.py
-----------------
Handles PostgreSQL database creation for LedgerPro.

This module connects to the default PostgreSQL `postgres` database
and ensures that the application's required databases exist before
the application starts.

Databases managed by this module:
  - Parent DB: Stores permanent owner/account data and backup data.
  - Child DB: Stores live business data such as customers,
    transactions, app users, and restore requests.

The module does not create tables. Database tables are created
separately using the SQLAlchemy models and their respective
database base classes.

Functions:
  - create_database_if_not_exists(): Creates a database only if
    it does not already exist.
  - create_all_databases(): Ensures both Parent and Child
    databases are available.
"""

# ───────────────────────────────────────────────────────────────
# Imports
# ───────────────────────────────────────────────────────────────
from sqlalchemy import create_engine, text

from app.config import settings


# ───────────────────────────────────────────────────────────────
# Database Creation Helper
# ───────────────────────────────────────────────────────────────
def create_database_if_not_exists(db_name: str):
    """
    Creates the specified PostgreSQL database if it does not already exist.

    The connection is made to the default 'postgres' database because
    PostgreSQL does not allow CREATE DATABASE to be executed while
    connected to the database being created.
    """

    # ─────────────────────────────────────────────────────────────
    # PostgreSQL Admin Database Connection
    # ─────────────────────────────────────────────────────────────
    admin_url = (
        f"postgresql+psycopg2://"
        f"{settings.DB_USER}:"
        f"{settings.DB_PASS}@"
        f"{settings.DB_HOST}:"
        f"{settings.DB_PORT}/postgres"
    )

    engine = create_engine(admin_url)

    # ─────────────────────────────────────────────────────────────
    # Check Database Existence and Create if Required
    # ─────────────────────────────────────────────────────────────
    with engine.connect() as conn:

        # End the current transaction before executing CREATE DATABASE.
        conn.execute(text("COMMIT"))

        # Check whether the requested database already exists.
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :db_name"),
            {"db_name": db_name},
        ).scalar()

        # Create the database only when it does not already exist.
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))
            print(f"✅ Created database: {db_name}")
        else:
            print(f"ℹ️ Database already exists: {db_name}")


# ───────────────────────────────────────────────────────────────
# Create Application Databases
# ───────────────────────────────────────────────────────────────
def create_all_databases():
    """
    Ensures that both application databases exist.

    Creates:
      - Parent database for permanent/backup data
      - Child database for live business data
    """

    create_database_if_not_exists(settings.PARENT_DB_NAME)
    create_database_if_not_exists(settings.CHILD_DB_NAME)