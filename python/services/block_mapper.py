"""Convert images into Minecraft block grids."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
from PIL import Image

from services.color_matcher import BlockColorMatcher
from services.image_processor import PaletteInput, _ensure_rgb_image, _normalize_palette

ProgressCallback = Callable[[int, int], None]


@dataclass(slots=True)
class BlockGrid:
    """A 2D Minecraft block layout produced from an image."""

    width: int
    height: int
    blocks: list[list[dict]]
    palette_used: dict[str, int]

    def to_block_id_grid(self) -> list[list[str]]:
        """Return just the block IDs for each cell in the grid."""
        return [
            [
                block["id"] if ":" in block["id"] else f"minecraft:{block['id']}"
                for block in row
            ]
            for row in self.blocks
        ]


def image_to_block_grid(
    image: Image.Image,
    palette: PaletteInput,
    progress_callback: ProgressCallback | None = None,
) -> BlockGrid:
    """
    Map each image pixel to the closest Minecraft block in the given palette.

    Args:
        image: Input Pillow image.
        palette: Palette preset name, list of block dicts, or list of RGB triplets.
        progress_callback: Optional callback receiving `(completed_rows, total_rows)`.

    Returns:
        A `BlockGrid` containing dimensions, 2D block mappings, and palette usage counts.
    """
    normalized_image = _ensure_rgb_image(image)
    block_list = _normalize_palette(palette)
    matcher = BlockColorMatcher(block_list=block_list)

    pixels = np.array(normalized_image, dtype=np.uint8)
    height, width = pixels.shape[:2]
    flat_pixels = pixels.reshape(-1, 3)

    # Cache repeated colors by mapping only unique RGB values once.
    unique_pixels, inverse_indices = np.unique(flat_pixels, axis=0, return_inverse=True)
    unique_matches = matcher.find_closest_blocks_batch(unique_pixels)
    grid_match_indices = inverse_indices.reshape(height, width)

    blocks: list[list[dict]] = []
    palette_used: dict[str, int] = {}

    for row_index in range(height):
        row: list[dict] = []
        for match_index in grid_match_indices[row_index]:
            block = unique_matches[int(match_index)]
            row.append(block)
            block_id = block["id"]
            palette_used[block_id] = palette_used.get(block_id, 0) + 1

        blocks.append(row)

        if progress_callback is not None:
            progress_callback(row_index + 1, height)

    return BlockGrid(
        width=width,
        height=height,
        blocks=blocks,
        palette_used=palette_used,
    )
