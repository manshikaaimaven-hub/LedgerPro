"""
models/parent_models.py
-----------------------
SQLAlchemy ORM models for the PARENT database.

Tables defined here:
  - Owner   : The manufacturer/business owner who creates an account
  - Backup  : Snapshot of any record before it's soft-deleted (Phase 3)

DeclarativeBase creates the `Base` that all models inherit from.
Calling Base.metadata.create_all(engine) creates the actual tables.
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database.parent_db import ParentBase

def new_uuid():
    return str(uuid.uuid4())

class ParentOwner(ParentBase):
    __tablename__ = "owners"

    id = Column(String, primary_key=True, default=new_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String(200), nullable=False)
    business_name = Column(String(200), nullable=False)
    phone = Column(String(20))
    city = Column(String(100))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ParentCustomer(ParentBase):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=new_uuid)
    owner_id = Column(String, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    phone = Column(String(20))
    address = Column(Text)
    gst_number = Column(String(20))
    notes = Column(Text)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ParentTransaction(ParentBase):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=new_uuid)
    customer_id = Column(String, nullable=False, index=True)
    owner_id = Column(String, nullable=False, index=True)
    type = Column(String(2), nullable=False)          # "cr" or "dr"
    amount = Column(Numeric(15, 2), nullable=False)
    note = Column(Text)
    invoice_number = Column(String(100))
    entry_date = Column(DateTime(timezone=True), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ParentRestoreRequest(ParentBase):
    __tablename__ = "restore_requests"

    id = Column(String, primary_key=True, default=new_uuid)
    owner_id = Column(String, nullable=False, index=True)
    requested_by_user_id = Column(String, nullable=True)
    table_name = Column(String(100), nullable=False)
    record_id = Column(String, nullable=False)
    status = Column(String(20), default="pending")    # pending / approved / rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ───────────────────────────────────────────────────────────────
# Revoked Token (for logout) — jti blacklist so /auth/refresh
# rejects a refresh token after the user has logged out.
# ───────────────────────────────────────────────────────────────
class RevokedToken(ParentBase):
    __tablename__ = "revoked_tokens"

    id = Column(String, primary_key=True, default=new_uuid)
    jti = Column(String, unique=True, index=True, nullable=False)
    owner_id = Column(String, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)   # when it'd have expired anyway — lets you clean up old rows later
    revoked_at = Column(DateTime(timezone=True), server_default=func.now())



class ParentCustomerAccount(ParentBase):
    """
    ONE login identity for a customer, independent of any owner.
    A person who buys from 3 different textile manufacturers still
    has exactly one row here — which business(es) they can see is
    controlled separately by ParentCustomerOwnerLink below.

    Lives in Parent DB because — like Owner — this is authentication
    data, not one business's mutable ledger data.
    """
    __tablename__ = "customer_accounts"

    id = Column(String, primary_key=True, default=new_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)  # the identity key
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String(200))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ParentCustomerOwnerLink(ParentBase):
    """
    Join table: connects one CustomerAccount to one owner's ledger.

    One row = "this login can see this specific business's Customer
    record". A customer with 3 businesses has 3 rows here, all
    pointing back to the same customer_account_id.
    """
    __tablename__ = "customer_owner_links"

    id = Column(String, primary_key=True, default=new_uuid)
    customer_account_id = Column(String, nullable=False, index=True)  # -> ParentCustomerAccount.id
    owner_id = Column(String, nullable=False, index=True)             # which business
    customer_id = Column(String, nullable=False, index=True)          # that owner's Child DB Customer record
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('customer_account_id', 'owner_id', name='uq_account_owner'),
    )