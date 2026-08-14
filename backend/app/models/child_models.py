from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, func
from app.database.child_db import ChildBase
import uuid

def new_uuid():
    return str(uuid.uuid4())

# NOTE: Owner is intentionally NOT in Child DB.
# Auth (Owner table) lives in Parent DB only.
# Child DB only stores business data.

class ChildCustomer(ChildBase):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=new_uuid)
    owner_id = Column(String, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(255), unique=True, nullable= True)
    phone = Column(String(20))
    address = Column(Text)
    gst_number = Column(String(20))
    notes = Column(Text)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ChildTransaction(ChildBase):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=new_uuid)
    customer_id = Column(String, nullable=False, index=True)
    owner_id = Column(String, nullable=False, index=True)
    type = Column(String(2), nullable=False)
    amount = Column(Numeric, nullable=True)      
    note = Column(Text)
    invoice_number = Column(String(100))
    is_edited = Column(Boolean, nullable=False, default=False, server_default="false") 
    entry_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ChildRestoreRequest(ChildBase):
    __tablename__ = "restore_requests"

    id = Column(String, primary_key=True, default=new_uuid)
    owner_id = Column(String, nullable=False, index=True)
    requested_by_user_id = Column(String, nullable=True)
    table_name = Column(String(100), nullable=False)
    record_id = Column(String, nullable=False)
    status = Column(String(20), default="pending")

    customer_note = Column(Text, nullable=True)     # message the customer attached
    owner_response = Column(Text, nullable=True)     # owner's reply when resolving
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

class RevokedToken(ChildBase):
    __tablename__ = "revoked_tokens"

    id = Column(String, primary_key=True)          # uuid string
    jti = Column(String, unique=True, index=True, nullable=False)
    owner_id = Column(String, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)  # when it'd have expired anyway — lets you clean up old rows later
    revoked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))