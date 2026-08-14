# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database.parent_db import get_parent_db
from app.models.parent_models import ParentOwner, RevokedToken
from app.schemas.auth_schemas import (
    SignupRequest, LoginRequest, TokenResponse,
    RefreshRequest, LogoutRequest,
    ForgotPasswordRequest, ResetPasswordRequest, OwnerOut, ChangePasswordRequest
)
from app.utils.email_utils import send_password_reset_email

from app.utils.auth_utils import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    create_reset_token, decode_token, decode_token_with_jti
)
from app.utils.deps import get_current_owner_id
from app.config import settings
import uuid

# ───────────────────────────────────────────────────────────────
# Router Setup
# ───────────────────────────────────────────────────────────────
router = APIRouter(prefix="/auth", tags=["Auth"])

# ───────────────────────────────────────────────────────────────
# Rate Limiter Setup- Maximum 5 requests per minute from the same IP
# ───────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ───────────────────────────────────────────────────────────────
# Signup Endpoint
# Register a new owner account
# ───────────────────────────────────────────────────────────────
@router.post("/signup", status_code=201)
@limiter.limit("5/minute")
def signup(request: Request, body: SignupRequest, db: Session = Depends(get_parent_db)):
    """
    Register a new owner account.
    """
    if db.query(ParentOwner).filter(ParentOwner.username == body.username).first():
        raise HTTPException(400, "Username already taken")

    if db.query(ParentOwner).filter(ParentOwner.email == body.email).first():
        raise HTTPException(400, "Email already registered")

    owner = ParentOwner(
        id=str(uuid.uuid4()),
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        business_name=body.business_name,
        phone=body.phone,
        city=body.city,
    )

    db.add(owner)
    db.commit()

    return {"message": "Account created successfully"}

# ───────────────────────────────────────────────────────────────
# Login Endpoint
# Log in and receive JWT Tokens
# ───────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_parent_db)):
    """
    Authenticate an owner and generate JWT tokens.
    """
    owner = db.query(ParentOwner).filter(
        ParentOwner.username == body.username,
        ParentOwner.is_active == True
    ).first()

    if not owner or not verify_password(body.password, owner.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")

    return TokenResponse(
        access_token=create_access_token(owner.id),
        refresh_token=create_refresh_token(owner.id),
        owner=OwnerOut.model_validate(owner)
    )

# ───────────────────────────────────────────────────────────────
# Refresh Token Endpoint
# Generate new access & refresh tokens
# ───────────────────────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: RefreshRequest, db: Session = Depends(get_parent_db)):
    """
    Generate a new access token using a valid refresh token.

    Workflow:
    1. Decode and validate the refresh token (also pulls its jti).
    2. Reject if that jti has been revoked (i.e. user logged out).
    3. Verify that the owner account still exists and is active.
    4. Generate new access and refresh tokens.

    Raises:
        HTTPException:
            - 401 if the refresh token is invalid, expired, or revoked.
            - 401 if the owner does not exist or is inactive.
    """
    try:
        owner_id, jti, _ = decode_token_with_jti(body.refresh_token, expected_type="refresh")
    except ValueError:
        raise HTTPException(401, "Invalid or expired refresh token")

    # Step 2: Reject if this refresh token was revoked via logout
    if db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
        raise HTTPException(401, "Refresh token has been revoked, please log in again")

    # Step 3: Verify User Exists
    owner = db.query(ParentOwner).filter(
        ParentOwner.id == owner_id,
        ParentOwner.is_active == True
    ).first()

    if not owner:
        raise HTTPException(401, "Owner not found")

    return TokenResponse(
        access_token=create_access_token(owner.id),
        refresh_token=create_refresh_token(owner.id)
    )

# ───────────────────────────────────────────────────────────────
# Logout Endpoint
# Log out by revoking tokens
# ───────────────────────────────────────────────────────────────
@router.post("/logout", status_code=200)
def logout(body: LogoutRequest, db: Session = Depends(get_parent_db)):
    """
    Log out an owner by revoking their refresh token.

    Steps:
    1. Decode the refresh token to get its owner_id, jti, and expiry.
    2. Store the jti in the RevokedToken table so /auth/refresh will reject it.
    3. The access token isn't blacklisted (it's short-lived and expires on its own) —
       the frontend should also delete both tokens from localStorage immediately.

    Returns:
        dict: Success message.

    Raises:
        HTTPException:
            - 401 if the refresh token is invalid or already expired.
    """
    try:
        owner_id, jti, expires_at = decode_token_with_jti(body.refresh_token, expected_type="refresh")
        if not db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
            db.add(RevokedToken(jti=jti, owner_id=owner_id, expires_at=expires_at))
    except ValueError:
        raise HTTPException(401, "Invalid or expired refresh token")

    # Revoke access token too (optional — only if frontend sends it)
    if body.access_token:
        try:
            a_owner_id, a_jti, a_expires_at = decode_token_with_jti(body.access_token, expected_type="access")
            if not db.query(RevokedToken).filter(RevokedToken.jti == a_jti).first():
                db.add(RevokedToken(jti=a_jti, owner_id=a_owner_id, expires_at=a_expires_at))
        except ValueError:
            pass  # already expired/invalid — nothing to revoke, not an error

    db.commit()
    return {"message": "Logged out successfully"}

# ───────────────────────────────────────────────────────────────
# Forgot Password Endpoint
# Generate a password reset token
# ───────────────────────────────────────────────────────────────
@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(
    request: Request, 
    body: ForgotPasswordRequest,
    background_tasks:BackgroundTasks,
    db: Session = Depends(get_parent_db)):
    """
    Generate a password reset token for a registered email.
    """
    owner = db.query(ParentOwner).filter(ParentOwner.email == body.email).first()

    if owner:
        reset_token = create_reset_token(owner.id)

        reset_link = (
            f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        )

        background_tasks.add_task(
            send_password_reset_email,
            owner.email,
            owner.full_name,
            reset_link
        )

    return {"message": "If this email is registered, a reset link has been sent"}

# ───────────────────────────────────────────────────────────────
# Reset Password Endpoint
# Reset password using reset token
# ───────────────────────────────────────────────────────────────
@router.post("/reset-password")
def reset_password(
    body: ResetPasswordRequest,
    db: Session = Depends(get_parent_db)):
    """
    Reset an owner's password using a valid reset token.
    """
    try:
        owner_id = decode_token(body.token, expected_type="reset")
    except ValueError:
        raise HTTPException(400, "Invalid or expired reset token")

    owner = db.query(ParentOwner).filter(ParentOwner.id == owner_id).first()
    if not owner:
        raise HTTPException(404, "Owner not found")

    owner.hashed_password = hash_password(body.new_password)
    db.commit()

    return {"message": "Password updated successfully"}

# ───────────────────────────────────────────────────────────────
# Change Password Endpoint
# Change password while logged in
# ───────────────────────────────────────────────────────────────
@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    owner_id: str = Depends(get_current_owner_id),
    db: Session = Depends(get_parent_db)
    ):
    """
    Change the logged-in owner's password. Requires the current password
    for verification (this is the Settings-page flow — different from the
    forgot-password/reset-token flow used when the owner is locked out).
    """
    owner = db.query(ParentOwner).filter(ParentOwner.id == owner_id).first()
    if not owner or not verify_password(body.current_password, owner.hashed_password):
        raise HTTPException(400, "Current password is incorrect")

    owner.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "Password updated successfully"}