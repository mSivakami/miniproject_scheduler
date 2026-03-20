"""
main.py — FastAPI application entry point.
"""
from __future__ import annotations
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.session import init_db, load_all, SessionLocal
from routes.api import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables then warm the in-memory store on startup."""
    init_db()
    db = SessionLocal()
    try:
        load_all(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Timetable Generator API",
    version="1.0.0",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)