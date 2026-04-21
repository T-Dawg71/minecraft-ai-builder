import os
import json
from unittest import mock
"""Unit tests for color matching service."""

import pytest
import numpy as np
from services.color_matcher import (
    BlockColorMatcher,
    rgb_distance_euclidean,
    rgb_distance_weighted,
    delta_e_cie76,
    _rgb_to_lab,
)


class TestColorDistanceAlgorithms:
    """Tests for the three distance algorithms."""

    def test_euclidean_identical_colors(self):
        assert rgb_distance_euclidean((100, 100, 100), (100, 100, 100)) == 0.0

    def test_euclidean_known_distance(self):
        dist = rgb_distance_euclidean((0, 0, 0), (255, 255, 255))
        assert round(dist, 1) == 441.7  # sqrt(255^2 * 3)

    def test_weighted_identical_colors(self):
        assert rgb_distance_weighted((100, 100, 100), (100, 100, 100)) == 0.0

    def test_weighted_green_matters_more(self):
        """Green channel should have more weight than red or blue."""
        red_diff = rgb_distance_weighted((255, 0, 0), (0, 0, 0))
        green_diff = rgb_distance_weighted((0, 255, 0), (0, 0, 0))
        blue_diff = rgb_distance_weighted((0, 0, 255), (0, 0, 0))
        assert green_diff > red_diff > blue_diff

    def test_delta_e_identical_colors(self):
        dist = delta_e_cie76((100, 100, 100), (100, 100, 100))
        assert dist == 0.0

    def test_delta_e_black_white_large_distance(self):
        dist = delta_e_cie76((0, 0, 0), (255, 255, 255))
        assert dist > 90  # Should be ~100 in LAB


