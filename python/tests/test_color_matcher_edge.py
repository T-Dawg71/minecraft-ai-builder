import os
import json
import pytest
from services import color_matcher


def test_filter_by_palette_file_not_found(monkeypatch):
    matcher = color_matcher.BlockColorMatcher
    monkeypatch.setattr(os.path, "exists", lambda path: False)
    with pytest.raises(FileNotFoundError):
        matcher()._filter_by_palette("full")


def test_filter_by_palette_unknown_palette(tmp_path, monkeypatch):
    # Create a fake palettes.json with only 'foo' in the expected data directory
    # Create ../data/palettes.json relative to fake_module_path
    module_dir = tmp_path / "moddir"
    module_dir.mkdir()
    fake_module_path = module_dir / "color_matcher.py"
    fake_module_path.write_text("")
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    palettes_path = data_dir / "palettes.json"
    with open(palettes_path, "w") as f:
        json.dump({"foo": {}}, f)
    monkeypatch.setattr(color_matcher, "__file__", str(fake_module_path))
    matcher = color_matcher.BlockColorMatcher
    with pytest.raises(ValueError):
        matcher()._filter_by_palette("bar")


def test_get_palette_info_categories():
    matcher = color_matcher.BlockColorMatcher(block_list=[{"id": "a", "rgb": [1,2,3], "category": "cat1"}, {"id": "b", "rgb": [4,5,6], "category": "cat1"}, {"id": "c", "rgb": [7,8,9], "category": "cat2"}])
    info = matcher.get_palette_info()
    assert info["categories"] == {"cat1": 2, "cat2": 1}
