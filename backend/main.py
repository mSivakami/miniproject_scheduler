"""
main.py — AutoScheduler FastAPI Backend
==========================================
Entry point for the backend server.

Usage:
    cd backend
    uvicorn main:app --reload --port 8000

API docs: http://localhost:8000/docs
"""

import sys
from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from database import create_tables

# Add the engine directory to sys.path so its standalone modules can find each other
sys.path.append(str(Path(__file__).parent / "engine"))

from routers import (
    generate,
    timetables,
    data,
    mini_groups,
)
from routers.auth import router as auth_router, get_current_user

app = FastAPI(
    title="AutoScheduler API",
    description="Genetic Algorithm Timetable Scheduling Backend",
    version="1.0.0",
)

# CORS — allow local dev frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev
        "http://localhost:3000",   # Next.js dev
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Auth Router (public — no JWT required) ──────────────────────────────────

app.include_router(auth_router, prefix="/auth")


# ─── Protected API Routers (JWT required on every route) ────────────────────
#
# We pass `dependencies=[Depends(get_current_user)]` at the router level so
# every endpoint in each router is protected automatically.
# The /auth/* routes above are NOT in this group and remain public.

_protected = {"dependencies": [Depends(get_current_user)]}

app.include_router(data.router,        prefix="/api/data",        **_protected)
app.include_router(generate.router,    prefix="/api/generate",    **_protected)
app.include_router(timetables.router,  prefix="/api/timetables",  **_protected)
app.include_router(mini_groups.router, prefix="/api/mini-groups", **_protected)


# ─── Startup ────────────────────────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    """Create all DB tables on startup (idempotent)."""
    create_tables()
    print("\n  ╔══════════════════════════════════════════════╗")
    print("  ║  AutoScheduler Backend — Ready               ║")
    print("  ║  API docs: http://localhost:8000/docs         ║")
    print("  ╚══════════════════════════════════════════════╝\n")


# ─── Health Check (public) ───────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AutoScheduler API"}

