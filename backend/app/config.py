"""
Application Configuration

This module loads all application settings from environment variables
defined in the `.env` file.

It centralizes configuration for:
- Database connections
- JWT authentication
- Token expiration times
- SMTP email settings
- Frontend URL

Using a single settings object keeps configuration organized and avoids
hardcoding sensitive information such as passwords and secret keys.
"""

# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
from pydantic_settings import BaseSettings

# ───────────────────────────────────────────────────────────────
# Application Settings Class
# ───────────────────────────────────────────────────────────────
class Settings(BaseSettings):
    """
    Stores all application configuration loaded from environment variables.

    The application creates a single instance of this class during startup.
    Pydantic automatically reads values from the `.env` file and validates
    their data types.

    Configuration includes:
    - PostgreSQL database connection details.
    - Parent and Child database names.
    - JWT authentication settings.
    - Access, refresh, and password reset token expiration times.
    - SMTP email configuration for sending emails.
    - Frontend application URL.

    Environment File:
        All values are loaded from the `.env` file.

    Attributes:
        DB_USER (str):
            PostgreSQL database username.

        DB_PASS (str):
            PostgreSQL database password.

        DB_HOST (str):
            PostgreSQL server hostname or IP address.

        DB_PORT (int):
            PostgreSQL server port.
            Default: 5432.

        PARENT_DB_NAME (str):
            Name of the Parent Database.

        CHILD_DB_NAME (str):
            Name of the Child Database.

        JWT_SECRET (str):
            Secret key used to sign and verify JWT tokens.

        JWT_ALGORITHM (str):
            Algorithm used for JWT encryption.
            Default: HS256.

        ACCESS_TOKEN_EXPIRE_MINUTES (int):
            Lifetime of access tokens in minutes.
            Default: 15.

        REFRESH_TOKEN_EXPIRE_DAYS (int):
            Lifetime of refresh tokens in days.
            Default: 7.

        RESET_TOKEN_EXPIRE_MINUTES (int):
            Lifetime of password reset tokens in minutes.
            Default: 30.

        SMTP_HOST (str):
            SMTP server hostname.

        SMTP_PORT (int):
            SMTP server port.
            Default: 587.

        SMTP_EMAIL (str):
            Email address used to send application emails.

        SMTP_APP_PASSWORD (str):
            App password used for SMTP authentication.

        FRONTEND_URL (str):
            Frontend application URL used in emails and redirects.
            Default: http://localhost:3000.
    """

    # One PostgreSQL server shared by both databases
    DB_USER: str
    DB_PASS: str
    DB_HOST: str
    DB_PORT: int = 5432

    # Database names
    PARENT_DB_NAME: str
    CHILD_DB_NAME: str

    # JWT Configuration
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # SMTP Email Configuration
    SMTP_HOST: str
    SMTP_PORT: int = 587
    SMTP_EMAIL: str
    SMTP_APP_PASSWORD: str
    FRONTEND_URL: str = "http://localhost:3000"

    BREVO_API_KEY: str
    BREVO_FROM_EMAIL: str
    BREVO_FROM_NAME: str = "LedgerPro"

    class Config:
        """Load environment variables from the .env file."""
        env_file = ".env"

settings = Settings()