from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from services.ollama_service import refine_prompt

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