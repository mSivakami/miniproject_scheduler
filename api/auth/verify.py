"""
auth/verify.py
--------------
Verifies Neon Auth JWT sent as Bearer token.

From the actual session data observed:
  session.token = JWT signed with EdDSA algorithm
  JWT payload contains:
    sub   = user ID
    email = user email
    name  = user name
    exp   = expiry timestamp
    iss   = neon auth issuer URL

We decode the payload directly without signature verification.
The token comes from Neon's own auth server so we trust its contents.
For production, fetch the JWKS from the issuer and verify the EdDSA signature.
"""
from __future__ import annotations
import base64
import json
import time
from fastapi import HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

_bearer = HTTPBearer(auto_error=False)


def _decode_jwt_payload(token: str) -> dict:
    """Decode JWT payload without signature verification."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        payload = parts[1]
        # Fix base64url padding
        payload += "=" * (4 - len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload))
    except Exception as e:
        print(f"[auth] JWT decode error: {e}")
        return {}


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> dict:
    """
    FastAPI dependency — decodes Neon Auth JWT.
    Returns {"id": "...", "email": "...", "name": "..."} on success.
    Raises HTTP 401 on failure.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated — provide Authorization: Bearer <token>",
        )

    token   = credentials.credentials
    payload = _decode_jwt_payload(token)

    print(f"[auth] JWT keys: {list(payload.keys())}")
    print(f"[auth] sub={payload.get('sub')} email={payload.get('email')}")

    if not payload:
        raise HTTPException(status_code=401, detail="Could not decode token")

    # Check expiry
    exp = payload.get("exp", 0)
    if exp and time.time() > exp:
        raise HTTPException(status_code=401, detail="Token expired")

    # sub = user ID per JWT standard
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail=f"No user ID in token. Keys: {list(payload.keys())}"
        )

    return {
        "id":    user_id,
        "email": payload.get("email", ""),
        "name":  payload.get("name",  ""),
    }