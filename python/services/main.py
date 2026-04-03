import asyncio
import base64
import binascii
from io import BytesIO
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

from services.block_mapper import image_to_block_grid
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
    description: str = Field(..., min_length=1, max_length=500)


class RefinePromptResponse(BaseModel):
    original: str
    refined: str


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=500)
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


def _decode_base64_image(image_base64: str) -> Image.Image:
    """Decode a base64 or data-URL encoded image into a Pillow image."""
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
    """Encode a Pillow image as base64 PNG for preview responses."""
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _build_block_conversion_result(
    request: ConvertToBlocksRequest,
    output_format: Literal["grid", "preview"],
) -> dict[str, Any]:
    """Run the decode -> preprocess -> map pipeline and shape the API response."""
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
    """Offload CPU-bound block conversion work from the event loop."""
    return await asyncio.to_thread(_build_block_conversion_result, request, output_format)


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