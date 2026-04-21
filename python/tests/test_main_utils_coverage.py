import pytest
from services import main
from PIL import Image
import base64


def test_decode_base64_image_invalid_base64():
    with pytest.raises(ValueError):
        main._decode_base64_image("not_base64")


def test_decode_base64_image_invalid_image():
    # valid base64, but not an image
    b64 = base64.b64encode(b"notanimage").decode()
    with pytest.raises(ValueError):
        main._decode_base64_image(b64)


def test_encode_preview_image():
    img = Image.new("RGB", (2, 2), (123, 222, 111))
    b64 = main._encode_preview_image(img)
    assert isinstance(b64, str) and len(b64) > 0


def test_rgb_luminance_and_is_dark_block_id():
    assert main._rgb_luminance([0, 0, 0]) == 0
    assert main._rgb_luminance([255, 255, 255]) == pytest.approx(255)
    assert main._is_dark_block_id("black_wool")
    assert not main._is_dark_block_id("white_wool")


def test_build_safe_palette_minimum(monkeypatch):
    # palette with <8 blocks triggers fallback
    fake_palette = [{"id": f"block{i}", "rgb": [i, i, i]} for i in range(3)]
    monkeypatch.setattr(main, "_normalize_palette", lambda x: fake_palette)
    result = main._build_safe_palette(fake_palette)
    assert isinstance(result, list) and len(result) <= 24
