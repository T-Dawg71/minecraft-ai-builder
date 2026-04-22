"""Unit tests for the block grid generator service."""

import time

import numpy as np
from PIL import Image

from services.color_matcher import BlockColorMatcher
from services.block_mapper import BlockGrid, image_to_block_grid


TEST_PALETTE = [
    {"id": "test:black", "name": "Black", "rgb": [0, 0, 0], "category": "test"},
    {"id": "test:white", "name": "White", "rgb": [255, 255, 255], "category": "test"},
    {"id": "test:red", "name": "Red", "rgb": [255, 0, 0], "category": "test"},
]


class TestImageToBlockGrid:
    def test_returns_block_grid_for_known_colors(self):
        image = Image.new("RGB", (2, 2))
        image.putdata([(255, 255, 255), (0, 0, 0), (255, 0, 0), (255, 255, 255)])

        grid = image_to_block_grid(image, TEST_PALETTE)

        assert isinstance(grid, BlockGrid)
        assert grid.width == 2
        assert grid.height == 2
        assert grid.palette_used == {
            "test:white": 2,
            "test:black": 1,
            "test:red": 1,
        }

    def test_progress_callback_reports_row_progress(self):
        image = Image.new("RGB", (3, 2), (255, 255, 255))
        events: list[tuple[int, int]] = []

        grid = image_to_block_grid(
            image,
            TEST_PALETTE,
            progress_callback=lambda completed, total: events.append((completed, total)),
        )

        assert grid.width == 3
        assert events
        assert events[-1] == (2, 2)
        assert len(events) == 2

    def test_repeated_colors_are_matched_once(self, monkeypatch):
        image = Image.new("RGB", (8, 8), (255, 255, 255))
        observed = {}
        original = BlockColorMatcher.find_closest_blocks_batch

        def tracking_batch(self, rgb_array):
            observed["unique_colors"] = len(rgb_array)
            return original(self, rgb_array)

        monkeypatch.setattr(BlockColorMatcher, "find_closest_blocks_batch", tracking_batch)
        image_to_block_grid(image, TEST_PALETTE)
        assert observed["unique_colors"] == 1

    def test_supports_block_list_palette(self):
        """Should accept a custom block list and return only those blocks."""
        image = Image.new("RGB", (2, 1))
        image.putdata([(255, 255, 255), (0, 0, 0)])

        grid = image_to_block_grid(image, TEST_PALETTE)
        valid_ids = {b["id"] for b in TEST_PALETTE}

        assert {cell["id"] for row in grid.blocks for cell in row}.issubset(valid_ids)

    def test_performance_target_64_by_64_under_five_seconds(self):
        """64x64 block grid should complete in under 5 seconds on Mac CPU."""
        gradient = np.tile(np.arange(64, dtype=np.uint8), (64, 1))
        rgb = np.stack([gradient, np.flipud(gradient), gradient], axis=-1)
        image = Image.fromarray(rgb, mode="RGB")

        start = time.time()
        grid = image_to_block_grid(image, TEST_PALETTE)
        elapsed = time.time() - start

        assert grid.width == 64
        assert grid.height == 64
        assert elapsed < 5.0, f"Expected <5.0s, got {elapsed:.2f}s"