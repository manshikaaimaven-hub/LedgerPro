"""
parent_models.py
----------------
Defines the SQLAlchemy ORM models used by the LedgerPro PARENT database.

The Parent DB stores permanent account, authentication, backup, audit,
and restoration-related data that must remain available independently
of the Child DB.

Models in this module:
  - ParentOwner:
      Stores business-owner accounts and authentication information,
      including username, email, password, business details, and
      account status.

  - ParentCustomer:
      Stores permanent customer backup records associated with a
      business owner. Customer records can be soft-deleted while
      remaining available in the Parent DB.

  - ParentTransaction:
      Stores permanent transaction records and backups. Transactions
      can be marked as deleted using is_deleted and deleted_at.

  - ParentRestoreRequest:
      Stores restore requests associated with owner business data.
      The request status tracks whether a request is pending,
      approved, or rejected.

  - RevokedToken:
      Stores revoked JWT identifiers so that logged-out tokens,
      particularly refresh tokens, cannot be reused.

  - ParentCustomerAccount:
      Stores the global login identity of a customer. A customer
      account is independent of any single business and can be
      connected to multiple businesses.

  - ParentCustomerOwnerLink:
      Links a customer account to a specific owner's business and
      the corresponding customer record in that owner's Child DB.
      The unique constraint prevents the same customer account from
      being linked to the same owner more than once.

  - DeletedOwner:
      Stores a permanent audit record whenever a business's Child DB
      data is wiped. It records which business was deleted, which
      owner/admin performed the deletion, the deletion reason, and
      the current restore status.

Database separation:
  The Parent DB acts as the permanent data and authentication layer.
  Its data is kept separate from the Child DB so that business data
  can be deleted or wiped from the Child DB without removing the
  corresponding permanent records and audit information.

ID generation:
  Models that require generated identifiers use UUID strings through
  the new_uuid() helper function.

Table creation:
  This module only defines ORM models. The actual database tables are
  created separately using ParentBase.metadata.create_all().

Restore status:
  DeletedOwner.restore_status tracks the business restoration flow:
      none -> requested -> approved/rejected
"""

# ───────────────────────────────────────────────────────────────
# Imports
# ───────────────────────────────────────────────────────────────
import uuid

from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Text,
    Numeric,
    func,
    UniqueConstraint,
)

from app.database.parent_db import ParentBase


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
class ParentOwner(ParentBase):
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
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ───────────────────────────────────────────────────────────────
# Customer Backup Model
# ───────────────────────────────────────────────────────────────
class ParentCustomer(ParentBase):
    """
    Stores permanent customer records and backups in the Parent DB.

    The owner_id field identifies the business that owns the customer.
    Soft deletion is tracked using is_deleted and deleted_at.
    """

    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=new_uuid)
    owner_id = Column(String, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(20))
    address = Column(Text)
    gst_number = Column(String(20))
    notes = Column(Text)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ───────────────────────────────────────────────────────────────
# Transaction Backup Model
# ───────────────────────────────────────────────────────────────
class ParentTransaction(ParentBase):
    """
    Stores permanent transaction records and transaction backups.

    Unlike the Child transaction model, this model keeps deletion
    information using is_deleted and deleted_at so that deleted
    transactions remain available for recovery or audit purposes.
    """

    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=new_uuid)
    customer_id = Column(String, nullable=False, index=True)
    owner_id = Column(String, nullable=False, index=True)
    type = Column(String(2), nullable=False)          
    amount = Column(Numeric(15, 2), nullable=False)
    note = Column(Text)
    invoice_number = Column(String(100))
    entry_date = Column(DateTime(timezone=True), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ───────────────────────────────────────────────────────────────
# Restore Request Model
# ───────────────────────────────────────────────────────────────
class ParentRestoreRequest(ParentBase):
    """
    Stores restore requests in the permanent Parent DB.

    Each request identifies the owner, requesting user, affected
    table and record, and the current restore status.
    """

    __tablename__ = "restore_requests"

    id = Column(String, primary_key=True, default=new_uuid)
    owner_id = Column(String, nullable=False, index=True)
    requested_by_user_id = Column(String, nullable=True)
    table_name = Column(String(100), nullable=False)
    record_id = Column(String, nullable=False)
    status = Column(String(20), default="pending")   
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ───────────────────────────────────────────────────────────────
# Revoked Token Model
# ───────────────────────────────────────────────────────────────
class RevokedToken(ParentBase):
    """
    Stores revoked JWT identifiers in the Parent DB.

    A revoked token is rejected during authentication or token
    refresh, preventing a logged-out token from being reused
    before its normal expiration time.
    """

    __tablename__ = "revoked_tokens"

    id = Column(String, primary_key=True, default=new_uuid)
    jti = Column(String, unique=True, index=True, nullable=False)
    owner_id = Column(String, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)   
    revoked_at = Column(DateTime(timezone=True), server_default=func.now())


# ───────────────────────────────────────────────────────────────
# Deleted Business Audit Model
# ───────────────────────────────────────────────────────────────
class DeletedOwner(ParentBase):
    """
    Stores a permanent audit record for each business deletion.

    One row represents one Child DB wipe event.

    owner_id:
        The business owner whose Child DB data was deleted.

    deleted_by_owner_id:
        The owner/admin who performed the deletion.
        This identifies who is authorized to restore the business.

    restore_status:
        Indicates whether this deleted business has been restored.

        "pending":
            Business is deleted and has not been restored.

        "restored":
            The authorized owner/admin restored the business
            data from Parent DB back into Child DB.

    The record remains permanently in Parent DB.
    """

    __tablename__ = "deleted_owners"

    id = Column(String, primary_key=True, default=new_uuid)
    owner_id = Column(String, nullable=False, index=True)             
    deleted_by_owner_id = Column(String, nullable=False, index=True) 
    reason = Column(Text, nullable=True)
    deleted_at = Column(DateTime(timezone=True), server_default=func.now())
    