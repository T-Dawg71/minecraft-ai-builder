"""
Stable Diffusion image generation service.
"""

import os
import base64
import asyncio
from io import BytesIO
from typing import Final, Optional
import aiohttp
from PIL import Image


SD_API_HOST: Final[str] = os.getenv("SD_API_HOST", "http://localhost:7860")
SD_TXT2IMG_PATH: Final[str] = "/sdapi/v1/txt2img"
SD_TXT2IMG_URL: Final[str] = f"{SD_API_HOST}{SD_TXT2IMG_PATH}"

DEFAULT_STEPS: Final[int] = 25
DEFAULT_SAMPLER_NAME: Final[str] = "DPM++ 2M Karras"
DEFAULT_CFG_SCALE: Final[float] = 9
SAFE_STEPS: Final[int] = 18
SAFE_SAMPLER_NAME: Final[str] = "Euler a"
SAFE_CFG_SCALE: Final[float] = 7
DEFAULT_WIDTH: Final[int] = 512
DEFAULT_HEIGHT: Final[int] = 512
REQUEST_TIMEOUT_SECONDS: Final[int] = 600

DEFAULT_NEGATIVE_PROMPT: Final[str] = (
    "shadows, gradients, shading, glow, bloom, fog, mist, photorealistic, "
    "texture detail, fur, fabric weave, wood grain, bokeh, depth of field, "
    "motion blur, soft lighting, atmospheric haze, subsurface scattering, "
    "noise, film grain"
)

SAFE_NEGATIVE_PROMPT: Final[str] = (
    "photo, realistic, photorealistic, dark background, shadows, blur"
)


class SDServiceError(RuntimeError):
    pass

class SDServiceUnavailableError(SDServiceError):
    pass

class SDServiceTimeoutError(SDServiceError):
    pass


def _is_simple_subject_prompt(prompt: str) -> bool:
    normalized = prompt.strip().lower()
    token_count = len([t for t in normalized.replace(",", " ").split() if t])
    comma_count = normalized.count(",")
    return token_count <= 10 and comma_count <= 4


async def generate_image(
    prompt: str,
    negative_prompt: Optional[str] = None,
    width: int = DEFAULT_WIDTH,
    height: int = DEFAULT_HEIGHT,
) -> bytes:
    if not prompt or not prompt.strip():
        raise ValueError("Prompt cannot be empty")
    if width <= 0 or height <= 0:
        raise ValueError("Width and height must be positive")

    use_safe_profile = _is_simple_subject_prompt(prompt)

    if use_safe_profile:
        resolved_negative = SAFE_NEGATIVE_PROMPT
        steps = SAFE_STEPS
        sampler_name = SAFE_SAMPLER_NAME
        cfg_scale = SAFE_CFG_SCALE
    else:
        resolved_negative = (negative_prompt or "").strip() or DEFAULT_NEGATIVE_PROMPT
        steps = DEFAULT_STEPS
        sampler_name = DEFAULT_SAMPLER_NAME
        cfg_scale = DEFAULT_CFG_SCALE

    payload = {
        "prompt": prompt.strip(),
        "negative_prompt": resolved_negative,
        "steps": steps,
        "sampler_name": sampler_name,
        "cfg_scale": cfg_scale,
        "width": width,
        "height": height,
    }

    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT_SECONDS)

    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(SD_TXT2IMG_URL, json=payload) as response:
                response.raise_for_status()
                data = await response.json()

    except asyncio.TimeoutError as exc:
        raise SDServiceTimeoutError(
            f"Stable Diffusion generation timed out after {REQUEST_TIMEOUT_SECONDS} seconds"
        ) from exc
    except aiohttp.ClientConnectionError as exc:
        raise SDServiceUnavailableError(
            f"Cannot connect to Stable Diffusion API at {SD_API_HOST}. Is it running?"
        ) from exc
    except aiohttp.ClientResponseError as exc:
        if exc.status in (502, 503, 504):
            raise SDServiceUnavailableError(
                f"Stable Diffusion API is temporarily unavailable (HTTP {exc.status})"
            ) from exc
        raise

    if "images" in data:
        images = data.get("images")
        if isinstance(images, list) and images:
            first_image_b64 = images[0]
        else:
            raise SDServiceError("Stable Diffusion response did not include image data")
    elif "image" in data:
        first_image_b64 = data.get("image")
    else:
        raise SDServiceError("Stable Diffusion response did not include image data")

    if not isinstance(first_image_b64, str) or not first_image_b64:
        raise SDServiceError("Stable Diffusion returned an invalid image payload")

    image_data = base64.b64decode(first_image_b64)
    pil_image = Image.open(BytesIO(image_data))
    output_buffer = BytesIO()
    pil_image.save(output_buffer, format="PNG")
    return output_buffer.getvalue()