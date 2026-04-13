# -*- coding: utf-8 -*-
"""
main.py — AutoScheduler FastAPI Backend
"""

import sys
import os
from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

# Force UTF-8 output on Windows (fixes UnicodeEncodeError in terminal)
import os
os.environ.setdefault("PYTHONUTF8", "1")
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Load .env from the project root (one level up from backend/)
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")       # root .env
load_dotenv(Path(__file__).parent / ".env", override=False)  # backend/.env (optional)

from database import create_tables

sys.path.append(str(Path(__file__).parent / "engine"))

from routers import generate, timetables, data, mini_groups
from routers.auth import router as auth_router, get_current_user

app = FastAPI(
    title="AutoScheduler API",
    description="Genetic Algorithm Timetable Scheduling Backend",
    version="1.0.0",
)

# CORS — allow Vite dev server and any deployed frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Public routes ──────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/auth")

# ── Protected routes (JWT required) ───────────────────────────────────────
app.include_router(data.router,        prefix="/api/data")
app.include_router(timetables.router,  prefix="/api/timetables")
app.include_router(generate.router,    prefix="/api/generate")
app.include_router(mini_groups.router, prefix="/api/mini-groups")

# ── Startup ────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    create_tables()
    print("\n  AutoScheduler Backend - Ready")
    print("  API docs: http://localhost:8000/docs\n")

# ── Health check (public) ──────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AutoScheduler API"}
