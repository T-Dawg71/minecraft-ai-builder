"""
Validation script for block_colors.json
Checks for duplicates, missing fields, and data integrity.
"""

import json
import os
import sys


def validate():
    path = os.path.join(os.path.dirname(__file__), "..", "data", "block_colors.json")

    with open(path, "r") as f:
        blocks = json.load(f)

    errors = []
    warnings = []
    ids_seen = set()
    names_seen = set()

    for i, block in enumerate(blocks):
        # Check required fields
        for field in ["id", "name", "rgb", "category"]:
            if field not in block:
                errors.append(f"Block {i}: missing field '{field}'")

        # Check ID format
        bid = block.get("id", "")
        if not bid.startswith("minecraft:"):
            errors.append(f"Block {i} ({bid}): ID must start with 'minecraft:'")

        # Check for duplicate IDs
        if bid in ids_seen:
            errors.append(f"Block {i}: duplicate ID '{bid}'")
        ids_seen.add(bid)

        # Check for duplicate names
        name = block.get("name", "")
        if name in names_seen:
            warnings.append(f"Block {i}: duplicate name '{name}'")
        names_seen.add(name)

        # Check RGB values
        rgb = block.get("rgb", [])
        if len(rgb) != 3:
            errors.append(f"Block {i} ({bid}): RGB must have 3 values, got {len(rgb)}")
        else:
            for j, val in enumerate(rgb):
                if not isinstance(val, int) or val < 0 or val > 255:
                    errors.append(f"Block {i} ({bid}): RGB[{j}] = {val} is not valid (must be 0-255)")

        # Check category is not empty
        if not block.get("category", "").strip():
            errors.append(f"Block {i} ({bid}): empty category")

    # Summary
    categories = {}
    for block in blocks:
        cat = block.get("category", "unknown")
        categories[cat] = categories.get(cat, 0) + 1

    print(f"=== Block Colors Validation ===")
    print(f"Total blocks: {len(blocks)}")
    print(f"Unique IDs: {len(ids_seen)}")
    print()
    print("Blocks per category:")
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count}")
    print()

    if errors:
        print(f"ERRORS ({len(errors)}):")
        for e in errors:
            print(f"  ❌ {e}")
    else:
        print("✅ No errors found!")

    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"  ⚠️  {w}")

    print()
    if len(blocks) >= 150:
        print(f"✅ Block count ({len(blocks)}) meets minimum target of 150")
    else:
        print(f"⚠️  Block count ({len(blocks)}) is below minimum target of 150")

    return len(errors) == 0


if __name__ == "__main__":
    success = validate()
    sys.exit(0 if success else 1)