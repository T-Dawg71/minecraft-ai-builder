"""Extrude a 2D BlockGrid into a 3D structure with configurable depth."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from services.block_mapper import BlockGrid

DepthMode = Literal["flat", "relief"]

MIN_DEPTH = 1
MAX_DEPTH = 10


@dataclass(slots=True)
class BlockGrid3D:
    """A 3D Minecraft block layout produced by extruding a 2D BlockGrid."""

    width:  int   # X
    height: int   # Y
    depth:  int   # Z
    # blocks[y][z][x] — Y outer, Z middle, X inner
    blocks: list[list[list[dict]]]

    def to_block_id_grid_3d(self) -> list[list[list[str]]]:
        """Return just the block IDs for each cell in the 3D grid."""
        return [
            [[block["id"] for block in row] for row in layer]
            for layer in self.blocks
        ]


def extrude_grid(
    block_grid: BlockGrid,
    depth: int = 1,
    mode: DepthMode = "flat",
) -> BlockGrid3D:
    """
    Extrude a 2D BlockGrid into a 3D BlockGrid3D.

    Flat mode (DEV-209):
        Every column is extruded uniformly to `depth` blocks deep along Z.

    Relief mode (DEV-210):
        Each pixel's extrusion depth is varied by its approximate brightness,
        producing a bas-relief effect. Brighter pixels extrude further.

    Args:
        block_grid: Source 2D BlockGrid.
        depth:      Maximum extrusion depth (1-10 blocks).
        mode:       "flat" for uniform depth, "relief" for brightness-based depth.

    Returns:
        BlockGrid3D with axes Width=X, Height=Y (grid rows), Depth=Z (extrusion).
    """
    depth = max(MIN_DEPTH, min(MAX_DEPTH, depth))

    grid_rows = block_grid.height   # Y
    grid_cols = block_grid.width    # X
    id_grid   = block_grid.to_block_id_grid()

    # Precompute per-cell extrusion depth
    cell_depth: list[list[int]] = []
    for r in range(grid_rows):
        row_depths: list[int] = []
        for c in range(grid_cols):
            if mode == "relief":
                block = block_grid.blocks[r][c]
                brightness = _block_brightness(block)
                # Map brightness (0-255) to depth range (1-depth)
                d = max(1, round(1 + (brightness / 255) * (depth - 1)))
            else:
                d = depth
            row_depths.append(d)
        cell_depth.append(row_depths)

    # Build 3D block array: blocks[y][z][x]
    # Y = grid row, Z = extrusion layer (0 = back, depth-1 = front)
    # Air block used as filler beyond a cell's individual depth
    air_block = {"id": "minecraft:air", "name": "Air"}

    blocks_3d: list[list[list[dict]]] = []
    for r in range(grid_rows):          # Y
        y_layer: list[list[dict]] = []
        for z in range(depth):          # Z (extrusion)
            z_row: list[dict] = []
            for c in range(grid_cols):  # X
                if z < cell_depth[r][c]:
                    z_row.append(block_grid.blocks[r][c])
                else:
                    z_row.append(air_block)
            y_layer.append(z_row)
        blocks_3d.append(y_layer)

    return BlockGrid3D(
        width=grid_cols,
        height=grid_rows,
        depth=depth,
        blocks=blocks_3d,
    )


# Helpers

def _block_brightness(block: dict) -> float:
    """
    Estimate brightness from a block dict.
    Uses the 'rgb' key if present, otherwise falls back to 128 (mid-grey).
    """
    rgb = block.get("rgb")
    if rgb and len(rgb) == 3:
        r, g, b = rgb
        # Standard luminance formula
        return 0.299 * r + 0.587 * g + 0.114 * b
    return 128.0