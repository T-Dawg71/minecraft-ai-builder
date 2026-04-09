"""Unit tests for structure_exporter.py (DEV-206)."""

from __future__ import annotations

import gzip
import io

import nbtlib
import pytest

from services.block_mapper import BlockGrid
from services.structure_exporter import (
    grid_to_structure,
    _ensure_namespace,
    _make_block,
    DATA_VERSION,
    STRUCTURE_VOID,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_grid(rows: list[list[str]]) -> BlockGrid:
    height = len(rows)
    width  = len(rows[0]) if rows else 0
    blocks = [[{"id": bid, "name": bid} for bid in row] for row in rows]
    palette_used: dict[str, int] = {}
    for row in rows:
        for bid in row:
            palette_used[bid] = palette_used.get(bid, 0) + 1
    return BlockGrid(width=width, height=height, blocks=blocks, palette_used=palette_used)


def _parse_nbt(data: bytes) -> nbtlib.Compound:
    raw = gzip.decompress(data)
    return nbtlib.File.parse(io.BytesIO(raw))


# ── _ensure_namespace ─────────────────────────────────────────────────────────

def test_ensure_namespace_adds_prefix():
    assert _ensure_namespace("stone") == "minecraft:stone"

def test_ensure_namespace_keeps_existing():
    assert _ensure_namespace("minecraft:stone") == "minecraft:stone"

def test_ensure_namespace_no_double_prefix():
    assert _ensure_namespace("minecraft:grass_block") == "minecraft:grass_block"


# ── _make_block ───────────────────────────────────────────────────────────────

def test_make_block_positions():
    block = _make_block(1, 2, 3, 0)
    assert list(block["pos"]) == [1, 2, 3]

def test_make_block_state():
    block = _make_block(0, 0, 0, 5)
    assert int(block["state"]) == 5


# ── Output is valid gzip NBT ──────────────────────────────────────────────────

def test_output_is_gzip():
    grid = _make_grid([["minecraft:stone"]])
    data = grid_to_structure(grid)
    assert data[:2] == b"\x1f\x8b"

def test_output_parses_as_nbt():
    grid = _make_grid([["minecraft:stone"]])
    nbt = _parse_nbt(grid_to_structure(grid))
    assert "size" in nbt


# ── Required fields (DEV-202) ─────────────────────────────────────────────────

def test_required_fields_present():
    grid = _make_grid([["minecraft:stone"]])
    nbt = _parse_nbt(grid_to_structure(grid))
    for field in ("DataVersion", "size", "palette", "blocks", "entities"):
        assert field in nbt, f"Missing field: {field}"

def test_data_version(  ):
    grid = _make_grid([["minecraft:stone"]])
    nbt = _parse_nbt(grid_to_structure(grid))
    assert int(nbt["DataVersion"]) == DATA_VERSION  # DEV-203


# ── Size field ────────────────────────────────────────────────────────────────

def test_floor_size_2x3():
    grid = _make_grid([
        ["minecraft:stone", "minecraft:dirt", "minecraft:sand"],
        ["minecraft:stone", "minecraft:dirt", "minecraft:sand"],
    ])
    nbt = _parse_nbt(grid_to_structure(grid, orientation="floor"))
    size = [int(v) for v in nbt["size"]]
    assert size == [3, 1, 2]   # [X, Y, Z]

def test_wall_size_2x3():
    grid = _make_grid([
        ["minecraft:stone", "minecraft:dirt", "minecraft:sand"],
        ["minecraft:stone", "minecraft:dirt", "minecraft:sand"],
    ])
    nbt = _parse_nbt(grid_to_structure(grid, orientation="wall"))
    size = [int(v) for v in nbt["size"]]
    assert size == [3, 2, 1]   # [X, Y, Z]

def test_single_block_size():
    grid = _make_grid([["minecraft:diamond_block"]])
    nbt = _parse_nbt(grid_to_structure(grid, orientation="floor"))
    size = [int(v) for v in nbt["size"]]
    assert size == [1, 1, 1]


# ── Palette (DEV-202) ─────────────────────────────────────────────────────────

def test_structure_void_in_palette():
    grid = _make_grid([["minecraft:stone"]])
    nbt = _parse_nbt(grid_to_structure(grid))
    names = [str(entry["Name"]) for entry in nbt["palette"]]
    assert STRUCTURE_VOID in names

def test_palette_contains_all_blocks():
    grid = _make_grid([["minecraft:stone", "minecraft:dirt"]])
    nbt = _parse_nbt(grid_to_structure(grid))
    names = {str(entry["Name"]) for entry in nbt["palette"]}
    assert "minecraft:stone" in names
    assert "minecraft:dirt" in names


# ── Blocks list (DEV-202) ─────────────────────────────────────────────────────

def test_blocks_count_floor():
    grid = _make_grid([
        ["minecraft:stone", "minecraft:dirt"],
        ["minecraft:sand",  "minecraft:gravel"],
    ])
    nbt = _parse_nbt(grid_to_structure(grid, orientation="floor"))
    assert len(nbt["blocks"]) == 4

def test_blocks_count_wall():
    grid = _make_grid([
        ["minecraft:stone", "minecraft:dirt"],
        ["minecraft:sand",  "minecraft:gravel"],
    ])
    nbt = _parse_nbt(grid_to_structure(grid, orientation="wall"))
    assert len(nbt["blocks"]) == 4


# ── Structure void / transparent pixels (DEV-204) ────────────────────────────

def test_transparent_block_becomes_void():
    grid = _make_grid([["minecraft:stone", "minecraft:glass"]])
    nbt = _parse_nbt(grid_to_structure(grid, transparent_ids={"minecraft:glass"}))
    palette_names = [str(e["Name"]) for e in nbt["palette"]]
    void_index = palette_names.index(STRUCTURE_VOID)
    # Find the block at x=1 (glass position) and check its state is void
    for block in nbt["blocks"]:
        if int(block["pos"][0]) == 1:
            assert int(block["state"]) == void_index
            break

def test_default_transparent_ids_empty_effect():
    # Without passing transparent_ids, no blocks should be auto-voided
    grid = _make_grid([["minecraft:stone"]])
    nbt = _parse_nbt(grid_to_structure(grid))
    palette_names = [str(e["Name"]) for e in nbt["palette"]]
    void_index = palette_names.index(STRUCTURE_VOID)
    for block in nbt["blocks"]:
        assert int(block["state"]) != void_index