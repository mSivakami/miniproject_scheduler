# -*- coding: utf-8 -*-
"""
JWT authentication for AutoScheduler.

Endpoints:
  POST /auth/setup     - create the first account
  POST /auth/register  - create additional accounts
  POST /auth/login     - shared account login
  GET  /auth/me        - current authenticated account
  GET  /auth/status    - whether first-time setup is still required
"""

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Account, AdminUser, UserAccount

router = APIRouter(tags=["Auth"])

JWT_SECRET = os.environ.get("JWT_SECRET", "autoscheduler-dev-secret-change-in-prod-32b")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 7
PROBE_USERNAME = "__probe__"
PROBE_PASSWORD = "__probe__"
ROLE_ACCOUNT = "account"


class SetupRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: Literal["account"]


class MeResponse(BaseModel):
    id: str
    username: str
    role: Literal["account"]
    created_at: Optional[datetime] = None


class AuthStatusResponse(BaseModel):
    setup_required: bool


class CurrentUser(BaseModel):
    id: str
    username: str
    role: Literal["account"]
    created_at: Optional[datetime] = None


def _hash_password(password: str) -> str:
    return hashlib.sha256(f"autoscheduler:{password}".encode()).hexdigest()


def _verify_password(plain: str, hashed: str) -> bool:
    return hmac.compare_digest(_hash_password(plain), hashed)


def _normalize_username(username: str) -> str:
    return username.strip()


def _validate_credentials(username: str, password: str):
    if len(username) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")


def _create_token(user_id: str, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "username": username,
        "role": ROLE_ACCOUNT,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _copy_legacy_account(db: Session, legacy: AdminUser | UserAccount):
    if db.query(Account).filter(Account.username == legacy.username).first() is not None:
        return

    account = Account(
        id=legacy.id,
        username=legacy.username,
        password_hash=legacy.password_hash,
        created_at=legacy.created_at,
    )
    db.add(account)


def _migrate_legacy_accounts(db: Session):
    Account.__table__.create(bind=db.get_bind(), checkfirst=True)
    migrated = False

    for legacy in db.query(AdminUser).all():
        before = db.query(Account).filter(Account.username == legacy.username).first()
        if before is None:
            _copy_legacy_account(db, legacy)
            migrated = True

    for legacy in db.query(UserAccount).all():
        before = db.query(Account).filter(Account.username == legacy.username).first()
        if before is None:
            _copy_legacy_account(db, legacy)
            migrated = True

    if migrated:
        db.commit()


def _find_account_by_username(db: Session, username: str) -> Optional[Account]:
    _migrate_legacy_accounts(db)
    return db.query(Account).filter(Account.username == username).first()


def _find_recoverable_probe_account(db: Session) -> Optional[Account]:
    _migrate_legacy_accounts(db)
    users = db.query(Account).all()
    if len(users) != 1:
        return None

    user = users[0]
    if user.username != PROBE_USERNAME:
        return None
    if not _verify_password(PROBE_PASSWORD, user.password_hash):
        return None

    return user


def _setup_required(db: Session) -> bool:
    _migrate_legacy_accounts(db)
    return db.query(Account).count() == 0 or _find_recoverable_probe_account(db) is not None


def _username_taken(db: Session, username: str) -> bool:
    return _find_account_by_username(db, username) is not None


def _authenticate_account(db: Session, username: str, password: str) -> Account:
    account = _find_account_by_username(db, username)
    if account and _verify_password(password, account.password_hash):
        return account

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password",
    )


def _current_user_from_account(account: Account) -> CurrentUser:
    return CurrentUser(
        id=account.id,
        username=account.username,
        role=ROLE_ACCOUNT,
        created_at=account.created_at,
    )


_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated - provide a Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Missing sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired - please log in again",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    _migrate_legacy_accounts(db)
    account = db.query(Account).filter(Account.id == user_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return _current_user_from_account(account)


@router.get("/status", response_model=AuthStatusResponse)
def auth_status(db: Session = Depends(get_db)):
    return AuthStatusResponse(setup_required=_setup_required(db))


@router.post("/setup", response_model=TokenResponse, status_code=201)
def setup(req: SetupRequest, db: Session = Depends(get_db)):
    recoverable_probe_account = _find_recoverable_probe_account(db)
    if db.query(Account).count() > 0 and recoverable_probe_account is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists. Use /auth/login instead.",
        )

    username = _normalize_username(req.username)
    _validate_credentials(username, req.password)

    existing = _find_account_by_username(db, username)
    if existing is not None and existing != recoverable_probe_account:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already in use")

    if recoverable_probe_account is not None:
        account = recoverable_probe_account
        account.username = username
        account.password_hash = _hash_password(req.password)
        db.commit()
        db.refresh(account)
    else:
        account = Account(
            username=username,
            password_hash=_hash_password(req.password),
        )
        db.add(account)
        db.commit()
        db.refresh(account)

    token = _create_token(account.id, account.username)
    return TokenResponse(access_token=token, username=account.username, role=ROLE_ACCOUNT)


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if _setup_required(db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Create the first account before creating additional accounts.",
        )

    username = _normalize_username(req.username)
    _validate_credentials(username, req.password)

    if _username_taken(db, username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already in use")

    account = Account(
        username=username,
        password_hash=_hash_password(req.password),
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    token = _create_token(account.id, account.username)
    return TokenResponse(access_token=token, username=account.username, role=ROLE_ACCOUNT)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    username = _normalize_username(req.username)
    account = _authenticate_account(db, username, req.password)
    token = _create_token(account.id, account.username)
    return TokenResponse(access_token=token, username=account.username, role=ROLE_ACCOUNT)


@router.get("/me", response_model=MeResponse)
def me(current_user: CurrentUser = Depends(get_current_user)):
    return MeResponse(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role,
        created_at=current_user.created_at,
    )
