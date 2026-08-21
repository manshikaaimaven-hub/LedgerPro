"""
create_table.py
--------------
Creates all SQLAlchemy tables required by LedgerPro.

This module imports the Parent and Child database models and uses
their respective SQLAlchemy engines to create the database tables.

Database structure:
  - Parent DB: Uses ParentBase and parent_engine.
    Stores permanent owner/account data and backup information.
  - Child DB: Uses ChildBase and child_engine.
    Stores live business data such as customers, transactions,
    app users, and restore requests.

Tables are created only when they do not already exist. Existing
tables are left unchanged.

Functions:
  - create_tables(): Creates all tables for both Parent and Child
    databases.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from app.models import parent_models
from app.models import child_models

from app.database.parent_db import engine as parent_engine
from app.database.child_db import engine as child_engine

# ───────────────────────────────────────────────────────────────
# Create Table
# ───────────────────────────────────────────────────────────────
def create_tables():
    """
    Creates all SQLAlchemy tables for both Parent and Child databases.
    """
    parent_models.ParentBase.metadata.create_all(bind=parent_engine)
    
    child_models.ChildBase.metadata.create_all(bind=child_engine)

    print("✅ Tables created")