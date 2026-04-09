"""Export a BlockGrid to .schem (Sponge Schematic v2) format."""

from __future__ import annotations

import gzip
import io
from typing import Literal

import nbtlib
from nbtlib import Compound, List, String, Int, Short, ByteArray, tag

from services.block_mapper import BlockGrid
from services.grid_extruder import BlockGrid3D

Orientation = Literal["floor", "wall"]

GridInput = BlockGrid | BlockGrid3D


def grid_to_schematic(
    block_grid: GridInput,
    orientation: Orientation = "floor",
) -> bytes:
    """
    Convert a BlockGrid to a gzip-compressed Sponge Schematic v2 (.schem) binary.

    The 2D grid is treated as 1 block deep:
      - floor:  grid lies flat on the XZ plane  (Y = 1)
      - wall:   grid stands upright on the XY plane (Z = 1)

    Args:
        block_grid: BlockGrid produced by image_to_block_grid().
        orientation: "floor" or "wall".

    Returns:
        Raw bytes of the gzip-compressed .schem NBT file.
    """
    is_3d = isinstance(block_grid, BlockGrid3D)
    grid_width  = block_grid.width
    grid_height = block_grid.height

    # ── Schematic dimensions ──────────────────────────────────────────────────
    if is_3d:
        extrusion_depth = block_grid.depth
        if orientation == "floor":
            schem_width  = grid_width
            schem_height = extrusion_depth
            schem_length = grid_height
        else:
            schem_width  = grid_width
            schem_height = grid_height
            schem_length = extrusion_depth
    else:
        if orientation == "floor":
            schem_width  = grid_width
            schem_height = 1
            schem_length = grid_height
        else:
            schem_width  = grid_width
            schem_height = grid_height
            schem_length = 1

    # ── Build block palette ───────────────────────────────────────────────────
    unique_ids: list[str] = ["minecraft:air"]
    id_to_index: dict[str, int] = {"minecraft:air": 0}

    def _register(bid: str) -> int:
        bid = _ensure_namespace(bid)
        if bid not in id_to_index:
            id_to_index[bid] = len(unique_ids)
            unique_ids.append(bid)
        return id_to_index[bid]

    if is_3d:
        for y_layer in block_grid.blocks:
            for z_row in y_layer:
                for block in z_row:
                    _register(block["id"])
    else:
        for row in block_grid.to_block_id_grid():
            for bid in row:
                _register(bid)

    # ── Build BlockData array (varint-encoded) ────────────────────────────────
    block_data: list[int] = []

    if is_3d:
        if orientation == "floor":
            # Y = extrusion depth, Z = grid rows, X = grid cols
            for z in range(schem_length):
                for x in range(schem_width):
                    for y in range(schem_height):
                        bid = _ensure_namespace(block_grid.blocks[z][y][x]["id"])
                        block_data.append(id_to_index[bid])
        else:
            for y in range(schem_height):
                grid_row = grid_height - 1 - y
                for z in range(schem_length):
                    for x in range(schem_width):
                        bid = _ensure_namespace(block_grid.blocks[grid_row][z][x]["id"])
                        block_data.append(id_to_index[bid])
    else:
        id_grid = block_grid.to_block_id_grid()
        if orientation == "floor":
            for z in range(schem_length):
                for x in range(schem_width):
                    bid = _ensure_namespace(id_grid[z][x])
                    block_data.append(id_to_index[bid])
        else:
            for y in range(schem_height):
                grid_row = grid_height - 1 - y
                for x in range(schem_width):
                    bid = _ensure_namespace(id_grid[grid_row][x])
                    block_data.append(id_to_index[bid])

    encoded = _encode_varints(block_data)

    # ── Assemble NBT structure ────────────────────────────────────────────────
    palette_nbt = Compound({
        bid: Int(idx) for bid, idx in id_to_index.items()
    })

    nbt_data = Compound({
        "Version":     Int(2),
        "DataVersion": Int(2860),          # MC 1.20.1
        "Width":       Short(schem_width),
        "Height":      Short(schem_height),
        "Length":      Short(schem_length),
        "PaletteMax":  Int(len(unique_ids)),
        "Palette":     palette_nbt,
        "BlockData":   ByteArray(encoded),
        "Metadata":    Compound({
            "WEOffsetX": Int(0),
            "WEOffsetY": Int(0),
            "WEOffsetZ": Int(0),
        }),
    })

    # ── Wrap in named root tag and gzip-compress ──────────────────────────────
    nbt_file = nbtlib.File({"Schematic": nbt_data})
    buf = io.BytesIO()
    nbt_file.write(buf)
    return gzip.compress(buf.getvalue())


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_namespace(block_id: str) -> str:
    """Guarantee the minecraft: namespace prefix is present (DEV-197)."""
    if ":" not in block_id:
        return f"minecraft:{block_id}"
    return block_id


def _encode_varints(values: list[int]) -> list[int]:
    """Encode a list of integers as a flat varint byte sequence."""
    out: list[int] = []
    for v in values:
        while True:
            byte = v & 0x7F
            v >>= 7
            if v:
                out.append(byte | 0x80)
            else:
                out.append(byte)
                break
    return out