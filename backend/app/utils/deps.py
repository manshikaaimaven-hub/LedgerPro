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
from app.models.parent_models import ParentOwner, RevokedToken
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
    owner = parent_db.query(ParentOwner).filter(ParentOwner.id == owner_id).first()

    # Step 5: If the owner does not exist or is inactive, raise an exception
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found or deactivated"
        )

    # Step 6: Return the authenticated owner's ID
    return owner_id
