"""
Ollama Prompt Engineering Service
Refines user descriptions into Stable Diffusion-optimized prompts
using Llama 3 via the Ollama API.
"""

import requests
import time
import os

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
MAX_RETRIES = 3
TIMEOUT_SECONDS = 90

SYSTEM_PROMPT = """You are a prompt engineer for Stable Diffusion image generation.
The generated image will be converted to Minecraft blocks, so follow these rules:
- Emphasize bold, saturated colors and clear geometric shapes
- Avoid fine details, thin lines, or subtle gradients that won't translate to blocks
- Suggest blocky, voxel-friendly compositions with strong contrast
- Add keywords for pixel-art or low-poly aesthetic when appropriate
- Include lighting and mood keywords (e.g., "bright sunlight", "dramatic shadows")
- Keep the enhanced prompt under 200 words
- Respond with ONLY the enhanced prompt text, nothing else — no explanations, no labels"""


def refine_prompt(user_input: str) -> str:
    """
    Takes a raw user description and returns a Stable Diffusion-optimized prompt.
    
    Args:
        user_input: Raw description from the user (e.g., "a castle on a hill")
    
    Returns:
        Enhanced prompt optimized for SD image generation with Minecraft conversion in mind.
    
    Raises:
        TimeoutError: If Ollama doesn't respond within TIMEOUT_SECONDS
        ConnectionError: If Ollama API is unreachable
        RuntimeError: If all retries are exhausted
    """
    if not user_input or not user_input.strip():
        raise ValueError("User input cannot be empty")

    url = f"{OLLAMA_HOST}/api/generate"
    payload = {
        "model": OLLAMA_MODEL,
        "system": SYSTEM_PROMPT,
        "prompt": f"Enhance this user description for Stable Diffusion: {user_input.strip()}",
        "stream": False,
    }

    last_error = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.post(url, json=payload, timeout=TIMEOUT_SECONDS)
            response.raise_for_status()

            data = response.json()
            refined = data.get("response", "").strip()

            if not refined:
                raise RuntimeError("Ollama returned an empty response")

            return refined

        except requests.exceptions.Timeout:
            last_error = TimeoutError(
                f"Ollama request timed out after {TIMEOUT_SECONDS}s (attempt {attempt}/{MAX_RETRIES})"
            )
        except requests.exceptions.ConnectionError:
            last_error = ConnectionError(
                f"Cannot connect to Ollama at {OLLAMA_HOST}. Is it running? (attempt {attempt}/{MAX_RETRIES})"
            )
        except requests.exceptions.HTTPError as e:
            last_error = RuntimeError(
                f"Ollama API error: {e.response.status_code} (attempt {attempt}/{MAX_RETRIES})"
            )
        except Exception as e:
            last_error = RuntimeError(
                f"Unexpected error: {str(e)} (attempt {attempt}/{MAX_RETRIES})"
            )

        # Exponential backoff: 1s, 2s, 4s
        if attempt < MAX_RETRIES:
            wait_time = 2 ** (attempt - 1)
            time.sleep(wait_time)

    raise last_error


# Quick test when running directly
if __name__ == "__main__":
    test_input = "a castle on a hill at sunset"
    print(f"Original: {test_input}")
    print(f"Refining...")
    try:
        result = refine_prompt(test_input)
        print(f"Refined: {result}")
    except Exception as e:
        print(f"Error: {e}")