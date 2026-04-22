"""Unit tests for the image preprocessing pipeline."""

import numpy as np
import pytest
from PIL import Image

from services.color_matcher import BlockColorMatcher
from services.image_processor import (
    adjust_brightness_contrast,
    flatten_for_blocks,
    preprocess_image,
    quantize_colors,
    resize_image,
)


TEST_PALETTE = [
    {"id": "test:black", "name": "Black", "rgb": [0, 0, 0], "category": "test"},
    {"id": "test:white", "name": "White", "rgb": [255, 255, 255], "category": "test"},
    {"id": "test:red", "name": "Red", "rgb": [255, 0, 0], "category": "test"},
    {"id": "test:gray", "name": "Gray", "rgb": [128, 128, 128], "category": "test"},
]


def _gradient_image(width: int = 16, height: int = 16) -> Image.Image:
    gradient = np.tile(np.linspace(0, 255, width, dtype=np.uint8), (height, 1))
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
            return original_resize(self, size, resample=resample, box=box, reducing_gap=reducing_gap)

        monkeypatch.setattr(Image.Image, "resize", tracking_resize)
        resize_image(image, 5, 5)
        assert called["resample"] == Image.Resampling.LANCZOS


class TestFlattenForBlocks:
    """Tests for the flatten_for_blocks preprocessing step."""

    def test_returns_rgb_image_same_size(self):
        image = _gradient_image(16, 16)
        result = flatten_for_blocks(image)
        assert result.mode == "RGB"
        assert result.size == image.size

    def test_reduces_unique_colors(self):
        """Posterization should reduce the number of distinct colors."""
        image = _gradient_image(32, 32)
        before_colors = len({tuple(p) for p in np.array(image).reshape(-1, 3)})
        result = flatten_for_blocks(image)
        after_colors = len({tuple(p) for p in np.array(result).reshape(-1, 3)})
        assert after_colors <= before_colors

    def test_output_is_valid_rgb(self):
        """Output pixels should all be valid 0-255 RGB values."""
        image = _gradient_image(16, 16)
        result = flatten_for_blocks(image)
        arr = np.array(result)
        assert arr.min() >= 0
        assert arr.max() <= 255
        assert arr.shape[2] == 3

    def test_does_not_crash_on_solid_color(self):
        """Should handle a solid color image without error."""
        image = Image.new("RGB", (8, 8), (100, 150, 200))
        result = flatten_for_blocks(image)
        assert result.size == (8, 8)


class TestQuantizeColors:
    def test_quantize_colors_limits_output_to_palette(self):
        image = _gradient_image(8, 2)
        palette = [(0, 0, 0), (255, 255, 255)]
        result = quantize_colors(image, palette, dithering=False)
        unique_colors = {tuple(pixel) for pixel in np.array(result).reshape(-1, 3)}
        assert unique_colors.issubset(set(palette))

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
            [[[110, 110, 110], [118, 118, 118]], [[124, 124, 124], [130, 130, 130]]],
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
        """preprocess_image should resize and quantize to palette colors."""
        image = _gradient_image(32, 16)
        allowed_colors = {tuple(b["rgb"]) for b in TEST_PALETTE}

        result = preprocess_image(
            image,
            target_width=8,
            target_height=8,
            palette=TEST_PALETTE,
            dithering=False,
            auto_adjust=False,
            brightness=1.0,
            contrast=1.0,
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