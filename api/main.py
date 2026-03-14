from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uuid, time, os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Items API", version="1.0.0")


# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DB connection ─────────────────────────────────────────────────────────────
def get_conn():
    return psycopg2.connect(
        os.getenv("DATABASE_URL"),
        cursor_factory=psycopg2.extras.RealDictCursor   # rows as dicts
    )

def init_db():
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS items (
                id          VARCHAR(8)   PRIMARY KEY,
                name        VARCHAR(255) NOT NULL,
                category    VARCHAR(100) DEFAULT 'General',
                note        TEXT         DEFAULT '',
                created_at  BIGINT       NOT NULL
            )
        """)
    conn.commit()
    conn.close()

init_db()


# ── Schemas ───────────────────────────────────────────────────────────────────
class ItemCreate(BaseModel):
    name: str
    category: Optional[str] = "General"
    note: Optional[str] = ""


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    note: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/items")
def list_items():
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM items ORDER BY created_at DESC")
        rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/items/{item_id}")
def get_item(item_id: str):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))
        row = cur.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    return dict(row)


@app.post("/items", status_code=201)
def create_item(payload: ItemCreate):
    item_id = str(uuid.uuid4())[:8]
    data    = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    ts      = int(time.time())

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO items (id, name, category, note, created_at)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
        """, (item_id, data["name"], data["category"], data["note"], ts))
        row = cur.fetchone()
    conn.commit()
    conn.close()
    return dict(row) # type: ignore


@app.put("/items/{item_id}")
def update_item(item_id: str, payload: ItemUpdate):
    dump_fn = payload.model_dump if hasattr(payload, "model_dump") else payload.dict
    updates = dump_fn(exclude_none=True)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Build SET clause dynamically from whatever fields were sent
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values     = list(updates.values()) + [item_id]

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE items SET {set_clause} WHERE id = %s RETURNING *",
            values
        )
        row = cur.fetchone()
    conn.commit()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    return dict(row)


@app.delete("/items/{item_id}")
def delete_item(item_id: str):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM items WHERE id = %s RETURNING id", (item_id,))
        row = cur.fetchone()
    conn.commit()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"deleted": item_id}