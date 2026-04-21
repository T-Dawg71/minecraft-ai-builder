"""
Color Matching Service
Finds the closest Minecraft block for any given RGB color.
Supports multiple color distance algorithms and palette filtering.
"""

import json
import os
import math
import numpy as np
from scipy.spatial import KDTree
from typing import Optional

# Load block colors on import
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "block_colors.json")
with open(DATA_PATH, "r") as f:
    ALL_BLOCKS = json.load(f)


def _rgb_to_lab(rgb):
    """Convert RGB (0-255) to CIE LAB color space."""
    # Step 1: RGB to linear RGB
    r, g, b = [c / 255.0 for c in rgb]
    r = ((r + 0.055) / 1.055) ** 2.4 if r > 0.04045 else r / 12.92
    g = ((g + 0.055) / 1.055) ** 2.4 if g > 0.04045 else g / 12.92
    b = ((b + 0.055) / 1.055) ** 2.4 if b > 0.04045 else b / 12.92

    # Step 2: Linear RGB to XYZ (D65 illuminant)
    x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041

    # Step 3: XYZ to LAB
    x /= 0.95047
    y /= 1.00000
    z /= 1.08883

    def f(t):
        return t ** (1/3) if t > 0.008856 else (7.787 * t) + (16 / 116)

    l = (116 * f(y)) - 16
    a = 500 * (f(x) - f(y))
    b_val = 200 * (f(y) - f(z))

    return (l, a, b_val)


def rgb_distance_euclidean(c1, c2):
    """Simple Euclidean distance in RGB space."""
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))


def rgb_distance_weighted(c1, c2):
    """
    Weighted Euclidean distance adjusted for human perception.
    Red and blue are perceived less strongly than green.
    """
    dr = c1[0] - c2[0]
    dg = c1[1] - c2[1]
    db = c1[2] - c2[2]
    return math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db)


def delta_e_cie76(c1_rgb, c2_rgb):
    """CIE76 Delta-E distance in LAB color space. Most perceptually accurate."""
    lab1 = _rgb_to_lab(c1_rgb)
    lab2 = _rgb_to_lab(c2_rgb)
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(lab1, lab2)))


class BlockColorMatcher:
    """
    Finds the closest Minecraft block for any RGB color.
    Uses a KD-Tree in LAB color space for fast O(log n) lookups.
    """

    def __init__(self, palette: Optional[str] = None, block_list: Optional[list] = None):
        """
        Initialize the matcher with a block palette.

        Args:
            palette: Name of a preset palette (None = all blocks)
            block_list: Custom list of block dicts to use instead of a preset
        """
        if block_list is not None:
            self.blocks = block_list
        elif palette:
            self.blocks = self._filter_by_palette(palette)
        else:
            self.blocks = ALL_BLOCKS

        # Pre-compute LAB colors and build KD-Tree
        self._lab_colors = [_rgb_to_lab(b["rgb"]) for b in self.blocks]
        self._kdtree = KDTree(self._lab_colors)

        # Cache for repeated lookups
        self._cache = {}

    def _filter_by_palette(self, palette_name: str) -> list:
        """Filter blocks by palette preset name."""
        palette_path = os.path.join(os.path.dirname(__file__), "..", "data", "palettes.json")

        if not os.path.exists(palette_path):
            raise FileNotFoundError(f"Palettes file not found: {palette_path}")

        with open(palette_path, "r") as f:
            palettes = json.load(f)

        if palette_name not in palettes:
            available = ", ".join(palettes.keys())
            raise ValueError(f"Unknown palette '{palette_name}'. Available: {available}")

        preset = palettes[palette_name]

        if "categories" in preset:
            return [b for b in ALL_BLOCKS if b.get("category") in preset["categories"]]
        elif "block_ids" in preset:
            ids = set(preset["block_ids"])
            return [b for b in ALL_BLOCKS if b["id"] in ids]
        else:
            return ALL_BLOCKS

    def find_closest_block(self, rgb: tuple) -> dict:
        """
        Find the closest Minecraft block to the given RGB color.

        Args:
            rgb: Tuple of (r, g, b) values 0-255

        Returns:
            Block dict with id, name, rgb, category, and distance
        """
        cache_key = tuple(rgb)
        if cache_key in self._cache:
            return self._cache[cache_key]

        lab = _rgb_to_lab(rgb)
        distance, index = self._kdtree.query(lab)

        result = {
            **self.blocks[index],
            "distance": float(distance),
        }

        self._cache[cache_key] = result
        return result

    def find_closest_blocks_batch(self, rgb_array: np.ndarray) -> list:
        """
        Find closest blocks for an array of RGB colors.
        Vectorized for performance on large images.

        Args:
            rgb_array: numpy array of shape (N, 3) with RGB values 0-255

        Returns:
            List of block dicts for each input color
        """
        # Convert all RGB values to LAB
        lab_array = np.array([_rgb_to_lab(tuple(rgb)) for rgb in rgb_array])

        # Batch query the KD-Tree
        distances, indices = self._kdtree.query(lab_array)

        results = []
        for i, (dist, idx) in enumerate(zip(distances, indices)):
            results.append({
                **self.blocks[idx],
                "distance": float(dist),
            })

        return results

    @property
    def palette_size(self) -> int:
        """Number of blocks in the current palette."""
        return len(self.blocks)

    def get_palette_info(self) -> dict:
        """Get summary info about the current palette."""
        categories = {}
        for b in self.blocks:
            cat = b.get("category")
            if cat is not None:
                categories[cat] = categories.get(cat, 0) + 1
        return {
            "total_blocks": len(self.blocks),
            "categories": categories,
        }


# Quick test when running directly
if __name__ == "__main__":
    import time

    matcher = BlockColorMatcher()
    print(f"Loaded {matcher.palette_size} blocks")
    print()

    # Test specific colors
    test_colors = [
        ((255, 0, 0), "Pure Red"),
        ((0, 255, 0), "Pure Green"),
        ((0, 0, 255), "Pure Blue"),
        ((255, 255, 255), "White"),
        ((0, 0, 0), "Black"),
        ((139, 90, 43), "Brown"),
        ((135, 206, 235), "Sky Blue"),
        ((255, 215, 0), "Gold"),
    ]

    for rgb, name in test_colors:
        result = matcher.find_closest_block(rgb)
        print(f"{name} {rgb} → {result['name']} {result['rgb']} (Δ={result['distance']:.2f})")

    # Benchmark
    print("\nBenchmarking 512x512 image (262,144 pixels)...")
    random_colors = np.random.randint(0, 256, size=(262144, 3))
    start = time.time()
    results = matcher.find_closest_blocks_batch(random_colors)
    elapsed = time.time() - start
    print(f"Completed in {elapsed:.2f}s ({262144/elapsed:.0f} pixels/sec)")