"""
auth.py — JWT Authentication for AutoScheduler
================================================
Three endpoints:
  POST /auth/setup  — first-time admin account creation (only works once)
  POST /auth/login  — returns JWT access token
  GET  /auth/me     — returns current user info (requires token)

JWT middleware is applied in main.py via a dependency injected into each
router (see get_current_user). We use a simple dependency-based approach
rather than a Starlette middleware so public routes (health, docs) stay open.
"""

import os
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel

import jwt  # PyJWT

from database import get_db
from models import AdminUser

router = APIRouter(tags=["Auth"])

# ─── Config ─────────────────────────────────────────────────────────────────

JWT_SECRET = os.environ.get("JWT_SECRET", "autoscheduler-dev-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 7  # 1 week


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SetupRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str

class MeResponse(BaseModel):
    id: str
    username: str
    created_at: Optional[datetime] = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    """SHA-256 hash with a fixed salt prefix. Good enough for a local-first app."""
    return hashlib.sha256(f"autoscheduler:{password}".encode()).hexdigest()


def _verify_password(plain: str, hashed: str) -> bool:
    expected = _hash_password(plain)
    return hmac.compare_digest(expected, hashed)


def _create_token(user_id: str, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"sub": user_id, "username": username, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ─── Bearer scheme (auto-extracts Authorization: Bearer <token>) ─────────────

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> "AdminUser":
    """
    FastAPI dependency. Validates JWT and returns the AdminUser row.
    Raise 401 if token is missing, invalid, or expired.
    Inject this into any route that requires authentication.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated — provide a Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise ValueError("Missing sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired — please log in again",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/setup", response_model=TokenResponse, status_code=201)
def setup(req: SetupRequest, db: Session = Depends(get_db)):
    """
    First-time admin setup. Creates the admin account.
    Returns 409 if an account already exists (setup can only run once).
    """
    if db.query(AdminUser).count() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Admin account already exists. Use /auth/login instead.",
        )

    if len(req.username.strip()) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    user = AdminUser(
        username=req.username.strip(),
        password_hash=_hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = _create_token(user.id, user.username)
    return TokenResponse(access_token=token, username=user.username)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and receive a JWT token."""
    user = db.query(AdminUser).filter(AdminUser.username == req.username).first()
    if not user or not _verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    token = _create_token(user.id, user.username)
    return TokenResponse(access_token=token, username=user.username)


@router.get("/me", response_model=MeResponse)
def me(current_user: AdminUser = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return MeResponse(
        id=current_user.id,
        username=current_user.username,
        created_at=current_user.created_at,
    )