class TestRGBToLAB:
    """Tests for RGB to LAB conversion."""

    def test_black(self):
        l, a, b = _rgb_to_lab((0, 0, 0))
        assert round(l) == 0

    def test_white(self):
        l, a, b = _rgb_to_lab((255, 255, 255))
        assert round(l) == 100

    def test_neutral_gray_near_zero_ab(self):
        l, a, b = _rgb_to_lab((128, 128, 128))
        class TestBlockColorMatcher:
            """Tests for the BlockColorMatcher class."""

            def setup_method(self):
                self.matcher = BlockColorMatcher()

            def test_loads_blocks(self):
                assert self.matcher.palette_size >= 150

            def test_find_closest_white(self):
                result = self.matcher.find_closest_block((255, 255, 255))
                assert "snow" in result["name"].lower() or "white" in result["name"].lower()

            def test_find_closest_black(self):
                result = self.matcher.find_closest_block((0, 0, 0))
                assert (
                    "black" in result["name"].lower()
                    or "obsidian" in result["name"].lower()
                    or "coal" in result["name"].lower()
                )

            def test_result_has_required_fields(self):
                result = self.matcher.find_closest_block((128, 128, 128))
                assert "id" in result
                assert "name" in result
                assert "rgb" in result
                assert "category" in result
                assert "distance" in result

            def test_distance_is_zero_for_exact_match(self):
                """If we query an exact block color, distance should be 0."""
                result = self.matcher.find_closest_block((233, 236, 236))  # White Wool
                assert result["distance"] < 1.0

            def test_cache_returns_same_result(self):
                result1 = self.matcher.find_closest_block((100, 150, 200))
                result2 = self.matcher.find_closest_block((100, 150, 200))
                assert result1["id"] == result2["id"]

            def test_batch_returns_correct_count(self):
                colors = np.array([[255, 0, 0], [0, 255, 0], [0, 0, 255]])
                results = self.matcher.find_closest_blocks_batch(colors)
                assert len(results) == 3

            def test_batch_matches_single(self):
                """Batch results should match individual lookups."""
                colors = np.array([[255, 0, 0], [0, 255, 0], [0, 0, 255]])
                batch_results = self.matcher.find_closest_blocks_batch(colors)
                for i, rgb in enumerate(colors):
                    single = self.matcher.find_closest_block(tuple(rgb))
                    assert batch_results[i]["id"] == single["id"]

            def test_palette_info(self):
                info = self.matcher.get_palette_info()
                assert info["total_blocks"] >= 150
                assert "wool" in info["categories"]
                assert "concrete" in info["categories"]

            def test_performance_benchmark(self):
                """262,144 pixels (512x512) should complete in under 5 seconds."""
                import time
                colors = np.random.randint(0, 256, size=(262144, 3))
                start = time.time()
                self.matcher.find_closest_blocks_batch(colors)
                elapsed = time.time() - start
                assert elapsed < 5.0, f"Benchmark took {elapsed:.2f}s, expected under 5s"

            # --- Coverage tests for _filter_by_palette error/edge cases ---
            def test_filter_by_palette_file_not_found(self, tmp_path):
                matcher = BlockColorMatcher()
                with mock.patch("services.color_matcher.os.path.exists", return_value=False):
                    with pytest.raises(FileNotFoundError):
                        matcher._filter_by_palette("nonexistent")

            def test_filter_by_palette_unknown_palette(self, tmp_path):
                palettes = {"foo": {"categories": ["wool"]}}
                fake_path = tmp_path / "palettes.json"
                fake_path.write_text(json.dumps(palettes))
                with mock.patch("services.color_matcher.os.path.exists", return_value=True), \
                     mock.patch("services.color_matcher.open", mock.mock_open(read_data=json.dumps(palettes))):
                    matcher = BlockColorMatcher()
                    with pytest.raises(ValueError):
                        matcher._filter_by_palette("bar")

            def test_filter_by_palette_else_branch(self, tmp_path):
                palettes = {"foo": {"other": 123}}
                fake_path = tmp_path / "palettes.json"
                fake_path.write_text(json.dumps(palettes))
                with mock.patch("services.color_matcher.os.path.exists", return_value=True), \
                     mock.patch("services.color_matcher.open", mock.mock_open(read_data=json.dumps(palettes))):
                    matcher = BlockColorMatcher()
                    result = matcher._filter_by_palette("foo")
                    assert isinstance(result, list)
                    assert len(result) == len(matcher.blocks) or len(result) == len(matcher._lab_colors)
                    assert batch_results[i]["id"] == single["id"]

            def test_palette_info(self):
                info = self.matcher.get_palette_info()
                assert info["total_blocks"] >= 150
                assert "wool" in info["categories"]
                assert "concrete" in info["categories"]

            def test_performance_benchmark(self):
                """262,144 pixels (512x512) should complete in under 5 seconds."""
                import time
                colors = np.random.randint(0, 256, size=(262144, 3))
                start = time.time()
                self.matcher.find_closest_blocks_batch(colors)
                elapsed = time.time() - start
                assert elapsed < 5.0, f"Benchmark took {elapsed:.2f}s, expected under 5s"

            # --- Coverage tests for _filter_by_palette error/edge cases ---
            def test_filter_by_palette_file_not_found(self, tmp_path):
                matcher = BlockColorMatcher()
                with mock.patch("services.color_matcher.os.path.exists", return_value=False):
                    with pytest.raises(FileNotFoundError):
                        matcher._filter_by_palette("nonexistent")

            def test_filter_by_palette_unknown_palette(self, tmp_path):
                palettes = {"foo": {"categories": ["wool"]}}
                fake_path = tmp_path / "palettes.json"
                fake_path.write_text(json.dumps(palettes))
                with mock.patch("services.color_matcher.os.path.exists", return_value=True), \
                     mock.patch("services.color_matcher.open", mock.mock_open(read_data=json.dumps(palettes))):
                    matcher = BlockColorMatcher()
                    with pytest.raises(ValueError):
                        matcher._filter_by_palette("bar")

            def test_filter_by_palette_else_branch(self, tmp_path):
                palettes = {"foo": {"other": 123}}
                fake_path = tmp_path / "palettes.json"
                fake_path.write_text(json.dumps(palettes))
                with mock.patch("services.color_matcher.os.path.exists", return_value=True), \
                     mock.patch("services.color_matcher.open", mock.mock_open(read_data=json.dumps(palettes))):
                    matcher = BlockColorMatcher()
                    result = matcher._filter_by_palette("foo")
                    assert isinstance(result, list)
                    assert len(result) == len(matcher.blocks) or len(result) == len(matcher._lab_colors)