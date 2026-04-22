import asyncio
import base64
import binascii
import platform
import functools
from io import BytesIO
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

from services.block_mapper import image_to_block_grid
from services.export_utils import (
    export_block_list_csv,
    export_block_list_json,
    export_structure,
    render_preview_image,
)
from services.history_service import save_generation, get_history, get_entry, delete_entry, clear_history
from services.image_processor import _normalize_palette, preprocess_image
from services.ollama_service import refine_prompt
from services.sd_service import (
    DEFAULT_HEIGHT,
    DEFAULT_WIDTH,
    SDServiceError,
    SDServiceTimeoutError,
    SDServiceUnavailableError,
    generate_image,
)

CONVERT_TO_BLOCKS_TIMEOUT_SECONDS = 60

app = FastAPI(
    title="Minecraft AI Builder API",
    description="Backend API for AI image generation and block mapping",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@functools.lru_cache(maxsize=16)
def get_cached_matcher(palette_key: str) -> "BlockColorMatcher":
    """Return a cached BlockColorMatcher for the given palette name."""
    return BlockColorMatcher(palette=palette_key)


def _get_schematics_dir() -> Path:
    """Return the WorldEdit schematics folder path for the current OS."""
    if platform.system() == "Darwin":  # macOS
        return Path.home() / "Library" / "Application Support" / "minecraft" / "config" / "worldedit" / "schematics"
    elif platform.system() == "Windows":
        return Path.home() / "AppData" / "Roaming" / ".minecraft" / "config" / "worldedit" / "schematics"
    else:  # Linux
        return Path.home() / ".minecraft" / "config" / "worldedit" / "schematics"


class RefinePromptRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=2000)


class RefinePromptResponse(BaseModel):
    original: str
    refined: str
    negative: str


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    negative_prompt: str | None = Field(default=None, max_length=2000)
    width: int | None = Field(default=None, gt=0, le=2048)
    height: int | None = Field(default=None, gt=0, le=2048)


class GenerateImageResponse(BaseModel):
    image: str


class ConvertToBlocksRequest(BaseModel):
    image_base64: str = Field(..., min_length=1)
    width: int = Field(..., gt=0, le=2048)
    height: int = Field(..., gt=0, le=2048)
    palette: str | list[dict[str, Any]] | list[list[int]] = Field(default="full")
    dithering: bool = False
    brightness: int = Field(default=0, ge=-100, le=100)
    contrast: int = Field(default=0, ge=-100, le=100)


class BlockDimensions(BaseModel):
    width: int
    height: int


class ConvertToBlocksResponse(BaseModel):
    dimensions: BlockDimensions
    block_count: int
    palette_summary: dict[str, int]
    grid: list[list[str]] | None = None
    preview_image: str | None = None


class ExportSchematicRequest(BaseModel):
    grid: list[list[str]] = Field(..., min_length=1)
    format: Literal["schem", "nbt"] = "schem"
    orientation: Literal["wall", "floor"] = "floor"
    depth: int = Field(default=1, ge=1, le=64)
    map_art_mode: bool = False


class ExportPreviewImageRequest(BaseModel):
    grid: list[list[str]] = Field(..., min_length=1)
    scale: int = Field(default=24, ge=1, le=128)


class ExportBlockListRequest(BaseModel):
    grid: list[list[str]] = Field(..., min_length=1)
    format: Literal["csv", "json"] = "json"


class SendToMinecraftRequest(BaseModel):
    grid: list[list[str]] = Field(..., min_length=1)
    orientation: Literal["wall", "floor"] = "floor"
    depth: int = Field(default=1, ge=1, le=64)
    map_art_mode: bool = False


class SaveHistoryRequest(BaseModel):
    user_prompt: str
    refined_prompt: str = ""
    image_base64: str = ""
    block_grid: dict | None = None
    settings: dict | None = None


