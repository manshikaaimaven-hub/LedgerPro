"""
Pydantic schemas for owner authentication and account management.

This module defines the request and response models used by the
owner authentication API. These schemas support owner registration,
login, token refresh, password reset, logout, account information,
and password change operations.

Schemas:
- SignupRequest: Request to register a new owner account.
- LoginRequest: Request to authenticate an owner.
- TokenResponse: Authentication response containing JWT tokens.
- RefreshRequest: Request to generate a new access token.
- ForgotPasswordRequest: Request to initiate password reset.
- ResetPasswordRequest: Request to set a new password.
- LogoutRequest: Request to revoke authentication tokens.
- OwnerOut: Owner information returned by the API.
- ChangePasswordRequest: Request to update the owner's password.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from typing import Optional

from pydantic import BaseModel, EmailStr


# ───────────────────────────────────────────────────────────────
# Owner Signup Request Schema
# ───────────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    """
    Request schema used to register a new owner account.

    Attributes:
        username: Unique username.
        email: Owner's email address.
        password: Account password.
        full_name: Owner's full name.
        business_name: Name of the business.
        phone: Contact phone number.
        city: Business city.
    """

    username: str
    email: EmailStr
    password: str
    full_name: str
    business_name: str
    phone: Optional[str] = None
    city: Optional[str] = None


# ───────────────────────────────────────────────────────────────
# Owner Login Request Schema
# ───────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    """
    Request schema used to authenticate an owner.

    Attributes:
        username: Owner's username.
        password: Owner's password.
    """

    username: str
    password: str


# ───────────────────────────────────────────────────────────────
# Owner Response Schema
# ───────────────────────────────────────────────────────────────
class OwnerOut(BaseModel):
    """
    Response schema representing an owner account.

    Attributes:
        id: Unique owner ID.
        username: Owner's username.
        email: Owner's email address.
        full_name: Owner's full name.
        business_name: Business name.
        phone: Contact phone number.
        city: Business city.
    """

    id: str
    username: str
    email: str
    full_name: str
    business_name: str
    phone: str
    city: str

    class Config:
        """
        Enables Pydantic to populate this schema directly
        from SQLAlchemy ORM model instances.
        """

        from_attributes = True


# ───────────────────────────────────────────────────────────────
# Token Response Schema
# ───────────────────────────────────────────────────────────────
class TokenResponse(BaseModel):
    """
    Response returned after successful owner authentication.

    Attributes:
        access_token: JWT access token.
        refresh_token: JWT refresh token.
        token_type: Authentication scheme.
        owner: Authenticated owner's profile.
    """

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    owner: Optional[OwnerOut] = None


# ───────────────────────────────────────────────────────────────
# Refresh Token Request Schema
# ───────────────────────────────────────────────────────────────
class RefreshRequest(BaseModel):
    """
    Request schema used to obtain a new access token.

    Attributes:
        refresh_token: Valid refresh token.
    """

    refresh_token: str


# ───────────────────────────────────────────────────────────────
# Forgot Password Request Schema
# ───────────────────────────────────────────────────────────────
class ForgotPasswordRequest(BaseModel):
    """
    Request schema used to initiate the forgot-password flow.

    Attributes:
        email: Registered owner email address.
    """

    email: EmailStr


# ───────────────────────────────────────────────────────────────
# Reset Password Request Schema
# ───────────────────────────────────────────────────────────────
class ResetPasswordRequest(BaseModel):
    """
    Request schema used to reset an owner's password.

    Attributes:
        token: Password reset token.
        new_password: New password.
    """

    token: str
    new_password: str


# ───────────────────────────────────────────────────────────────
# Logout Request Schema
# ───────────────────────────────────────────────────────────────
class LogoutRequest(BaseModel):
    """
    Request schema used to log an owner out.

    Attributes:
        refresh_token: Refresh token to revoke.
        access_token: Optional access token to revoke.
    """

    refresh_token: str
    access_token: str | None = None


# ───────────────────────────────────────────────────────────────
# Change Password Request Schema
# ───────────────────────────────────────────────────────────────
class ChangePasswordRequest(BaseModel):
    """
    Request schema used to change the owner's password.

    Attributes:
        current_password: Existing password.
        new_password: New password.
    """

    current_password: str
    new_password: str