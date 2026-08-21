# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.config import settings

# ───────────────────────────────────────────────────────────────
# Password Hashing Setup it use brypt for hashing passwords
# ───────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ───────────────────────────────────────────────────────────────
# Return Hash Password
# ───────────────────────────────────────────────────────────────
def hash_password(plain: str) -> str:
    """
    Converts a plain-text password into a secure bcrypt hash.

    Args:
        plain: User's original password.

    Returns:
        Secure hashed password for database storage.
    """
    return pwd_context.hash(plain)

# ───────────────────────────────────────────────────────────────
# Verify Password
# ───────────────────────────────────────────────────────────────

def verify_password(plain: str, hashed: str) -> bool:
    """
    Verifies whether a plain-text password matches its stored hash.

    Args:
        plain: Password entered by the user.
        hashed: Hashed password stored in the database.

    Returns:
        True if the password is valid, otherwise False.
    """
    return pwd_context.verify(plain, hashed)


# ───────────────────────────────────────────────────────────────
# Create Access Token
# ───────────────────────────────────────────────────────────────
def create_access_token(owner_id: str) -> str:
    """
    Creates a short-lived JWT access token for an authenticated owner.

    The token contains:
    - owner_id (subject)
    - token type
    - unique token ID (jti)
    - expiration time

    Args:
        owner_id: Authenticated owner's unique ID.

    Returns:
        Encoded JWT access token.
    """

    # Step 1: Calculate token expiration time
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    # Step 2: Build JWT payload
    payload = {
        "sub": owner_id,
        "type": "access",
        "jti": str(uuid.uuid4()),
        "exp": expire,
    }

    # Step 3: Encode and return JWT
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


# ───────────────────────────────────────────────────────────────
# Create Refresh Token
# ───────────────────────────────────────────────────────────────
def create_refresh_token(owner_id: str) -> str:
    """
    Creates a long-lived JWT refresh token.

    This token is used to generate new access tokens without
    requiring the owner to log in again.

    Args:
        owner_id: Authenticated owner's unique ID.

    Returns:
        Encoded JWT refresh token.
    """

    # Step 1: Calculate token expiration time
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )

    # Step 2: Build JWT payload
    payload = {
        "sub": owner_id,
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "exp": expire,
    }

    # Step 3: Encode and return JWT
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


# ───────────────────────────────────────────────────────────────
# Create Reset Token
# ───────────────────────────────────────────────────────────────
def create_reset_token(owner_id: str) -> str:
    """
    Creates a short-lived password reset token.

    Used during the forgot-password flow to securely
    verify reset requests.

    Args:
        owner_id: Owner requesting a password reset.

    Returns:
        Encoded JWT reset token.
    """

    # Step 1: Calculate token expiration time
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.RESET_TOKEN_EXPIRE_MINUTES
    )

    # Step 2: Build JWT payload
    payload = {
        "sub": owner_id,
        "type": "reset",
        "jti": str(uuid.uuid4()),
        "exp": expire,
    }

    # Step 3: Encode and return JWT
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


# ───────────────────────────────────────────────────────────────
# Decode Token
# ───────────────────────────────────────────────────────────────
def decode_token(token: str, expected_type: str) -> str:
    """
    Validates and decodes a JWT token.

    The function verifies:
    - token signature
    - expiration
    - expected token type
    - owner ID exists

    Args:
        token: JWT token to decode.
        expected_type: Required token type.

    Returns:
        Owner ID stored in the token.

    Raises:
        ValueError: If the token is invalid, expired,
        has the wrong type, or is missing required data.
    """
    try:
        # Step 1: Decode JWT
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )

        # Step 2: Validate token type
        if payload.get("type") != expected_type:
            raise ValueError("Wrong token type")

        # Step 3: Extract owner ID
        owner_id = payload.get("sub")

        # Step 4: Ensure owner ID exists
        if not owner_id:
            raise ValueError("Missing subject in token")

        # Step 5: Return owner ID
        return owner_id

    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")


# ───────────────────────────────────────────────────────────────
# Decode Token With JTI
# ───────────────────────────────────────────────────────────────
def decode_token_with_jti(token: str, expected_type: str) -> tuple[str, str, datetime]:
    """
    Validates a JWT token and returns the owner ID,
    token ID (jti), and expiration time.

    Used by logout and refresh flows where token
    revocation must be tracked.

    Args:
        token: JWT token to decode.
        expected_type: Required token type.

    Returns:
        Tuple containing:
            - owner_id
            - token jti
            - expiration datetime

    Raises:
        ValueError: If the token is invalid,
        expired, wrong type, or missing data.
    """
    try:
        # Step 1: Decode JWT
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )

        # Step 2: Validate token type
        if payload.get("type") != expected_type:
            raise ValueError("Wrong token type")

        # Step 3: Extract owner ID
        owner_id = payload.get("sub")

        if not owner_id:
            raise ValueError("Missing subject in token")

        # Step 4: Extract token ID
        jti = payload.get("jti")

        if not jti:
            raise ValueError("Token missing jti")

        # Step 5: Convert expiration timestamp
        expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)

        # Step 6: Return decoded information
        return owner_id, jti, expires_at

    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
