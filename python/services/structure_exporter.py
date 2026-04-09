"""Export a BlockGrid to vanilla Minecraft structure (.nbt) format."""

from __future__ import annotations

import gzip
import io
from typing import Literal

import nbtlib
from nbtlib import Compound, List, String, Int, ByteArray

from services.block_mapper import BlockGrid
from services.grid_extruder import BlockGrid3D

# MC 1.20.1 data version
DATA_VERSION = 2860

# Structure void is the vanilla way to mark "no block" / transparent pixels
STRUCTURE_VOID = "minecraft:structure_void"

Orientation = Literal["floor", "wall"]
GridInput = BlockGrid | BlockGrid3D


def grid_to_structure(
    block_grid: GridInput,
    orientation: Orientation = "floor",
    transparent_ids: set[str] | None = None,
) -> bytes:
    """
    Convert a BlockGrid to a gzip-compressed vanilla Minecraft structure (.nbt) file.

    The 2D grid is treated as 1 block deep:
      - floor:  grid lies flat on the XZ plane  (Y = 1)
      - wall:   grid stands upright on the XY plane (Z = 1)

    Transparent pixels are written as structure_void blocks (DEV-204).

    Args:
        block_grid:       BlockGrid produced by image_to_block_grid().
        orientation:      "floor" or "wall".
        transparent_ids:  Set of block IDs to treat as transparent/void.
                          Defaults to {"minecraft:structure_void"}.

    Returns:
        Raw bytes of the gzip-compressed .nbt structure file.
    """
    if transparent_ids is None:
        transparent_ids = {STRUCTURE_VOID}

    is_3d = isinstance(block_grid, BlockGrid3D)
    grid_height = block_grid.height
    grid_width  = block_grid.width

    # ── Structure dimensions ──────────────────────────────────────────────────
    if is_3d:
        extrusion_depth = block_grid.depth
        if orientation == "floor":
            size_x, size_y, size_z = grid_width, extrusion_depth, grid_height
        else:
            size_x, size_y, size_z = grid_width, grid_height, extrusion_depth
    else:
        if orientation == "floor":
            size_x, size_y, size_z = grid_width, 1, grid_height
        else:
            size_x, size_y, size_z = grid_width, grid_height, 1

    # ── Build palette ─────────────────────────────────────────────────────────
    unique_ids: list[str] = []
    id_to_index: dict[str, int] = {}

    def _register(bid: str) -> int:
        bid = _ensure_namespace(bid)
        if bid not in id_to_index:
            id_to_index[bid] = len(unique_ids)
            unique_ids.append(bid)
        return id_to_index[bid]

    _register(STRUCTURE_VOID)

    if is_3d:
        for y_layer in block_grid.blocks:
            for z_row in y_layer:
                for block in z_row:
                    _register(block["id"])
    else:
        for row in block_grid.to_block_id_grid():
            for bid in row:
                _register(bid)

    palette_nbt = List[Compound]([
        Compound({"Name": String(bid), "Properties": Compound({})})
        for bid in unique_ids
    ])

    # ── Build blocks list ─────────────────────────────────────────────────────
    blocks_nbt: list[Compound] = []

    def _add_block(x: int, y: int, z: int, bid: str) -> None:
        bid = _ensure_namespace(bid)
        state = id_to_index.get(bid, 0)
        if bid in transparent_ids:
            state = id_to_index[STRUCTURE_VOID]
        blocks_nbt.append(_make_block(x, y, z, state))

    if is_3d:
        if orientation == "floor":
            for z in range(size_z):
                for x in range(size_x):
                    for y in range(size_y):
                        _add_block(x, y, z, block_grid.blocks[z][y][x]["id"])
        else:
            for y in range(size_y):
                grid_row = grid_height - 1 - y
                for z in range(size_z):
                    for x in range(size_x):
                        _add_block(x, y, z, block_grid.blocks[grid_row][z][x]["id"])
    else:
        id_grid = block_grid.to_block_id_grid()
        if orientation == "floor":
            for z in range(size_z):
                for x in range(size_x):
                    _add_block(x, 0, z, id_grid[z][x])
        else:
            for y in range(size_y):
                grid_row = grid_height - 1 - y
                for x in range(size_x):
                    _add_block(x, y, 0, id_grid[grid_row][x])

    # ── Assemble NBT structure ────────────────────────────────────────────────
    nbt_data = Compound({
        "DataVersion": Int(DATA_VERSION),
        "author":      String("minecraft-ai-builder"),
        "size":        List[Int]([Int(size_x), Int(size_y), Int(size_z)]),
        "palette":     palette_nbt,
        "blocks":      List[Compound](blocks_nbt),
        "entities":    List[Compound]([]),
    })

    nbt_file = nbtlib.File(nbt_data)
    buf = io.BytesIO()
    nbt_file.write(buf)
    return gzip.compress(buf.getvalue())


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_namespace(block_id: str) -> str:
    """Guarantee the minecraft: namespace prefix is present."""
    if ":" not in block_id:
        return f"minecraft:{block_id}"
    return block_id


def _make_block(x: int, y: int, z: int, state: int) -> Compound:
    """Build a single block entry for the blocks list."""
    return Compound({
        "pos":   List[Int]([Int(x), Int(y), Int(z)]),
        "state": Int(state),
    })