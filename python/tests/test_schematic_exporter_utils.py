import pytest
from services import schematic_exporter


def test_ensure_namespace():
    assert schematic_exporter._ensure_namespace("stone") == "minecraft:stone"
    assert schematic_exporter._ensure_namespace("minecraft:stone") == "minecraft:stone"


def test_encode_varints_basic():
    # 0, 1, 127, 128, 255, 300
    vals = [0, 1, 127, 128, 255, 300]
    encoded = schematic_exporter._encode_varints(vals)
    # Decoding: check that the encoding is reversible
    def decode_varints(data):
        out = []
        val = 0
        shift = 0
        for b in data:
            val |= (b & 0x7F) << shift
            if not (b & 0x80):
                out.append(val)
                val = 0
                shift = 0
            else:
                shift += 7
        return out
    assert decode_varints(encoded) == vals
