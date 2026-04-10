"""Unit tests for schematic_exporter.py (DEV-199)."""

from __future__ import annotations

import gzip
import io

import nbtlib
import pytest

from services.block_mapper import BlockGrid
from services.schematic_exporter import grid_to_schematic, _ensure_namespace, _encode_varints


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_grid(rows: list[list[str]]) -> BlockGrid:
    """Build a minimal BlockGrid from a 2D list of block ID strings."""
    height = len(rows)
    width  = len(rows[0]) if rows else 0
    blocks = [[{"id": bid, "name": bid} for bid in row] for row in rows]
    palette_used = {}
    for row in rows:
        for bid in row:
            palette_used[bid] = palette_used.get(bid, 0) + 1
    return BlockGrid(width=width, height=height, blocks=blocks, palette_used=palette_used)


def _parse_schem(data: bytes) -> nbtlib.Compound:
    """Decompress and parse .schem bytes back to an NBT Compound."""
    raw = gzip.decompress(data)
    nbt = nbtlib.File.parse(io.BytesIO(raw))
    return nbt["Schematic"]


# ── _ensure_namespace ─────────────────────────────────────────────────────────

def test_ensure_namespace_adds_prefix():
    assert _ensure_namespace("stone") == "minecraft:stone"

def test_ensure_namespace_keeps_existing():
    assert _ensure_namespace("minecraft:stone") == "minecraft:stone"

def test_ensure_namespace_keeps_other_namespace():
    assert _ensure_namespace("custom:block") == "custom:block"


# ── _encode_varints ───────────────────────────────────────────────────────────

def test_encode_varint_single_byte():
    assert _encode_varints([0]) == [0]
    assert _encode_varints([127]) == [127]

def test_encode_varint_two_bytes():
    # 128 = 0x80 → [0x80, 0x01]
    assert _encode_varints([128]) == [0x80, 0x01]

def test_encode_varint_multiple():
    result = _encode_varints([0, 1, 128])
    assert result == [0, 1, 0x80, 0x01]


# ── grid_to_schematic — output is valid gzip NBT ──────────────────────────────

def test_output_is_gzip():
    grid = _make_grid([["minecraft:stone"]])
    data = grid_to_schematic(grid)
    assert data[:2] == b"\x1f\x8b"   # gzip magic bytes

def test_output_parses_as_nbt():
    grid = _make_grid([["minecraft:stone"]])
    data = grid_to_schematic(grid)
    schem = _parse_schem(data)
    assert "Version" in schem


# ── Sponge Schematic v2 required fields (DEV-196) ────────────────────────────

def test_version_is_2():
    grid = _make_grid([["minecraft:grass_block"]])
    schem = _parse_schem(grid_to_schematic(grid))
    assert int(schem["Version"]) == 2

def test_required_fields_present():
    grid = _make_grid([["minecraft:stone", "minecraft:dirt"]])
    schem = _parse_schem(grid_to_schematic(grid))
    for field in ("Width", "Height", "Length", "PaletteMax", "Palette", "BlockData", "Metadata"):
        assert field in schem, f"Missing field: {field}"

def test_palette_max_matches_palette_size():
    grid = _make_grid([["minecraft:stone", "minecraft:dirt"]])
    schem = _parse_schem(grid_to_schematic(grid))
    assert int(schem["PaletteMax"]) == len(schem["Palette"])

def test_air_always_in_palette():
    grid = _make_grid([["minecraft:stone"]])
    schem = _parse_schem(grid_to_schematic(grid))
    assert "minecraft:air" in schem["Palette"]


# ── Floor orientation (DEV-195) ───────────────────────────────────────────────

def test_floor_dimensions_2x3():
    # 2 rows, 3 cols → Width=3, Height=1, Length=2
    grid = _make_grid([
        ["minecraft:stone", "minecraft:dirt", "minecraft:sand"],
        ["minecraft:stone", "minecraft:dirt", "minecraft:sand"],
    ])
    schem = _parse_schem(grid_to_schematic(grid, orientation="floor"))
    assert int(schem["Width"])  == 3
    assert int(schem["Height"]) == 1
    assert int(schem["Length"]) == 2

def test_floor_block_data_length():
    grid = _make_grid([
        ["minecraft:stone", "minecraft:dirt"],
        ["minecraft:sand",  "minecraft:gravel"],
    ])
    data = grid_to_schematic(grid, orientation="floor")
    schem = _parse_schem(data)
    # 2×2 floor = 4 blocks; varint-encoded bytes >= 4
    assert len(schem["BlockData"]) >= 4


# ── Wall orientation (DEV-195) ────────────────────────────────────────────────

def test_wall_dimensions_2x3():
    # 2 rows, 3 cols → Width=3, Height=2, Length=1
    grid = _make_grid([
        ["minecraft:stone", "minecraft:dirt", "minecraft:sand"],
        ["minecraft:stone", "minecraft:dirt", "minecraft:sand"],
    ])
    schem = _parse_schem(grid_to_schematic(grid, orientation="wall"))
    assert int(schem["Width"])  == 3
    assert int(schem["Height"]) == 2
    assert int(schem["Length"]) == 1


# ── Namespace handling (DEV-197) ──────────────────────────────────────────────

def test_namespace_prefix_in_palette():
    grid = _make_grid([["stone"]])   # no prefix
    schem = _parse_schem(grid_to_schematic(grid))
    assert "minecraft:stone" in schem["Palette"]

def test_existing_namespace_not_doubled():
    grid = _make_grid([["minecraft:stone"]])
    schem = _parse_schem(grid_to_schematic(grid))
    assert "minecraft:minecraft:stone" not in schem["Palette"]


# ── 1×1 edge case ─────────────────────────────────────────────────────────────

def test_single_block_floor():
    grid = _make_grid([["minecraft:diamond_block"]])
    schem = _parse_schem(grid_to_schematic(grid, orientation="floor"))
    assert int(schem["Width"])  == 1
    assert int(schem["Height"]) == 1
    assert int(schem["Length"]) == 1