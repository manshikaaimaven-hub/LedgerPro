# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
import uuid

from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    status,
)

from app.database.parent_db import get_parent_db
from app.database.child_db import get_child_db

from app.models.parent_models import ParentOwner, RevokedToken
from app.models.child_models import ChildOwner 

from app.schemas.auth_schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    OwnerOut,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
)

from app.utils.auth_utils import (
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_token,
    decode_token_with_jti,
    hash_password,
    verify_password,
)
from app.utils.deps import get_current_owner_id

from app.config import settings

# ───────────────────────────────────────────────────────────────
# Router Setup
# ───────────────────────────────────────────────────────────────
router = APIRouter(prefix="/auth", tags=["Auth"])

# ───────────────────────────────────────────────────────────────
# Rate Limiter Setup- Maximum 5 requests per minute from the same IP
# ───────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ───────────────────────────────────────────────────────────────
# Signup Endpoint -  Register a new owner account
# POST - /auth/signup
# ───────────────────────────────────────────────────────────────
@router.post("/signup", status_code=201)
@limiter.limit("5/minute")
def signup(
    request: Request, 
    body: SignupRequest, 
    parent_db: Session = Depends(get_parent_db),
    child_db: Session = Depends(get_child_db), 
    ):
    """
    Register a new owner account.
    """
    # Step 1: Check whether the username is already registered
    if parent_db.query(ParentOwner).filter(ParentOwner.username == body.username).first():
        raise HTTPException(400, "Username already taken")

    # Step 2: Check whether the email is already registered
    if parent_db.query(ParentOwner).filter(ParentOwner.email == body.email).first():
        raise HTTPException(400, "Email already registered")

    # Step 3: Create the new owner record
    owner_id = str(uuid.uuid4())   
    owner = ParentOwner(
        id=owner_id,
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        business_name=body.business_name,
        phone=body.phone,
        city=body.city,
    )

    # Step 4: Add the owner to the database session
    parent_db.add(owner)

    # Step 5: Commit the new owner record
    parent_db.commit()

    # Step 6: Mirror the owner into Child DB  
    child_owner = ChildOwner(
        id=owner_id,
        username=body.username,
        email=body.email,
        hashed_password=owner.hashed_password,
        full_name=body.full_name,
        business_name=body.business_name,
        phone=body.phone,
        city=body.city,
    )
    # Step 7: Add the owner to the database session
    child_db.add(child_owner)

    # Step 8: Commit the new owner record
    child_db.commit()

    # Step 9: Return a success response
    return {"message": "Account created successfully"}

# ───────────────────────────────────────────────────────────────
# Login Endpoint
# POST - /auth/login
# ───────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(
    request: Request, 
    body: LoginRequest, 
    db: Session = Depends(get_parent_db)
    ):
    """
    Authenticate an owner and generate JWT tokens.
    """
    # Step 1: Find the active owner account by username
    owner = db.query(ParentOwner).filter(
        ParentOwner.username == body.username,
    ).first()

    # Step 2: Verify that the owner exists and the password is correct
    if not owner or not verify_password(body.password, owner.hashed_password):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid username or password"
        )

    # Step 3: Generate access and refresh tokens
    access_token = create_access_token(owner.id)
    refresh_token = create_refresh_token(owner.id)

    # Step 4: Return the authenticated owner's tokens and profile
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        owner=OwnerOut.model_validate(owner)
    )

# ───────────────────────────────────────────────────────────────
# Refresh Token Endpoint
# POST - /auth/refresh
# ───────────────────────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    body: RefreshRequest, 
    db: Session = Depends(get_parent_db)
    ):
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
        # Step 1: Decode and validate the refresh token
        owner_id, jti, _ = decode_token_with_jti(body.refresh_token, expected_type="refresh")

    except ValueError:
        raise HTTPException(401, "Invalid or expired refresh token")

    # Step 2: Check whether the refresh token has been revoked
    if db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
        raise HTTPException(401, "Refresh token has been revoked, please log in again")

    # Step 3: Verify that the owner still exists and is active
    owner = db.query(ParentOwner).filter(
        ParentOwner.id == owner_id,
    ).first()

    # Step 4: Generate new access and refresh tokens
    if not owner:
        raise HTTPException(401, "Owner not found")

    # Step 5: Return the new tokens
    return TokenResponse(
        access_token=create_access_token(owner.id),
        refresh_token=create_refresh_token(owner.id)
    )

# ───────────────────────────────────────────────────────────────
# Logout Endpoint
# POST - /auth/logout
# ───────────────────────────────────────────────────────────────
@router.post("/logout", status_code=200)
def logout(
    body: LogoutRequest, 
    db: Session = Depends(get_parent_db)
    ):
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
        # Step 1: Decode the refresh token and retrieve its owner, JTI, and expiration time
        owner_id, jti, expires_at = decode_token_with_jti(body.refresh_token, expected_type="refresh")

        # Step 2: Revoke the refresh token if it is not already revoked
        if not db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
            db.add(RevokedToken(jti=jti, owner_id=owner_id, expires_at=expires_at))

    except ValueError:
        raise HTTPException(401, "Invalid or expired refresh token")

    # Step 3: Revoke the access token if the frontend provided it
    if body.access_token:
        try:
            a_owner_id, a_jti, a_expires_at = decode_token_with_jti(body.access_token, expected_type="access")
            
            if not db.query(RevokedToken).filter(RevokedToken.jti == a_jti).first():
                db.add(RevokedToken(jti=a_jti, owner_id=a_owner_id, expires_at=a_expires_at))
        except ValueError:
            pass  

    # Step 4: Save all revoked tokens
    db.commit()

    # Step 5: Return a success response
    return {"message": "Logged out successfully"}

# ───────────────────────────────────────────────────────────────
# Forgot Password Endpoint
# POST - /auth/forgot-password
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

    # Step 1: Find the owner account using the submitted email
    owner = db.query(ParentOwner).filter(ParentOwner.email == body.email).first()

    # Step 2: Generate a password reset token if the email exists
    if owner:
        reset_token = create_reset_token(owner.id)

        # Step 3: Build the password reset link
        reset_link = (
            f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        )

        # Step 4: Send the password reset email in the background
        background_tasks.add_task(
            send_password_reset_email,
            owner.email,
            owner.full_name,
            reset_link
        )

    # Step 5: Return the same response regardless of whether the email exists to avoid exposing registered email addresses
    return {"message": "If this email is registered, a reset link has been sent"}


# ───────────────────────────────────────────────────────────────
# Reset Password Endpoint
# POST - /auth/reset-password
# ───────────────────────────────────────────────────────────────
@router.post("/reset-password")
def reset_password(
    body: ResetPasswordRequest,
    db: Session = Depends(get_parent_db)):
    """
    Reset an owner's password using a valid reset token.
    """
    try:
        # Step 1: Decode and validate the password reset token
        owner_id = decode_token(body.token, expected_type="reset")
    except ValueError:
        raise HTTPException(400, "Invalid or expired reset token")

    # Step 2: Find the owner associated with the reset token
    owner = db.query(ParentOwner).filter(ParentOwner.id == owner_id).first()
    if not owner:
        raise HTTPException(404, "Owner not found")

    # Step 3: Hash and update the owner's new password
    owner.hashed_password = hash_password(body.new_password)

    # Step 4: Save the password change
    db.commit()

    # Step 5: Return a success response
    return {"message": "Password updated successfully"}