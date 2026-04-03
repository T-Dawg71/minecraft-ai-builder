"""Image preprocessing pipeline for Minecraft block-art generation."""

from __future__ import annotations

from typing import Sequence

import numpy as np
from PIL import Image, ImageEnhance, ImageOps

from services.color_matcher import BlockColorMatcher

PaletteInput = str | Sequence[dict] | Sequence[Sequence[int]]


def _ensure_rgb_image(image: Image.Image) -> Image.Image:
    """Validate a Pillow image input and normalize it to RGB mode."""
    if not isinstance(image, Image.Image):
        raise TypeError("image must be a PIL.Image.Image instance")
    return image.convert("RGB")


def _validate_dimension(value: int, name: str) -> None:
    """Ensure resize dimensions are positive integers."""
    if not isinstance(value, int) or value <= 0:
        raise ValueError(f"{name} must be a positive integer")


def _normalize_palette(palette: PaletteInput) -> list[dict]:
    """Convert palette input into the block-list format expected by BlockColorMatcher."""
    if isinstance(palette, str):
        return BlockColorMatcher(palette=palette).blocks

    palette_items = list(palette)
    if not palette_items:
        raise ValueError("Palette cannot be empty")

    normalized: list[dict] = []
    for index, item in enumerate(palette_items):
        if isinstance(item, dict):
            if "rgb" not in item:
                raise ValueError("Palette block dictionaries must include an 'rgb' field")
            rgb = tuple(int(channel) for channel in item["rgb"])
            normalized.append(
                {
                    "id": item.get("id", f"color_{index}"),
                    "name": item.get("name", f"Color {index}"),
                    "rgb": list(rgb),
                    "category": item.get("category", "custom"),
                }
            )
        else:
            rgb = tuple(int(channel) for channel in item)
            if len(rgb) != 3:
                raise ValueError("Palette colors must be RGB triplets")
            normalized.append(
                {
                    "id": f"color_{index}",
                    "name": f"Color {index}",
                    "rgb": list(rgb),
                    "category": "custom",
                }
            )

    return normalized


def resize_image(image: Image.Image, target_width: int, target_height: int) -> Image.Image:
    """Resize an image to the target dimensions using Pillow LANCZOS resampling."""
    normalized = _ensure_rgb_image(image)
    _validate_dimension(target_width, "target_width")
    _validate_dimension(target_height, "target_height")

    return normalized.resize(
        (target_width, target_height),
        resample=Image.Resampling.LANCZOS,
    )


def adjust_brightness_contrast(
    image: Image.Image,
    brightness: float = 1.0,
    contrast: float = 1.0,
    auto_adjust: bool = False,
) -> Image.Image:
    """
    Adjust image brightness and contrast.

    Args:
        image: Input Pillow image.
        brightness: Manual brightness multiplier. `1.0` leaves brightness unchanged.
        contrast: Manual contrast multiplier. `1.0` leaves contrast unchanged.
        auto_adjust: When enabled, apply Pillow autocontrast before manual overrides.
    """
    normalized = _ensure_rgb_image(image)

    if brightness < 0:
        raise ValueError("brightness must be non-negative")
    if contrast < 0:
        raise ValueError("contrast must be non-negative")

    if auto_adjust:
        normalized = ImageOps.autocontrast(normalized)

    if brightness != 1.0:
        normalized = ImageEnhance.Brightness(normalized).enhance(brightness)

    if contrast != 1.0:
        normalized = ImageEnhance.Contrast(normalized).enhance(contrast)

    return normalized


def _quantize_without_dithering(image: Image.Image, matcher: BlockColorMatcher) -> Image.Image:
    """Quantize using batch nearest-color lookups for performance."""
    pixels = np.array(image, dtype=np.uint8)
    flat_pixels = pixels.reshape(-1, 3)

    matches = matcher.find_closest_blocks_batch(flat_pixels)
    remapped = np.array([match["rgb"] for match in matches], dtype=np.uint8)
    quantized = remapped.reshape(pixels.shape)

    return Image.fromarray(quantized, mode="RGB")


def _quantize_with_floyd_steinberg(image: Image.Image, matcher: BlockColorMatcher) -> Image.Image:
    """Apply Floyd-Steinberg dithering while remapping to the nearest palette color."""
    working = np.array(image, dtype=np.float32)
    height, width, _ = working.shape

    for y in range(height):
        for x in range(width):
            old_pixel = np.clip(working[y, x], 0, 255)
            closest = matcher.find_closest_block(tuple(int(channel) for channel in old_pixel))
            new_pixel = np.array(closest["rgb"], dtype=np.float32)
            error = old_pixel - new_pixel
            working[y, x] = new_pixel

            if x + 1 < width:
                working[y, x + 1] += error * (7 / 16)
            if y + 1 < height:
                if x > 0:
                    working[y + 1, x - 1] += error * (3 / 16)
                working[y + 1, x] += error * (5 / 16)
                if x + 1 < width:
                    working[y + 1, x + 1] += error * (1 / 16)

    return Image.fromarray(np.clip(working, 0, 255).astype(np.uint8), mode="RGB")


def quantize_colors(
    image: Image.Image,
    palette: PaletteInput,
    dithering: bool = False,
) -> Image.Image:
    """
    Reduce image colors to the provided Minecraft palette.

    Args:
        image: Input Pillow image.
        palette: Palette preset name, list of block dicts, or list of RGB triplets.
        dithering: Enable Floyd-Steinberg dithering for smoother gradients.
    """
    normalized = _ensure_rgb_image(image)
    block_list = _normalize_palette(palette)
    matcher = BlockColorMatcher(block_list=block_list)

    if dithering:
        return _quantize_with_floyd_steinberg(normalized, matcher)
    return _quantize_without_dithering(normalized, matcher)


def preprocess_image(
    image: Image.Image,
    target_width: int,
    target_height: int,
    palette: PaletteInput,
    *,
    dithering: bool = False,
    auto_adjust: bool = False,
    brightness: float = 1.0,
    contrast: float = 1.0,
) -> Image.Image:
    """Run the full preprocessing pipeline: adjust -> resize -> quantize."""
    adjusted = adjust_brightness_contrast(
        image,
        brightness=brightness,
        contrast=contrast,
        auto_adjust=auto_adjust,
    )
    resized = resize_image(adjusted, target_width, target_height)
    return quantize_colors(resized, palette, dithering=dithering)
