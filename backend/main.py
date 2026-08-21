# ───────────────────────────────────────────────────────────────
# Import
# ───────────────────────────────────────────────────────────────
import uvicorn
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager

# Database setup
from app.database.create_database import create_all_databases
from app.database.parent_db import test_parent_db_connection
from app.database.child_db import test_child_db_connection
from app.database.create_table import create_tables

# Import database models
from app.models import child_models, parent_models

# Import API routers
from app.routers.auth import router as auth
from app.routers.create_customers import router as customers
from app.routers.transactions import router as transactions
from app.routers.summary import router as Summary
from app.routers.settings import router as Settings

# ---------------------------------------------------------
# Application Lifespan
# Runs once when the application starts and stops.
# ---------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Perform startup and shutdown tasks.

    Startup:
    - Create databases if they do not exist.
    - Test Parent Database connection.
    - Test Child Database connection.
    - Create required database tables.

    Shutdown:
    - Execute cleanup tasks (currently none).
    """

    print("Starting LedgerPro backend...")

    # ---------------------------------------------------------
    # Step 1: Create the required databases.
    # ---------------------------------------------------------
    create_all_databases()

    # ---------------------------------------------------------
    # Step 2: Verify Parent Database connection.
    # ---------------------------------------------------------
    test_parent_db_connection()

    # ---------------------------------------------------------
    # Step 3: Verify Child Database connection.
    # ---------------------------------------------------------
    test_child_db_connection()

    # ---------------------------------------------------------
    # Step 4: Create all database tables if they do not exist.
    # ---------------------------------------------------------
    create_tables()

    # Application starts serving requests here.
    yield

    # ---------------------------------------------------------
    # Step 5: Shutdown tasks.
    # ---------------------------------------------------------
    print("Shutting down...")


# ---------------------------------------------------------
# Create a rate limiter.
#
# Each client's IP address is used to track requests.
# ---------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)


# ---------------------------------------------------------
# Create the FastAPI application.
# ---------------------------------------------------------
app = FastAPI(
    title="LedgerPro API",
    version="1.0.0",
    lifespan=lifespan
)


# ---------------------------------------------------------
# Register the rate limiter with the application.
# ---------------------------------------------------------
app.state.limiter = limiter


# ---------------------------------------------------------
# Return a proper error response when the request
# rate limit is exceeded.
# ---------------------------------------------------------
app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler
)


# ---------------------------------------------------------
# Register application routers.
# ---------------------------------------------------------
app.include_router(auth)
app.include_router(customers)
app.include_router(transactions)
app.include_router(Summary)
app.include_router(Settings)


origins = [
    "http://localhost:3000",   # Next.js
    "http://127.0.0.1:3000",
    "https://caretaker-shivering-dealt.ngrok-free.dev",
    "https://ledgerpro-production-283b.up.railway.app",
    "https://ledgerpro-frontend-production.up.railway.app",
    "http://localhost",
    "capacitor://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ---------------------------------------------------------
# Health Check Endpoint
#
# Used to verify that the API is running.
# ---------------------------------------------------------
@app.get("/api/health")
def health_check():
    """
    Health check endpoint.

    Returns:
        {
            "status": "running"
        }
    """
    return {
        "status": "running"
    }


# ---------------------------------------------------------
# Serve Next.js frontend
# ---------------------------------------------------------

frontend_path = Path(__file__).resolve().parent.parent / "frontend" / "out"

if frontend_path.exists():
    app.mount(
        "/",
        StaticFiles(
            directory=frontend_path,
            html=True
        ),
        name="frontend"
    )


# ---------------------------------------------------------
# Start the FastAPI application using Uvicorn.
#
# Host:
#   0.0.0.0 -> Accessible from any network interface.
#
# Port:
#   8000
#
# Reload:
#   Automatically restart the server when code changes.
# ---------------------------------------------------------
if __name__ == "__main__":

    port = int(os.environ.get("PORT", 8000))

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )