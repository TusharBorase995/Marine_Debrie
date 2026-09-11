import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel

from app.db.repository import repo

logger = logging.getLogger("sonar_auth")
router = APIRouter(prefix="/api/auth", tags=["User Authentication & Workspaces"])

class RegisterPayload(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = "Marine Specialist"
    role: Optional[str] = "Lead Marine Analyst"

class LoginPayload(BaseModel):
    email: str
    password: str
    role: Optional[str] = None

@router.post("/register")
def register_user(payload: RegisterPayload):
    """
    Registers a new user account in Neon PostgreSQL.
    Provides an independent, isolated workspace where their missions, targets, and images are stored.
    """
    if not payload.email or "@" not in payload.email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if not payload.password or len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    try:
        user = repo.create_user(
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name or "Marine Specialist",
            role=payload.role or "Lead Marine Analyst"
        )
        return {
            "status": "success",
            "message": "Account created successfully.",
            "user": user
        }
    except ValueError as ve:
        raise HTTPException(status_code=409, detail=str(ve))
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to register user in database: {e}"
        )

@router.post("/login")
def login_user(payload: LoginPayload):
    """
    Authenticates user against Neon PostgreSQL.
    Returns user profile with independent workspace identifier.
    """
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    try:
        user = repo.authenticate_user(payload.email, payload.password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        
        # If user selected a specific role on the login screen, we echo that in session
        if payload.role and payload.role.strip():
            user["role"] = payload.role.strip()

        return {
            "status": "success",
            "message": "Authentication successful.",
            "user": user
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error authenticating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Authentication service temporarily unavailable: {e}"
        )

@router.get("/me")
def get_current_user_profile(x_user_id: Optional[str] = Header(None, alias="x-user-id")):
    """
    Retrieves currently active user profile from Neon PostgreSQL using X-User-Id header.
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id authorization header.")

    user = repo.get_user(x_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")
    return user

@router.delete("/account")
def delete_account(x_user_id: Optional[str] = Header(None, alias="x-user-id")):
    """
    Permanently deletes user's account and all associated workspace data:
    - Missions, Targets, and Observations in Neon PostgreSQL.
    - Uploaded sonar imagery in Neon Object Storage ('sagar-images').
    Note: The default demo tester account is protected from deletion.
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id authorization header.")

    try:
        success = repo.delete_user_and_all_data(x_user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Account not found or already deleted.")
        return {
            "status": "success",
            "message": "Account and all associated survey data deleted permanently."
        }
    except ValueError as ve:
        raise HTTPException(status_code=403, detail=str(ve))
    except Exception as e:
        logger.error(f"Error during account deletion: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete account data: {e}"
        )
