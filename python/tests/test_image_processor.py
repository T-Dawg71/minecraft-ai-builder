"""Unit tests for the image preprocessing pipeline."""

import numpy as np
import pytest
from PIL import Image

from services.color_matcher import BlockColorMatcher
from services.image_processor import (
    adjust_brightness_contrast,
    preprocess_image,
    quantize_colors,
    resize_image,
)


def _gradient_image(width: int = 16, height: int = 16) -> Image.Image:
    """Create a horizontal grayscale gradient image for tests."""
    gradient = np.tile(
        np.linspace(0, 255, width, dtype=np.uint8),
        (height, 1),
    )
    rgb = np.stack([gradient, gradient, gradient], axis=-1)
    return Image.fromarray(rgb, mode="RGB")


class TestResizeImage:
    def test_resize_returns_target_size(self):
        image = Image.new("RGB", (64, 32), (120, 140, 160))

        result = resize_image(image, 16, 8)

        assert result.size == (16, 8)
        assert result.mode == "RGB"

    def test_resize_uses_lanczos_resampling(self, monkeypatch):
        image = Image.new("RGB", (10, 10), (50, 60, 70))
        called = {}
        original_resize = Image.Image.resize

        def tracking_resize(self, size, resample=None, box=None, reducing_gap=None):
            called["resample"] = resample
            return original_resize(
                self,
                size,
                resample=resample,
                box=box,
                reducing_gap=reducing_gap,
            )

        monkeypatch.setattr(Image.Image, "resize", tracking_resize)

        resize_image(image, 5, 5)

        assert called["resample"] == Image.Resampling.LANCZOS


class TestQuantizeColors:
    def test_quantize_colors_limits_output_to_palette(self):
        image = _gradient_image(8, 2)
        palette = [(0, 0, 0), (255, 255, 255)]

        result = quantize_colors(image, palette, dithering=False)
        unique_colors = {tuple(pixel) for pixel in np.array(result).reshape(-1, 3)}

        assert unique_colors.issubset(set(palette))
        assert len(unique_colors) == 2

    def test_quantize_colors_supports_block_dict_palette(self):
        image = Image.new("RGB", (2, 1))
        image.putdata([(240, 10, 10), (10, 20, 240)])
        palette = [
            {"id": "red", "name": "Red", "rgb": [255, 0, 0], "category": "test"},
            {"id": "blue", "name": "Blue", "rgb": [0, 0, 255], "category": "test"},
        ]

        result = quantize_colors(image, palette)

        assert [tuple(pixel) for pixel in np.array(result).reshape(-1, 3)] == [
            (255, 0, 0),
            (0, 0, 255),
        ]

    def test_dithering_toggle_changes_output_pattern(self):
        image = _gradient_image(16, 16)
        palette = [(0, 0, 0), (255, 255, 255)]

        no_dither = quantize_colors(image, palette, dithering=False)
        with_dither = quantize_colors(image, palette, dithering=True)

        no_dither_colors = {tuple(pixel) for pixel in np.array(no_dither).reshape(-1, 3)}
        with_dither_colors = {tuple(pixel) for pixel in np.array(with_dither).reshape(-1, 3)}

        assert no_dither_colors.issubset(set(palette))
        assert with_dither_colors.issubset(set(palette))
        assert not np.array_equal(np.array(no_dither), np.array(with_dither))


class TestAdjustBrightnessContrast:
    def test_auto_adjust_increases_dynamic_range(self):
        pixels = np.array(
            [
                [[110, 110, 110], [118, 118, 118]],
                [[124, 124, 124], [130, 130, 130]],
            ],
            dtype=np.uint8,
        )
        image = Image.fromarray(pixels, mode="RGB")

        result = adjust_brightness_contrast(image, auto_adjust=True)

        before = np.array(image)[:, :, 0]
        after = np.array(result)[:, :, 0]
        assert (after.max() - after.min()) > (before.max() - before.min())

    def test_manual_override_changes_brightness(self):
        image = _gradient_image(8, 8)

        darker = adjust_brightness_contrast(image, brightness=0.5, contrast=1.0)

        assert np.array(darker).mean() < np.array(image).mean()


class TestPreprocessImage:
    def test_preprocess_image_runs_end_to_end(self):
        image = _gradient_image(32, 16)
        allowed_colors = {
            tuple(block["rgb"])
            for block in BlockColorMatcher(palette="wool").blocks
        }

        result = preprocess_image(
            image,
            target_width=8,
            target_height=8,
            palette="wool",
            dithering=True,
            auto_adjust=True,
            brightness=1.0,
            contrast=1.1,
        )

        assert result.size == (8, 8)
        assert result.mode == "RGB"
        assert {
            tuple(pixel) for pixel in np.array(result).reshape(-1, 3)
        }.issubset(allowed_colors)

    def test_resize_rejects_non_positive_dimensions(self):
        image = Image.new("RGB", (4, 4), (255, 255, 255))

        with pytest.raises(ValueError, match="positive"):
            resize_image(image, 0, 8)
