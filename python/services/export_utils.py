"""Utilities for exporting Minecraft block grids into downloadable formats."""

from __future__ import annotations

import csv
import gzip
import json
import struct
from functools import lru_cache
from io import BytesIO, StringIO
from pathlib import Path
from typing import Literal

from PIL import Image, ImageDraw

Orientation = Literal["floor", "wall"]
ExportFormat = Literal["schem", "nbt"]
GridPayload = list[list[str]]

TAG_END = 0
TAG_SHORT = 2
TAG_INT = 3
TAG_BYTE_ARRAY = 7
TAG_STRING = 8
TAG_LIST = 9
TAG_COMPOUND = 10

DEFAULT_PREVIEW_SCALE = 24
UNKNOWN_BLOCK_COLOR = (128, 128, 128)

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_BLOCK_COLORS_PATH = _DATA_DIR / "block_colors.json"


@lru_cache(maxsize=1)
def load_block_color_map() -> dict[str, tuple[int, int, int]]:
    """Load the block color palette from the shared JSON dataset."""
    with _BLOCK_COLORS_PATH.open("r", encoding="utf-8") as handle:
        records = json.load(handle)

    color_map: dict[str, tuple[int, int, int]] = {}
    for record in records:
        block_id = str(record.get("id", "")).strip()
        rgb = record.get("rgb")
        if block_id and isinstance(rgb, list) and len(rgb) == 3:
            color_map[block_id] = (int(rgb[0]), int(rgb[1]), int(rgb[2]))

    return color_map


def normalize_grid(grid: GridPayload) -> GridPayload:
    """Validate and normalize a 2D block ID grid."""
    if not isinstance(grid, list) or not grid:
        raise ValueError("grid must be a non-empty 2D array")

    width: int | None = None
    normalized: GridPayload = []

    for row_index, row in enumerate(grid):
        if not isinstance(row, list) or not row:
            raise ValueError(f"grid row {row_index} must be a non-empty array")

        if width is None:
            width = len(row)
        elif len(row) != width:
            raise ValueError("grid must be rectangular")

        normalized_row: list[str] = []
        for col_index, cell in enumerate(row):
            block_id = str(cell).strip()
            if not block_id:
                raise ValueError(f"grid cell ({row_index}, {col_index}) must contain a block id")
            normalized_row.append(_ensure_namespace(block_id))

        normalized.append(normalized_row)

    return normalized


def count_blocks(grid: GridPayload) -> dict[str, int]:
    """Count how many times each block appears in the grid."""
    counts: dict[str, int] = {}
    for row in normalize_grid(grid):
        for block_id in row:
            counts[block_id] = counts.get(block_id, 0) + 1
    return counts


def export_block_list_json(grid: GridPayload) -> dict[str, object]:
    """Return a JSON-safe summary of block quantities."""
    counts = count_blocks(grid)
    blocks = [
        {"block_id": block_id, "quantity": quantity}
        for block_id, quantity in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]
    return {
        "total_blocks": sum(counts.values()),
        "unique_block_types": len(counts),
        "blocks": blocks,
    }


def export_block_list_csv(grid: GridPayload) -> str:
    """Return block quantities encoded as CSV text."""
    payload = export_block_list_json(grid)
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["block_id", "quantity"])
    for entry in payload["blocks"]:
        writer.writerow([entry["block_id"], entry["quantity"]])
    return buffer.getvalue()


def render_preview_image(grid: GridPayload, scale: int = DEFAULT_PREVIEW_SCALE) -> bytes:
    """Render a high-resolution PNG preview from a block grid."""
    normalized = normalize_grid(grid)

    if scale < 1 or scale > 128:
        raise ValueError("scale must be between 1 and 128")

    height = len(normalized)
    width = len(normalized[0])
    color_map = load_block_color_map()

    image = Image.new("RGB", (width * scale, height * scale), color=(20, 20, 20))
    draw = ImageDraw.Draw(image)

    border_width = 1 if scale >= 8 else 0

    for y, row in enumerate(normalized):
        for x, block_id in enumerate(row):
            color = color_map.get(block_id, UNKNOWN_BLOCK_COLOR)
            x0 = x * scale
            y0 = y * scale
            x1 = x0 + scale - 1
            y1 = y0 + scale - 1
            draw.rectangle([x0, y0, x1, y1], fill=color)
            if border_width:
                draw.rectangle([x0, y0, x1, y1], outline=(0, 0, 0), width=border_width)

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def export_structure(grid: GridPayload, format: ExportFormat, orientation: Orientation, depth: int) -> bytes:
    """Export the grid into either Sponge schematic or raw NBT bytes."""
    normalized = normalize_grid(grid)

    if depth < 1 or depth > 64:
        raise ValueError("depth must be between 1 and 64")

    if format == "schem":
        return _build_sponge_schematic(normalized, orientation=orientation, depth=depth)

    return _build_structure_nbt(normalized, orientation=orientation, depth=depth)


def _ensure_namespace(block_id: str) -> str:
    return block_id if ":" in block_id else f"minecraft:{block_id}"


