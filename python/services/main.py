from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from services.ollama_service import refine_prompt
from services.sd_service import (
    DEFAULT_HEIGHT,
    DEFAULT_WIDTH,
    SDServiceError,
    SDServiceTimeoutError,
    SDServiceUnavailableError,
    generate_image,
)
import base64

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