"""
main.py — FastAPI application entry point.

Schema is managed via schema.sql run in Neon SQL Editor.
Tables are never created or altered here.
User data loads lazily on first request per user.
"""
from __future__ import annotations
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.api import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Nothing to do on startup — schema already exists in Neon,
    # user data loads lazily on first authenticated request.
    yield


app = FastAPI(
    title="Timetable Generator API",
    version="2.0.0",
    lifespan=lifespan,
)

from fastapi.middleware.cors import CORSMiddleware
import os

origins = os.getenv("ALLOWED_ORIGINS", "").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)