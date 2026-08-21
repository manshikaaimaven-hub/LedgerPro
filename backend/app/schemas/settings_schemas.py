"""
schemas/settings_schemas.py
----------------------------
Pydantic schemas for the Settings-page endpoints:
  - Owner profile view/update
  - Business list (admin) items
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class OwnerProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    business_name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None


class BusinessListItem(BaseModel):
    id: str
    business_name: str
    full_name: str
    username: str
    email: str
    phone: Optional[str] = None
    city: Optional[str] = None
    is_active: bool
    is_deleted: bool = False
    can_restore: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class VerifyDeletePasscodeRequest(BaseModel):
    """
    Request body for verifying the deletion passcode.

    passcode:
        The last 4 digits of the target owner's registered
        mobile number, entered by the admin/owner requesting
        the deletion.
    """
    passcode: str = Field(..., min_length=4, max_length=4)


class DeleteTargetProfile(BaseModel):
    """
    Minimal profile returned after passcode verification, shown
    to the admin before they confirm the actual deletion.
    """
    id: str
    full_name: str
    business_name: str
    city: Optional[str] = None
    phone_last4: str
    status: Optional[Literal["deleted_by_me"]] = None

    class Config:
        from_attributes = True