def _iter_positions(grid: GridPayload, orientation: Orientation, depth: int):
    height = len(grid)
    width = len(grid[0])

    if orientation == "floor":
        for z in range(height):
            for x in range(width):
                block_id = grid[z][x]
                for y in range(depth):
                    yield x, y, z, block_id
    else:
        for y in range(height):
            grid_row = height - 1 - y
            for x in range(width):
                block_id = grid[grid_row][x]
                for z in range(depth):
                    yield x, y, z, block_id


def _build_sponge_schematic(grid: GridPayload, orientation: Orientation, depth: int) -> bytes:
    width = len(grid[0])
    height = len(grid)

    schem_width = width
    schem_height = depth if orientation == "floor" else height
    schem_length = height if orientation == "floor" else depth

    unique_ids = ["minecraft:air"]
    id_to_index = {"minecraft:air": 0}

    for row in grid:
        for block_id in row:
            if block_id not in id_to_index:
                id_to_index[block_id] = len(unique_ids)
                unique_ids.append(block_id)

    block_data = [id_to_index[block_id] for *_coords, block_id in _iter_positions(grid, orientation, depth)]
    encoded_block_data = _encode_varints(block_data)

    palette_tags = [
        _named_int(block_id, index)
        for block_id, index in id_to_index.items()
    ]

    root = _named_compound(
        "Schematic",
        [
            _named_int("Version", 2),
            _named_int("DataVersion", 3700),
            _named_short("Width", schem_width),
            _named_short("Height", schem_height),
            _named_short("Length", schem_length),
            _named_int("PaletteMax", len(unique_ids)),
            _named_compound("Palette", palette_tags),
            _named_byte_array("BlockData", encoded_block_data),
            _named_compound(
                "Metadata",
                [
                    _named_int("WEOffsetX", 0),
                    _named_int("WEOffsetY", 0),
                    _named_int("WEOffsetZ", 0),
                ],
            ),
        ],
    )

    return gzip.compress(root)


def _build_structure_nbt(grid: GridPayload, orientation: Orientation, depth: int) -> bytes:
    width = len(grid[0])
    height = len(grid)

    size_y = depth if orientation == "floor" else height
    size_z = height if orientation == "floor" else depth

    palette_ids: list[str] = []
    id_to_index: dict[str, int] = {}

    for row in grid:
        for block_id in row:
            if block_id not in id_to_index:
                id_to_index[block_id] = len(palette_ids)
                palette_ids.append(block_id)

    palette_payloads = [
        _compound_payload([_named_string("Name", block_id)])
        for block_id in palette_ids
    ]

    block_payloads = []
    for x, y, z, block_id in _iter_positions(grid, orientation, depth):
        block_payloads.append(
            _compound_payload(
                [
                    _named_list("pos", TAG_INT, [_int_payload(x), _int_payload(y), _int_payload(z)]),
                    _named_int("state", id_to_index[block_id]),
                ]
            )
        )

    root = _named_compound(
        "",
        [
            _named_int("DataVersion", 3700),
            _named_list("size", TAG_INT, [_int_payload(width), _int_payload(size_y), _int_payload(size_z)]),
            _named_list("palette", TAG_COMPOUND, palette_payloads),
            _named_list("blocks", TAG_COMPOUND, block_payloads),
            _named_list("entities", TAG_COMPOUND, []),
        ],
    )

    return root


def _encode_varints(values: list[int]) -> bytes:
    encoded = bytearray()
    for value in values:
        current = int(value)
        while True:
            byte = current & 0x7F
            current >>= 7
            if current:
                encoded.append(byte | 0x80)
            else:
                encoded.append(byte)
                break
    return bytes(encoded)


def _name_bytes(name: str) -> bytes:
    encoded = name.encode("utf-8")
    return struct.pack(">H", len(encoded)) + encoded


def _int_payload(value: int) -> bytes:
    return struct.pack(">i", int(value))


def _compound_payload(tags: list[bytes]) -> bytes:
    return b"".join(tags) + bytes([TAG_END])


def _named_short(name: str, value: int) -> bytes:
    return bytes([TAG_SHORT]) + _name_bytes(name) + struct.pack(">h", int(value))


def _named_int(name: str, value: int) -> bytes:
    return bytes([TAG_INT]) + _name_bytes(name) + _int_payload(value)


def _named_string(name: str, value: str) -> bytes:
    data = value.encode("utf-8")
    return bytes([TAG_STRING]) + _name_bytes(name) + struct.pack(">H", len(data)) + data


def _named_byte_array(name: str, value: bytes) -> bytes:
    return bytes([TAG_BYTE_ARRAY]) + _name_bytes(name) + struct.pack(">i", len(value)) + value


def _named_list(name: str, element_type: int, payloads: list[bytes]) -> bytes:
    return (
        bytes([TAG_LIST])
        + _name_bytes(name)
        + struct.pack(">bi", element_type, len(payloads))
        + b"".join(payloads)
    )


def _named_compound(name: str, tags: list[bytes]) -> bytes:
    return bytes([TAG_COMPOUND]) + _name_bytes(name) + _compound_payload(tags)