def _decode_base64_image(image_base64: str) -> Image.Image:
    encoded_payload = image_base64.split(",", 1)[-1].strip()
    try:
        image_bytes = base64.b64decode(encoded_payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("image_base64 must contain valid base64-encoded image data") from exc
    try:
        image = Image.open(BytesIO(image_bytes))

        if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
            rgba = image.convert("RGBA")
            background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            image = Image.alpha_composite(background, rgba)

        return image.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("image_base64 must decode to a valid image file") from exc


def _encode_preview_image(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _rgb_luminance(rgb: list[int] | tuple[int, int, int]) -> float:
    red, green, blue = rgb
    return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)


def _is_dark_block_id(block_id: str) -> bool:
    lowered = block_id.lower()
    return any(
        token in lowered
        for token in ("black_wool", "black_concrete", "black_terracotta", "blackstone", "obsidian")
    )


def _build_safe_palette(palette_input: str | list[dict[str, Any]] | list[list[int]]) -> list[dict[str, Any]]:
    normalized = _normalize_palette(palette_input)
    filtered = [
        block
        for block in normalized
        if _rgb_luminance(block["rgb"]) >= 42 and not _is_dark_block_id(block["id"])
    ]

    if len(filtered) < 8:
        filtered = sorted(normalized, key=lambda block: _rgb_luminance(block["rgb"]), reverse=True)[:24]

    return filtered


def _build_block_conversion_result(
    request: ConvertToBlocksRequest,
    output_format: Literal["grid", "preview"],
) -> dict[str, Any]:
    image = _decode_base64_image(request.image_base64)
    brightness_factor = max(0.0, 1.0 + (request.brightness / 100.0))
    contrast_factor = max(0.0, 1.0 + (request.contrast / 100.0))

    processed_image = preprocess_image(
        image,
        target_width=request.width,
        target_height=request.height,
        palette=request.palette,
        dithering=request.dithering,
        brightness=brightness_factor,
        contrast=contrast_factor,
    )
    block_grid = image_to_block_grid(processed_image, request.palette)

    total_blocks = block_grid.width * block_grid.height
    if block_grid.palette_used and total_blocks > 0:
        dominant_block_id, dominant_count = max(
            block_grid.palette_used.items(),
            key=lambda item: item[1],
        )
        dominant_ratio = dominant_count / total_blocks
        is_dark_dominant = _is_dark_block_id(dominant_block_id)

        if is_dark_dominant and dominant_ratio >= 0.95:
            recovered_image = preprocess_image(
                image,
                target_width=request.width,
                target_height=request.height,
                palette=request.palette,
                dithering=request.dithering,
                auto_adjust=True,
                brightness=max(brightness_factor, 1.35),
                contrast=max(contrast_factor, 1.45),
            )
            recovered_grid = image_to_block_grid(recovered_image, request.palette)

            if recovered_grid.palette_used:
                recovered_block_id, recovered_count = max(
                    recovered_grid.palette_used.items(),
                    key=lambda item: item[1],
                )
                recovered_ratio = recovered_count / total_blocks
                recovered_is_dark = _is_dark_block_id(recovered_block_id)

                if (not recovered_is_dark) or (recovered_ratio < dominant_ratio):
                    processed_image = recovered_image
                    block_grid = recovered_grid
                    dominant_ratio = recovered_ratio
                    is_dark_dominant = recovered_is_dark

        if is_dark_dominant and dominant_ratio >= 0.95:
            safe_palette = _build_safe_palette(request.palette)
            safe_image = preprocess_image(
                image,
                target_width=request.width,
                target_height=request.height,
                palette=safe_palette,
                dithering=request.dithering,
                auto_adjust=True,
                brightness=max(brightness_factor, 1.5),
                contrast=max(contrast_factor, 1.6),
            )
            safe_grid = image_to_block_grid(safe_image, safe_palette)

            if safe_grid.palette_used:
                safe_block_id, safe_count = max(
                    safe_grid.palette_used.items(),
                    key=lambda item: item[1],
                )
                safe_ratio = safe_count / total_blocks
                safe_is_dark = _is_dark_block_id(safe_block_id)

                if (not safe_is_dark) or (safe_ratio < dominant_ratio):
                    processed_image = safe_image
                    block_grid = safe_grid

    response: dict[str, Any] = {
        "dimensions": {"width": block_grid.width, "height": block_grid.height},
        "block_count": sum(block_grid.palette_used.values()),
        "palette_summary": block_grid.palette_used,
    }

    if output_format == "preview":
        response["preview_image"] = _encode_preview_image(processed_image)
    else:
        response["grid"] = block_grid.to_block_id_grid()

    return response


async def _convert_to_blocks_response(
    request: ConvertToBlocksRequest,
    output_format: Literal["grid", "preview"],
) -> dict[str, Any]:
    return await asyncio.to_thread(_build_block_conversion_result, request, output_format)


# ── Core endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/refine-prompt", response_model=RefinePromptResponse)
async def refine_prompt_endpoint(request: RefinePromptRequest):
    try:
        positive, negative = refine_prompt(request.description)
        return RefinePromptResponse(
            original=request.description,
            refined=positive,
            negative=negative,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-image", response_model=GenerateImageResponse)
async def generate_image_endpoint(request: GenerateImageRequest):
    width = request.width if request.width is not None else DEFAULT_WIDTH
    height = request.height if request.height is not None else DEFAULT_HEIGHT
    try:
        image_bytes = generate_image(
            request.prompt,
            negative_prompt=request.negative_prompt,
            width=width,
            height=height,
        )
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        return GenerateImageResponse(image=image_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except SDServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except SDServiceTimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except SDServiceError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected image generation error")


@app.post(
    "/convert-to-blocks",
    response_model=ConvertToBlocksResponse,
    response_model_exclude_none=True,
)
async def convert_to_blocks_endpoint(
    request: ConvertToBlocksRequest,
    output_format: Literal["grid", "preview"] = Query(default="grid"),
):
    try:
        result = await asyncio.wait_for(
            _convert_to_blocks_response(request, output_format),
            timeout=CONVERT_TO_BLOCKS_TIMEOUT_SECONDS,
        )
        return ConvertToBlocksResponse(**result)
    except asyncio.TimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail=f"Block conversion timed out after {CONVERT_TO_BLOCKS_TIMEOUT_SECONDS} seconds",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected block conversion error")


# ── Export endpoints ───────────────────────────────────────────────────────────

@app.post("/export/schematic")
async def export_schematic_endpoint(request: ExportSchematicRequest):
    try:
        content = export_structure(
            request.grid,
            format=request.format,
            orientation=request.orientation,
            depth=request.depth,
            map_art_mode=request.map_art_mode,
        )
        extension = request.format
        return Response(
            content=content,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="minecraft-build.{extension}"',
                "Cache-Control": "no-store",
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected schematic export error")


@app.post("/export/preview-image")
async def export_preview_image_endpoint(request: ExportPreviewImageRequest):
    try:
        content = render_preview_image(request.grid, scale=request.scale)
        return Response(
            content=content,
            media_type="image/png",
            headers={
                "Content-Disposition": 'attachment; filename="minecraft-preview.png"',
                "Cache-Control": "no-store",
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected preview export error")


@app.post("/export/block-list")
async def export_block_list_endpoint(request: ExportBlockListRequest):
    try:
        if request.format == "csv":
            content = export_block_list_csv(request.grid)
            return Response(
                content=content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": 'attachment; filename="minecraft-blocks.csv"',
                    "Cache-Control": "no-store",
                },
            )
        return JSONResponse(export_block_list_json(request.grid), headers={"Cache-Control": "no-store"})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected block list export error")


@app.post("/export/send-to-minecraft")
async def send_to_minecraft_endpoint(request: SendToMinecraftRequest):
    """
    Generates a .schem file and copies it directly to the local
    WorldEdit schematics folder. User can then load it in-game with:
      //schem load minecraft-build
      //paste
    """
    schematics_dir = _get_schematics_dir()

    if not schematics_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                f"WorldEdit schematics folder not found at {schematics_dir}. "
                "Make sure WorldEdit is installed and you have launched Minecraft at least once."
            )
        )

    try:
        content = export_structure(
            request.grid,
            format="schem",
            orientation=request.orientation,
            depth=request.depth,
            map_art_mode=request.map_art_mode,
        )

        dest = schematics_dir / "minecraft-build.schem"
        dest.write_bytes(content)

        return {
            "success": True,
            "filename": "minecraft-build",
            "path": str(dest),
            "message": "File copied to WorldEdit schematics folder.",
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write schematic: {str(exc)}"
        ) from exc


# ── History endpoints ──────────────────────────────────────────────────────────

@app.post("/history")
async def save_history_endpoint(request: SaveHistoryRequest):
    try:
        entry_id = save_generation(
            user_prompt=request.user_prompt,
            refined_prompt=request.refined_prompt,
            image_base64=request.image_base64,
            block_grid=request.block_grid,
            settings=request.settings,
        )
        return {"id": entry_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history")
async def get_history_endpoint(page: int = Query(default=1, ge=1), per_page: int = Query(default=20, ge=1, le=50)):
    try:
        entries = get_history(page=page, per_page=per_page)
        return {"entries": entries, "page": page, "per_page": per_page}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history/{entry_id}")
async def get_history_entry_endpoint(entry_id: str):
    entry = get_entry(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@app.delete("/history/{entry_id}")
async def delete_history_entry_endpoint(entry_id: str):
    deleted = delete_entry(entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"deleted": True}


@app.delete("/history")
async def clear_history_endpoint():
    count = clear_history()
    return {"deleted_count": count}