"""
Authentication Dependencies

This module contains the authentication and authorization helpers
used by protected API routes.

Purpose:
- Authenticate business owners using access tokens.
- Authenticate customer accounts using customer access tokens.
- Verify that tokens are valid and not revoked.
- Ensure the user account is active.
- Control which business data a customer is allowed to access.

These dependencies help keep the application secure by ensuring that
only authorized users can access protected resources.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.parent_db import get_parent_db
from app.models.parent_models import ParentOwner, RevokedToken, ParentCustomerAccount, ParentCustomerOwnerLink
from app.utils.auth_utils import decode_token_with_jti, decode_token

# ───────────────────────────────────────────────────────────────
# HTTPBearer - Expect Authorization: Bearer <token>
# ───────────────────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=True)

customer_bearer_scheme = HTTPBearer(auto_error=True)

# ───────────────────────────────────────────────────────────────
# Authenticate Logged-in Business Owner
# ───────────────────────────────────────────────────────────────
def get_current_owner_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    parent_db: Session = Depends(get_parent_db)
    ) -> str:
    """
    Authenticates the logged-in business owner using an access token.

    This dependency is used by all owner-protected routes. It validates
    the JWT, checks whether the token has been revoked, verifies that
    the owner account is active, and returns the owner's ID.

    Steps:
    1. Extract the access token from the Authorization header.
    2. Decode and validate the JWT.
    3. Check whether the token has been revoked (logged out).
    4. Verify that the owner account exists and is active.
    5. If the owner does not exist or is inactive, raise an exception
    6. Return the authenticated owner's ID.

    Raises:
        HTTPException (401):
            - Token is missing, invalid, or expired.
            - Token has been revoked.
            - Owner account does not exist or is inactive.

    Returns:
        str:
            The authenticated owner's unique ID.
    """
    # Step 1: Extract the access token from the Authorization header.
    token = credentials.credentials

    try:
        # Step 2: Decode Token — now also pulls jti so we can check revocation
        owner_id, jti, _ = decode_token_with_jti(token, expected_type="access")

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Step 3: Check whether the token has been revoked (logged out).
    if parent_db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked, please log in again",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Step 4: Confirm owner still exists and is active
    owner = parent_db.query(ParentOwner).filter(ParentOwner.id == owner_id, ParentOwner.is_active == True).first()

    # Step 5: If the owner does not exist or is inactive, raise an exception
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found or deactivated"
        )

    # Step 6: Return the authenticated owner's ID
    return owner_id

# ───────────────────────────────────────────────────────────────
# Authenticate Logged-in Customer Account
# ───────────────────────────────────────────────────────────────
def get_current_customer_account(
    credentials: HTTPAuthorizationCredentials = Depends(customer_bearer_scheme),
    parent_db: Session = Depends(get_parent_db),
    ) -> dict:
    """
    Authenticates the logged-in customer account using a customer access token.

    This dependency identifies the customer account only. It does not
    determine which business the customer is currently accessing.
    Business access is validated separately by `resolve_customer_link()`.

    Steps:
    1. Extract the customer access token from the Authorization header.
    2. Decode and validate the JWT.
    3. Verify that the customer account exists and is active.
    4. If the owner does not exist or is inactive, raise an exception
    5. Return the customer's basic account information.

    Raises:
        HTTPException (401):
            - Token is invalid or expired.
            - Customer account does not exist or is inactive.

    Returns:
        dict:
            A dictionary containing:
            - customer_account_id
            - email
            - full_name
    """
    # Step 1: Extract the raw JWT string from the credentials object.
    token = credentials.credentials

    try:
        # Step 2: Decode and validate JWT
        account_id = decode_token(token, expected_type="customer_access")
    except ValueError:
        raise HTTPException(401, "Invalid or expired session")

    # Step 3: Confirm the account still exists and is active
    account = parent_db.query(ParentCustomerAccount).filter(
        ParentCustomerAccount.id == account_id,
        ParentCustomerAccount.is_active == True,
    ).first()

    # Step 5: If the owner does not exist or is inactive, raise an exception
    if not account:
        raise HTTPException(401, "Account not found or inactive")

    # Step 6: Return the authenticated owner's ID
    return {"customer_account_id": account.id, "email": account.email, "full_name": account.full_name, "username": account.username}

# ───────────────────────────────────────────────────────────────
# Verify Customer Access to a Business
# ───────────────────────────────────────────────────────────────
def resolve_customer_link(
    owner_id: str, 
    current: dict = Depends(get_current_customer_account),
    parent_db: Session = Depends(get_parent_db),
    ) -> str:
    """
    Verifies that the logged-in customer is linked to the requested business.

    A customer account can be connected to multiple businesses. This
    function checks whether the authenticated customer has permission
    to access the business identified by the provided owner_id.

    Steps:
    1. Find the relationship between the customer account and the owner.
    2. Confirm that the customer is linked to the requested business.
    3. Return the corresponding customer ID for Child Database queries.

    Raises:
        HTTPException (403):
            If the customer is not linked to the requested business.

    Returns:
        str:
            The customer ID associated with the requested business.
    """
    # Step 1: Find the relationship between the customer account and the owner.
    link = parent_db.query(ParentCustomerOwnerLink).filter(
        ParentCustomerOwnerLink.customer_account_id == current["customer_account_id"],
        ParentCustomerOwnerLink.owner_id == owner_id,
    ).first()

    # Step 2: Confirm that the customer is linked to the requested business.
    if not link:
        raise HTTPException(403, "You are not linked to this business")

    # Step 3: Return the corresponding customer ID for Child Database queries.
    return link.customer_id

