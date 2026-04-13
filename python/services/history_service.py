"""Generation history service using SQLite for persistent storage."""

from __future__ import annotations

import base64
import json
import os
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from typing import Optional

from PIL import Image

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "history.db")
MAX_HISTORY = 100


def _make_thumbnail(image_base64: str, size: tuple = (256, 256)) -> str:
    """Resize base64 image to a small thumbnail before storing."""
    try:
        img_bytes = base64.b64decode(image_base64)
        img = Image.open(BytesIO(img_bytes))
        img.thumbnail(size)
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
    except Exception:
        return ""


@dataclass
class HistoryEntry:
    id: str
    user_prompt: str
    refined_prompt: str
    image_base64: str
    image_thumbnail: str
    block_grid_json: str
    settings_json: str
    timestamp: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_prompt": self.user_prompt,
            "refined_prompt": self.refined_prompt,
            "image_base64": self.image_base64,
            "block_grid": json.loads(self.block_grid_json) if self.block_grid_json else None,
            "settings": json.loads(self.settings_json) if self.settings_json else None,
            "timestamp": self.timestamp,
        }

    def to_summary(self) -> dict:
        """Return a lightweight summary without full image/grid data."""
        return {
            "id": self.id,
            "user_prompt": self.user_prompt,
            "refined_prompt": self.refined_prompt,
            "image_thumbnail": self.image_thumbnail,
            "has_blocks": bool(self.block_grid_json),
            "settings": json.loads(self.settings_json) if self.settings_json else {},
            "timestamp": self.timestamp,
        }


def _get_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            user_prompt TEXT NOT NULL,
            refined_prompt TEXT NOT NULL DEFAULT '',
            image_base64 TEXT NOT NULL DEFAULT '',
            image_thumbnail TEXT NOT NULL DEFAULT '',
            block_grid_json TEXT NOT NULL DEFAULT '',
            settings_json TEXT NOT NULL DEFAULT '{}',
            timestamp TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn


def _row_to_entry(row: tuple) -> HistoryEntry:
    return HistoryEntry(
        id=row[0],
        user_prompt=row[1],
        refined_prompt=row[2],
        image_base64=row[3],
        image_thumbnail=row[4],
        block_grid_json=row[5],
        settings_json=row[6],
        timestamp=row[7],
    )


def save_generation(
    user_prompt: str,
    refined_prompt: str = "",
    image_base64: str = "",
    block_grid: Optional[dict] = None,
    settings: Optional[dict] = None,
) -> str:
    """Save a generation to history. Returns the new entry ID."""
    entry_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    block_grid_json = json.dumps(block_grid) if block_grid else ""
    settings_json = json.dumps(settings) if settings else "{}"
    image_thumbnail = _make_thumbnail(image_base64) if image_base64 else ""

    conn = _get_connection()
    try:
        conn.execute(
            """INSERT INTO history
               (id, user_prompt, refined_prompt, image_base64, image_thumbnail, block_grid_json, settings_json, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (entry_id, user_prompt, refined_prompt, image_base64, image_thumbnail, block_grid_json, settings_json, timestamp),
        )
        conn.commit()
        _prune_old_entries(conn)
    finally:
        conn.close()

    return entry_id


def get_history(page: int = 1, per_page: int = 20) -> list[dict]:
    """Get paginated history entries (summaries only)."""
    offset = (page - 1) * per_page
    conn = _get_connection()
    try:
        cursor = conn.execute(
            "SELECT * FROM history ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            (per_page, offset),
        )
        rows = cursor.fetchall()
        return [_row_to_entry(row).to_summary() for row in rows]
    finally:
        conn.close()


def get_entry(entry_id: str) -> Optional[dict]:
    """Get a single history entry with full data."""
    conn = _get_connection()
    try:
        cursor = conn.execute("SELECT * FROM history WHERE id = ?", (entry_id,))
        row = cursor.fetchone()
        if row is None:
            return None
        return _row_to_entry(row).to_dict()
    finally:
        conn.close()


def delete_entry(entry_id: str) -> bool:
    """Delete a single history entry. Returns True if deleted."""
    conn = _get_connection()
    try:
        cursor = conn.execute("DELETE FROM history WHERE id = ?", (entry_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def clear_history() -> int:
    """Delete all history entries. Returns number deleted."""
    conn = _get_connection()
    try:
        cursor = conn.execute("DELETE FROM history")
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()


def _prune_old_entries(conn: sqlite3.Connection) -> None:
    """Keep only the most recent MAX_HISTORY entries."""
    conn.execute(
        """DELETE FROM history WHERE id NOT IN (
            SELECT id FROM history ORDER BY timestamp DESC LIMIT ?
        )""",
        (MAX_HISTORY,),
    )
    conn.commit()


if __name__ == "__main__":
    eid = save_generation(
        user_prompt="a castle on a hill",
        refined_prompt="A majestic castle...",
        image_base64="test_base64_data",
        settings={"gridWidth": 64, "gridHeight": 64, "palette": "full"},
    )
    print(f"Saved entry: {eid}")

    entries = get_history()
    print(f"History count: {len(entries)}")
    for e in entries:
        print(f"  {e['id'][:8]}... | {e['user_prompt']} | {e['timestamp']}")

    entry = get_entry(eid)
    print(f"Full entry: {entry['user_prompt']}")

    deleted = delete_entry(eid)
    print(f"Deleted: {deleted}")

    print(f"After delete: {len(get_history())} entries")