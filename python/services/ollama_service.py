"""
Ollama Prompt Engineering Service
Refines user descriptions into Stable Diffusion-optimized prompts
using Llama 3 via the Ollama API.
"""

import aiohttp
import asyncio
import os

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
MAX_RETRIES = 3
TIMEOUT_SECONDS = 90

SYSTEM_PROMPT = """You are a prompt engineer specializing in images that convert cleanly to Minecraft block art.

Rewrite the user's description into a Stable Diffusion prompt optimized for block conversion.

OUTPUT FORMAT — respond with exactly two lines, nothing else:
Prompt: <comma-separated keywords>
Negative: <comma-separated keywords>

PROMPT RULES:
- Always output exactly 15-20 keywords, no more, no less
- FIRST keyword: the subject exactly as described by the user (e.g. "castle on a hill", "red apple", "green heart")
- SECOND keyword: always "flat vector illustration"
- THIRD keyword: always "bold black outline"
- Then add 5-8 keywords describing composition and style:
  centered composition, solid fill colors, white background, single subject,
  high contrast, clean edges, 2D clipart style, simple shapes
- Only add color keywords if the user explicitly mentioned a color
- If user mentioned a color, use the closest Minecraft-safe term:
  lime green, dark green, red, crimson, orange, yellow, white, light gray,
  dark gray, black, brown, tan, light blue, cyan, navy blue, purple, magenta, pink
- NEVER invent colors the user didn't mention

NEGATIVE RULES:
- Always output exactly these keywords, nothing more nothing less:
  photograph, photo, realistic, 3D render, CGI, studio shot, real object,
  neon colors, oversaturated, shadows, gradients, shading, glow, photorealistic,
  texture detail, bokeh, motion blur, noise, film grain, dark background"""


def parse_refined_prompt(response: str) -> tuple[str, str]:
    positive = ""
    negative = "photograph, photo, realistic, shadows, gradients, shading, glow, photorealistic, texture detail, blur, noise"

    for line in response.strip().splitlines():
        line = line.strip()
        if line.lower().startswith("prompt:"):
            positive = line[len("prompt:"):].strip()
        elif line.lower().startswith("negative:"):
            negative = line[len("negative:"):].strip()

    if not positive:
        positive = response.strip()

    return positive, negative


async def refine_prompt(user_input: str) -> tuple[str, str]:
    if not user_input or not user_input.strip():
        raise ValueError("User input cannot be empty")

    url = f"{OLLAMA_HOST}/api/generate"
    payload = {
        "model": OLLAMA_MODEL,
        "system": SYSTEM_PROMPT,
        "prompt": f"Convert this description into a Minecraft block art prompt. Subject and color first, then 'flat vector illustration': {user_input.strip()}",
        "stream": False,
    }

    timeout = aiohttp.ClientTimeout(total=TIMEOUT_SECONDS)
    last_error = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, json=payload) as response:
                    response.raise_for_status()
                    data = await response.json()
                    raw = data.get("response", "").strip()

                    if not raw:
                        raise RuntimeError("Ollama returned an empty response")

                    return parse_refined_prompt(raw)

        except asyncio.TimeoutError:
            last_error = TimeoutError(
                f"Ollama request timed out after {TIMEOUT_SECONDS}s (attempt {attempt}/{MAX_RETRIES})"
            )
        except aiohttp.ClientConnectionError:
            last_error = ConnectionError(
                f"Cannot connect to Ollama at {OLLAMA_HOST}. Is it running? (attempt {attempt}/{MAX_RETRIES})"
            )
        except aiohttp.ClientResponseError as e:
            last_error = RuntimeError(
                f"Ollama API error: {e.status} (attempt {attempt}/{MAX_RETRIES})"
            )
        except Exception as e:
            last_error = RuntimeError(
                f"Unexpected error: {str(e)} (attempt {attempt}/{MAX_RETRIES})"
            )

        if attempt < MAX_RETRIES:
            await asyncio.sleep(2 ** (attempt - 1))

    raise last_error