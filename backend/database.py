"""
database.py — SQLAlchemy engine + session for SQLite
=====================================================
Auto-creates app.db in the backend/ directory on first run.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pathlib import Path

DB_PATH = Path(__file__).parent / "app.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},  # needed for SQLite + FastAPI
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session, auto-closes after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables (idempotent — safe to call on every startup)."""
    Base.metadata.create_all(bind=engine)


def get_or_create_institution(db) -> 'Institution':
    """Get the sole institution, or create one if none exists."""
    from models import Institution
    from services.bitmask_service import compute_break_mask, compute_working_mask
    inst = db.query(Institution).first()
    if not inst:
        inst = Institution(
            name="My Institution",
            days_per_week=5,
            periods_per_day=7,
            break_after_period=3
        )
        # Compute masks for defaults
        inst.break_mask = compute_break_mask(inst.days_per_week, inst.periods_per_day, inst.break_after_period)
        inst.working_slot_mask = compute_working_mask(inst.days_per_week, inst.periods_per_day, inst.break_mask)
        db.add(inst)
        db.commit()
        db.refresh(inst)
    return inst
