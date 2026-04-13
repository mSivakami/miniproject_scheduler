# -*- coding: utf-8 -*-
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
    _migrate_schema()
    _migrate_assign_existing_institution()


def _migrate_schema():
    """
    Apply lightweight column-level schema migrations.
    SQLAlchemy's create_all only creates new tables — it won't add columns
    to existing ones.  This function handles that gap for SQLite.
    """
    import sqlalchemy as sa

    with engine.connect() as conn:
        # Check if constraint_mask column exists on constraint_settings
        result = conn.execute(sa.text("PRAGMA table_info(constraint_settings)"))
        columns = {row[1] for row in result}
        if "constraint_mask" not in columns:
            conn.execute(sa.text(
                "ALTER TABLE constraint_settings ADD COLUMN constraint_mask BIGINT NOT NULL DEFAULT 0"
            ))
            conn.commit()

        # Check if account_id column exists on institutions
        result = conn.execute(sa.text("PRAGMA table_info(institutions)"))
        columns = {row[1] for row in result}
        if "account_id" not in columns:
            conn.execute(sa.text(
                "ALTER TABLE institutions ADD COLUMN account_id VARCHAR REFERENCES accounts(id) ON DELETE SET NULL"
            ))
            conn.commit()


def _migrate_assign_existing_institution():
    """
    One-time idempotent migration: assign any institution with account_id IS NULL
    to the first/oldest account (cs@gmail.com, id e7d0e485-e3b6-4b5a-8ad1-c04cae4c42f5).
    Safe to run multiple times — only acts on rows where account_id IS NULL.
    """
    import sqlalchemy as sa

    FIRST_ACCOUNT_ID = "e7d0e485-e3b6-4b5a-8ad1-c04cae4c42f5"

    with engine.connect() as conn:
        # Check if the target account exists
        result = conn.execute(
            sa.text("SELECT id FROM accounts WHERE id = :aid"),
            {"aid": FIRST_ACCOUNT_ID},
        )
        if result.fetchone() is None:
            return  # Account doesn't exist yet, skip

        # Assign any unowned institutions to this account
        conn.execute(
            sa.text("UPDATE institutions SET account_id = :aid WHERE account_id IS NULL"),
            {"aid": FIRST_ACCOUNT_ID},
        )
        conn.commit()


def get_or_create_institution(db, account_id: str) -> 'Institution':
    """Get the institution for a specific account, or create one if none exists."""
    from models import Institution
    from services.bitmask_service import compute_break_mask, compute_working_mask
    inst = db.query(Institution).filter_by(account_id=account_id).first()
    if not inst:
        inst = Institution(
            name="My Institution",
            account_id=account_id,
            days_per_week=5,
            periods_per_day=7,
            break_after_period=3
        )
        # Compute masks for defaults
        inst.break_mask = str(compute_break_mask(inst.days_per_week, inst.periods_per_day, inst.break_after_period))
        inst.working_slot_mask = str(compute_working_mask(inst.days_per_week, inst.periods_per_day, int(inst.break_mask)))
        db.add(inst)
        db.commit()
        db.refresh(inst)
    return inst
