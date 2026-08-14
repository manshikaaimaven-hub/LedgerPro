"""
Pydantic schemas for customer authentication and invitation flows.

This module defines the request and response models used in the
customer authentication system. The flow allows an owner to invite
a customer, preview the invitation, create a new customer account
or link an existing account, authenticate the customer, and return
the businesses associated with that customer account.

Schemas:
- InviteResponse: Response returned after generating an invite link.
- InvitePreviewResponse: Information displayed before customer signup.
- CustomerSignupRequest: Request used to create a new customer account.
- CustomerLoginRequest: Request used to authenticate a customer.
- CustomerTokenResponse: Authentication response containing an access token.
- LinkedBusiness: Represents a business linked to the customer's account.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from typing import Optional

from pydantic import BaseModel, Field


# ───────────────────────────────────────────────────────────────
# Invite Response Schema
# ───────────────────────────────────────────────────────────────
class InviteResponse(BaseModel):
    """
    Response returned after generating a customer invitation.

    Attributes:
        invite_token: JWT invite token.
        invite_link: Complete invitation URL.
        expires_in_hours: Number of hours until the invitation expires.
    """

    invite_token: str
    invite_link: str
    expires_in_hours: int


# ───────────────────────────────────────────────────────────────
# Invite Preview Response Schema
# ───────────────────────────────────────────────────────────────
class InvitePreviewResponse(BaseModel):
    """
    Response displayed before the customer signs up.

    It allows the frontend to determine whether the customer
    should create a new account or log in to link an existing one.

    Attributes:
        customer_name: Name of the invited customer.
        business_name: Name of the inviting business.
        email: Customer's email address.
        account_already_exists: Indicates whether the customer
            already has an account.
    """

    customer_name: str
    business_name: str
    email: str
    account_already_exists: bool


# ───────────────────────────────────────────────────────────────
# Customer Signup Request Schema
# ───────────────────────────────────────────────────────────────
class CustomerSignupRequest(BaseModel):
    """
    Request schema used to create a new customer account.

    Used only when the invited customer does not already
    have an existing account.

    Attributes:
        invite_token: Customer invitation token.
        username: Username chosen by the customer.
        password: Password chosen by the customer.
    """

    invite_token: str
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=4)


# ───────────────────────────────────────────────────────────────
# Customer Login Request Schema
# ───────────────────────────────────────────────────────────────
class CustomerLoginRequest(BaseModel):
    """
    Request schema used to authenticate a customer.

    Attributes:
        username: Customer's username.
        password: Customer's password.
    """

    username: str
    password: str


# ───────────────────────────────────────────────────────────────
# Customer Token Response Schema
# ───────────────────────────────────────────────────────────────
class CustomerTokenResponse(BaseModel):
    """
    Response returned after successful customer authentication.

    Attributes:
        access_token: JWT access token.
        token_type: Authentication scheme.
        full_name: Customer's full name.
    """

    access_token: str
    token_type: str = "bearer"
    full_name: str


# ───────────────────────────────────────────────────────────────
# Linked Business Schema
# ───────────────────────────────────────────────────────────────
class LinkedBusiness(BaseModel):
    """
    Represents a business linked to the authenticated
    customer account.

    Attributes:
        owner_id: Unique ID of the business owner.
        business_name: Name of the business.
        customer_name: Customer's name within that business.
    """

    owner_id: str
    business_name: str
    customer_name: str