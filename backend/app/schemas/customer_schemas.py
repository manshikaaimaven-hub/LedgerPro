"""
Customer-related request and response schemas.

This module defines the Pydantic models used by the customer API.
These schemas validate incoming customer requests, serialize
customer data returned by the API, and define request/response
models for customer-specific operations such as logout and
invitation link generation.

Schemas:
- CustomerCreate: Validates data required to create a customer.
- CustomerUpdate: Validates fields for updating a customer.
- CustomerResponse: Represents customer details returned by the API.
- LogoutRequest: Request body for customer logout.
- InviteResponse: Response returned after generating an invite link.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ───────────────────────────────────────────────────────────────
# Customer Create Schema
# ───────────────────────────────────────────────────────────────
class CustomerCreate(BaseModel):
    """
    Request schema used to create a new customer.

    Attributes:
        name: Customer's full name.
        email: Customer's email address.
        phone: Customer's phone number.
        address: Optional customer address.
        gst_number: Optional GST number.
        notes: Optional notes about the customer.
    """

    name: str
    phone: str
    address: Optional[str] = None
    gst_number: Optional[str] = None
    notes: Optional[str] = None


# ───────────────────────────────────────────────────────────────
# Customer Update Schema
# ───────────────────────────────────────────────────────────────
class CustomerUpdate(BaseModel):
    """
    Request schema used to update an existing customer.

    All fields are optional so only the provided values
    are updated.

    Attributes:
        name: Updated customer name.
        email: Updated email address.
        phone: Updated phone number.
        address: Updated address.
        gst_number: Updated GST number.
        notes: Updated customer notes.
    """

    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    notes: Optional[str] = None


# ───────────────────────────────────────────────────────────────
# Customer Response Schema
# ───────────────────────────────────────────────────────────────
class CustomerResponse(BaseModel):
    """
    Response schema returned for customer operations.

    Contains customer information along with the current
    outstanding balance.

    Attributes:
        id: Unique customer ID.
        name: Customer's full name.
        email: Customer's email address.
        phone: Customer's phone number.
        address: Customer's address.
        gst_number: Customer's GST number.
        notes: Additional notes.
        created_at: Timestamp when the customer was created.
        balance: Current customer balance.
    """

    id: str
    name: str
    phone: str
    address: Optional[str]
    gst_number: Optional[str]
    notes: Optional[str]
    created_at: datetime
    balance: float = 0.0

    class Config:
        """
        Enables Pydantic to populate this schema directly
        from SQLAlchemy ORM model instances.
        """

        from_attributes = True
