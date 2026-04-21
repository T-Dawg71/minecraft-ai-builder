import os
import tempfile
import shutil
import base64
import pytest
from services import history_service
from unittest import mock


def test_inmemory_history_service_crud():
    svc = history_service.HistoryService()
    entry = svc.add_entry("user1", {"foo": "bar"})
    assert entry["user_id"] == "user1"
    eid = entry["id"]
    assert svc.get_entry(eid)["data"]["foo"] == "bar"
    svc.update_entry(eid, {"foo": "baz"})
    assert svc.get_entry(eid)["data"]["foo"] == "baz"
    assert len(svc.get_entries("user1")) == 1
    svc.delete_entry(eid)
    assert svc.get_entry(eid) is None


def test_make_thumbnail_valid():
    from PIL import Image
    img = Image.new("RGB", (10, 10), (255, 0, 0))
    from io import BytesIO
    buf = BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    thumb = history_service._make_thumbnail(b64)
    assert isinstance(thumb, str) and len(thumb) > 0


def test_make_thumbnail_invalid():
    # Not a valid image
    thumb = history_service._make_thumbnail("notbase64")
    assert thumb == ""


def test_sqlite_history_crud(tmp_path, monkeypatch):
    # Patch DB_PATH to a temp location
    db_path = tmp_path / "history.db"
    monkeypatch.setattr(history_service, "DB_PATH", str(db_path))
    # Save
    eid = history_service.save_generation("prompt", "refined", "", {"g": 1}, {"s": 2})
    # Get
    entry = history_service.get_entry(eid)
    assert entry["user_prompt"] == "prompt"
    # List
    entries = history_service.get_history()
    assert any(e["id"] == eid for e in entries)
    # Delete
    assert history_service.delete_entry(eid)
    assert history_service.get_entry(eid) is None
    # Clear
    history_service.save_generation("prompt2")
    count = history_service.clear_history()
    assert count >= 1


def test_prune_old_entries(tmp_path, monkeypatch):
    db_path = tmp_path / "history.db"
    monkeypatch.setattr(history_service, "DB_PATH", str(db_path))
    for i in range(history_service.MAX_HISTORY + 10):
        history_service.save_generation(f"prompt{i}")
    entries = history_service.get_history(per_page=history_service.MAX_HISTORY + 20)
    assert len(entries) <= history_service.MAX_HISTORY
