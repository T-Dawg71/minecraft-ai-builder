"""Unit tests for the block mapping API endpoints."""

import asyncio
import base64
from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image


# Ensure the parent directory is in sys.path for reliable imports

# Robustly add the parent directory containing 'services' to sys.path
import sys
from pathlib import Path
test_dir = Path(__file__).resolve().parent
root = test_dir.parent  # This should be the 'python' directory
if str(root) not in sys.path:
    sys.path.insert(0, str(root))
from services.main import app

client = TestClient(app)

TEST_PALETTE = [
    {"id": "test:black", "name": "Black", "rgb": [0, 0, 0], "category": "test"},
    {"id": "test:white", "name": "White", "rgb": [255, 255, 255], "category": "test"},
    {"id": "test:red", "name": "Red", "rgb": [255, 0, 0], "category": "test"},
]


def _image_b64(size=(2, 2), pixels=None) -> str:
    image = Image.new("RGB", size)
    image.putdata(
        pixels
        or [
            (255, 255, 255),
            (0, 0, 0),
            (255, 0, 0),
            (255, 255, 255),
        ]
    )
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


class TestConvertToBlocksEndpoint:
    def test_convert_to_blocks_returns_grid_json(self):
        response = client.post(
            "/convert-to-blocks?output_format=grid",
            json={
                "image_base64": _image_b64(),
                "width": 2,
                "height": 2,
                "palette": TEST_PALETTE,
                "dithering": False,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["dimensions"] == {"width": 2, "height": 2}
        assert data["block_count"] == 4
        assert data["grid"] == [
            ["test:white", "test:red"],
            ["test:red", "test:white"],
        ]
        assert data["palette_summary"] == {
            "test:white": 2,
            "test:red": 2,
        }

    def test_convert_to_blocks_returns_preview_image(self):
        response = client.post(
            "/convert-to-blocks?output_format=preview",
            json={
                "image_base64": _image_b64(),
                "width": 2,
                "height": 2,
                "palette": TEST_PALETTE,
                "dithering": False,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["dimensions"] == {"width": 2, "height": 2}
        assert data["block_count"] == 4
        assert data["preview_image"]
        decoded = base64.b64decode(data["preview_image"])
        assert decoded.startswith(b"\x89PNG\r\n\x1a\n")
        assert "grid" not in data

    def test_convert_to_blocks_rejects_invalid_base64(self):
        response = client.post(
            "/convert-to-blocks",
            json={
                "image_base64": "not-valid-base64",
                "width": 2,
                "height": 2,
                "palette": "wool",
                "dithering": False,
            },
        )

        assert response.status_code == 400
        assert "base64" in response.json()["detail"].lower()

    def test_convert_to_blocks_times_out(self, monkeypatch):
        from services import main as main_module

        async def slow_conversion(*args, **kwargs):
            await asyncio.sleep(0.05)
            return {
                "dimensions": {"width": 1, "height": 1},
                "block_count": 1,
                "palette_summary": {"test:white": 1},
                "grid": [["test:white"]],
            }

        monkeypatch.setattr(main_module, "CONVERT_TO_BLOCKS_TIMEOUT_SECONDS", 0.01)
        monkeypatch.setattr(main_module, "_convert_to_blocks_response", slow_conversion)

        response = client.post(
            "/convert-to-blocks",
            json={
                "image_base64": _image_b64(size=(1, 1), pixels=[(255, 255, 255)]),
                "width": 1,
                "height": 1,
                "palette": TEST_PALETTE,
                "dithering": False,
            },
        )

        assert response.status_code == 504
        assert "timed out" in response.json()["detail"].lower()
