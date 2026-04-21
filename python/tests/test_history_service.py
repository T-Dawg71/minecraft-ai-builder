"""Unit tests for history_service.py."""

import pytest
from services import history_service

class TestHistoryService:
    def setup_method(self):
        # Setup: clear or mock the history DB as needed
        # For now, assume in-memory or temp DB if possible
        self.service = history_service.HistoryService()

    def test_add_entry(self):
        entry = self.service.add_entry(user_id="user1", data={"foo": "bar"})
        assert entry is not None
        assert entry["user_id"] == "user1"
        assert entry["data"]["foo"] == "bar"

    def test_get_entries(self):
        self.service.add_entry(user_id="user2", data={"baz": 123})
        entries = self.service.get_entries(user_id="user2")
        assert any(e["data"].get("baz") == 123 for e in entries)

    def test_delete_entry(self):
        entry = self.service.add_entry(user_id="user3", data={"x": 1})
        self.service.delete_entry(entry["id"])
        entries = self.service.get_entries(user_id="user3")
        assert all(e["id"] != entry["id"] for e in entries)

    def test_update_entry(self):
        entry = self.service.add_entry(user_id="user4", data={"y": 2})
        updated = self.service.update_entry(entry["id"], data={"y": 99})
        assert updated["data"]["y"] == 99

    def test_get_nonexistent_entry(self):
        result = self.service.get_entry(entry_id="nonexistent")
        assert result is None

    def test_pagination(self):
        # Add multiple entries and test pagination if supported
        for i in range(10):
            self.service.add_entry(user_id="user5", data={"n": i})
        entries = self.service.get_entries(user_id="user5", limit=5)
        assert len(entries) <= 5
