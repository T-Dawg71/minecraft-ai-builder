import asyncio
import base64
import binascii
from io import BytesIO
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
from services.image_processor import preprocess_image
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


class RefinePromptRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=2000)


class RefinePromptResponse(BaseModel):
    original: str
    refined: str


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
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


class ExportPreviewImageRequest(BaseModel):
    grid: list[list[str]] = Field(..., min_length=1)
    scale: int = Field(default=24, ge=1, le=128)


class ExportBlockListRequest(BaseModel):
    grid: list[list[str]] = Field(..., min_length=1)
    format: Literal["csv", "json"] = "json"


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
        return Image.open(BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("image_base64 must decode to a valid image file") from exc


def _encode_preview_image(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _build_block_conversion_result(
    request: ConvertToBlocksRequest,
    output_format: Literal["grid", "preview"],
) -> dict[str, Any]:
    image = _decode_base64_image(request.image_base64)
    processed_image = preprocess_image(
        image,
        target_width=request.width,
        target_height=request.height,
        palette=request.palette,
        dithering=request.dithering,
    )
    block_grid = image_to_block_grid(processed_image, request.palette)

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
        refined = refine_prompt(request.description)
        return RefinePromptResponse(original=request.description, refined=refined)
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
        image_bytes = generate_image(request.prompt, width=width, height=height)
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