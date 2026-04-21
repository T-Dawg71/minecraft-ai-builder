import base64
import pytest
from services.main import _decode_base64_image, _build_safe_palette, ConvertToBlocksRequest, _build_block_conversion_result
from PIL import Image
import numpy as np


def test_decode_base64_image_valid():
    # Create a simple PNG
    img = Image.new("RGB", (2, 2), (255, 0, 0))
    buf = base64.b64encode(np.array(img).tobytes()).decode()
    # Actually encode as PNG
    from io import BytesIO
    png_buf = BytesIO()
    img.save(png_buf, format="PNG")
    b64 = base64.b64encode(png_buf.getvalue()).decode()
    # Should not raise
    out = _decode_base64_image(b64)
    assert out.size == (2, 2)


def test_decode_base64_image_invalid_base64():
    with pytest.raises(ValueError):
        _decode_base64_image("not_base64!!")


def test_decode_base64_image_invalid_image():
    # Valid base64, but not an image
    bad = base64.b64encode(b"notanimage").decode()
    with pytest.raises(ValueError):
        _decode_base64_image(bad)


def test_build_safe_palette_filters_dark_blocks():
    # Palette with a dark and a light block
    palette = [
        {"id": "black_wool", "rgb": [0, 0, 0]},
        {"id": "white_wool", "rgb": [255, 255, 255]},
    ]
    filtered = _build_safe_palette(palette)
    assert any(b["id"] == "white_wool" for b in filtered)


def test_build_safe_palette_fallback():
    # Palette with only dark blocks triggers fallback
    palette = [{"id": "black_wool", "rgb": [0, 0, 0]} for _ in range(3)]
    filtered = _build_safe_palette(palette)
    assert isinstance(filtered, list)
    assert len(filtered) <= 24


def test_build_block_conversion_result_runs(monkeypatch):
    # Patch preprocess_image and image_to_block_grid to avoid heavy computation
    class DummyGrid:
        width = 2
        height = 2
        palette_used = {"white_wool": 4}
        def to_block_id_grid(self):
            return [["white_wool", "white_wool"], ["white_wool", "white_wool"]]
    monkeypatch.setattr("services.main.preprocess_image", lambda *a, **k: Image.new("RGB", (2, 2), (255, 255, 255)))
    monkeypatch.setattr("services.main.image_to_block_grid", lambda *a, **k: DummyGrid())
    # Create a valid PNG
    img = Image.new("RGB", (2, 2), (255, 255, 255))
    from io import BytesIO
    png_buf = BytesIO()
    img.save(png_buf, format="PNG")
    b64 = base64.b64encode(png_buf.getvalue()).decode()
    req = ConvertToBlocksRequest(
        image_base64=b64,
        width=2,
        height=2,
        palette=[{"id": "white_wool", "rgb": [255, 255, 255]}],
        dithering=False,
        brightness=0,
        contrast=0,
    )
    result = _build_block_conversion_result(req, "grid")
    assert result["dimensions"] == {"width": 2, "height": 2}
    assert result["block_count"] == 4
    assert "grid" in result
