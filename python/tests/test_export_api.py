"""Tests for export API endpoints."""

from fastapi.testclient import TestClient

from services.main import app

client = TestClient(app)

TEST_GRID = [
    ["minecraft:stone", "minecraft:dirt"],
    ["minecraft:dirt", "minecraft:stone"],
]


class TestExportEndpoints:
    def test_export_schematic_returns_gzipped_schem(self):
        response = client.post(
            "/export/schematic",
            json={
                "grid": TEST_GRID,
                "format": "schem",
                "orientation": "floor",
                "depth": 2,
            },
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/octet-stream"
        assert "filename=\"minecraft-build.schem\"" in response.headers["content-disposition"]
        assert response.content.startswith(b"\x1f\x8b")

    def test_export_schematic_returns_nbt_file(self):
        response = client.post(
            "/export/schematic",
            json={
                "grid": TEST_GRID,
                "format": "nbt",
                "orientation": "wall",
                "depth": 1,
            },
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/octet-stream"
        assert "filename=\"minecraft-build.nbt\"" in response.headers["content-disposition"]
        assert response.content.startswith(b"\x0a")

    def test_export_preview_image_returns_png(self):
        response = client.post(
            "/export/preview-image",
            json={"grid": TEST_GRID, "scale": 32},
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content.startswith(b"\x89PNG\r\n\x1a\n")

    def test_export_block_list_supports_csv_and_json(self):
        csv_response = client.post(
            "/export/block-list",
            json={"grid": TEST_GRID, "format": "csv"},
        )

        assert csv_response.status_code == 200
        assert csv_response.headers["content-type"].startswith("text/csv")
        assert "block_id,quantity" in csv_response.text
        assert "minecraft:stone,2" in csv_response.text
        assert "minecraft:dirt,2" in csv_response.text

        json_response = client.post(
            "/export/block-list",
            json={"grid": TEST_GRID, "format": "json"},
        )

        assert json_response.status_code == 200
        assert json_response.headers["content-type"] == "application/json"
        assert json_response.json()["total_blocks"] == 4
        assert json_response.json()["blocks"] == [
            {"block_id": "minecraft:dirt", "quantity": 2},
            {"block_id": "minecraft:stone", "quantity": 2},
        ]
