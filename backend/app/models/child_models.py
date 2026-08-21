"""
child_models.py
---------------
Defines the SQLAlchemy models used by the LedgerPro CHILD database.

The Child DB stores live business and application data belonging to
individual business owners. Each model inherits from ChildBase, which
is defined in child_db.py.

Models in this module:
  - ChildCustomer:
      Stores customer information, including contact details,
      GST information, notes, and soft-delete status.

  - ChildTransaction:
      Stores customer financial transactions such as credit/debit
      entries, amounts, invoice numbers, notes, and entry dates.
      The is_edited flag tracks whether a transaction has been
      modified after its original creation.

  - ChildRestoreRequest:
      Stores requests related to restoring customer or transaction
      records. Tracks the requesting user, affected table/record,
      request status, customer notes, owner responses, and resolution
      time.

  - RevokedToken:
      Stores revoked authentication tokens so that invalidated JWTs
      cannot be reused before their normal expiration time.

Database isolation:
  Each business-related record contains an owner_id where applicable
  so that application queries can restrict data to the authenticated
  owner's business.

ID generation:
  Models that require generated identifiers use UUID strings through
  the new_uuid() helper function.

This module only defines database models and does not create tables.
Table creation is handled separately by the application's table setup
module.
"""

# ───────────────────────────────────────────────────────────────
# Imports
# ───────────────────────────────────────────────────────────────
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Text,
    Numeric,
    func,
)

from app.database.child_db import ChildBase

# ───────────────────────────────────────────────────────────────
# UUID Helper
# ───────────────────────────────────────────────────────────────
def new_uuid():
    """
    Generates a new UUID string for database record identifiers.
    """
    return str(uuid.uuid4())

# ───────────────────────────────────────────────────────────────
# Owner Model
# ───────────────────────────────────────────────────────────────
class ChildOwner(ChildBase):
    """
    Stores business-owner accounts and authentication information.

    Owner records are stored permanently in the Parent DB because
    authentication and business ownership must remain available even
    if the associated Child DB data is deleted.
    """

    __tablename__ = "owners"

    id = Column(String, primary_key=True, default=new_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String(200), nullable=False)
    business_name = Column(String(200), nullable=False)
    phone = Column(String(20))
    city = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())



# ───────────────────────────────────────────────────────────────
# Customer Model
# ───────────────────────────────────────────────────────────────
class ChildCustomer(ChildBase):
    """
    Stores customer information in the Child database.

    Customer records are associated with an owner through owner_id
    and support soft deletion using is_deleted and deleted_at.
    """

    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=new_uuid)
    owner_id = Column(String, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(20))
    address = Column(Text)
    gst_number = Column(String(20))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ───────────────────────────────────────────────────────────────
# Transaction Model
# ───────────────────────────────────────────────────────────────
class ChildTransaction(ChildBase):
    """
    Stores customer transaction records in the Child database.

    The is_edited field indicates whether the transaction has been
    modified after its original creation.
    """

    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=new_uuid)
    customer_id = Column(String, nullable=False, index=True)
    owner_id = Column(String, nullable=False, index=True)
    type = Column(String(2), nullable=False)
    amount = Column(Numeric, nullable=True)      
    note = Column(Text)
    invoice_number = Column(String(100))
    entry_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ───────────────────────────────────────────────────────────────
# Restore Request Model
# ───────────────────────────────────────────────────────────────
class ChildRestoreRequest(ChildBase):
    """
    Stores requests to restore deleted or modified business records.

    Each request identifies the affected table and record and tracks
    its current status until the request is resolved.
    """

    __tablename__ = "restore_requests"

    id = Column(String, primary_key=True, default=new_uuid)
    owner_id = Column(String, nullable=False, index=True)
    requested_by_user_id = Column(String, nullable=True)
    table_name = Column(String(100), nullable=False)
    record_id = Column(String, nullable=False)
    status = Column(String(20), default="pending")
    customer_note = Column(Text, nullable=True)     
    owner_response = Column(Text, nullable=True)    
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())




# ───────────────────────────────────────────────────────────────
# Revoked Token Model
# ───────────────────────────────────────────────────────────────
class RevokedToken(ChildBase):
    """
    Stores revoked JWT identifiers.

    A token is recorded here when it is explicitly revoked.
    The expires_at field allows old revoked-token records to be
    cleaned up after the token would have naturally expired.
    """

    __tablename__ = "revoked_tokens"

    id = Column(String, primary_key=True)         
    jti = Column(String, unique=True, index=True, nullable=False)
    owner_id = Column(String, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)  
    revoked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))