# Minecraft AI Image-to-Blocks Generator

An AI-powered tool that converts text descriptions into Minecraft block patterns.

## Tech Stack
- **Frontend:** Next.js (React, TypeScript, Tailwind CSS)
- **NLP Processing:** Ollama + Llama 3
- **Image Generation:** Stable Diffusion (local)
- **Block Mapping:** Python (FastAPI)
- **Minecraft Export:** WorldEdit (.schem) / Structure Blocks (.nbt)

## Getting Started

### Prerequisites
- Node.js 22+
- Python 3.10+
- Ollama
- Stable Diffusion WebUI (AUTOMATIC1111)

### Frontend Setup
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)
```

Save that, then let's commit everything:
```
git add .
git commit -m "MC-1: Add folder structure, ESLint/Prettier config, update README"

## Docker Setup

To run all services with Docker:
```bash
docker-compose up --build
```

This starts:
- **Frontend** at http://localhost:3000
- **Backend API** at http://localhost:8000
- **Ollama** at http://localhost:11434
- **Stable Diffusion** at http://localhost:7860

To stop all services:
```bash
docker-compose down
```
```

Save everything, then commit:
```
git add .
git commit -m "MC-3: Add Docker Compose setup with frontend, backend, Ollama, SD services"

## System Requirements

### Ollama (Llama 3)
- **RAM:** 8 GB minimum, 16 GB recommended
- **Disk:** ~5 GB for Llama 3 model
- **Install:** `brew install ollama` or download from https://ollama.com
- **Pull model:** `ollama pull llama3`
- **Verify:** `curl http://localhost:11434/api/generate -d '{"model":"llama3","prompt":"hello","stream":false}'`
- **Note:** MLX warnings on Mac are non-fatal and can be ignored

## Stable Diffusion Local Setup (Completed)

This project now has a working local Stable Diffusion API at `http://localhost:7860/sdapi/v1/txt2img`.

### What Was Set Up
- Cloned `AUTOMATIC1111/stable-diffusion-webui`
- Installed Python 3.10 and WebUI dependencies in a dedicated venv
- Downloaded SD 1.5 model artifacts
- Verified API health and successful `txt2img` generation with curl

### Start Stable Diffusion API

Use this working command:

```bash
/Users/kevinorange/stable-diffusion-webui/venv/bin/python /Users/kevinorange/stable-diffusion-webui/minimal_api.py
```

Health check:

```bash
curl http://localhost:7860/sdapi/v1/info
```

Expected response contains: `"status":"running"`

### Test txt2img (curl/Postman)

```bash
curl -X POST http://localhost:7860/sdapi/v1/txt2img \
	-H 'Content-Type: application/json' \
	-d '{
		"prompt":"minecraft redstone tower",
		"steps":1,
		"width":64,
		"height":64,
		"scale":7
	}'
```

Expected response includes:
- `"status":"success"`
- `"image":"<base64 PNG...>"`

### Troubleshooting

- If you see `No module named 'diffusers'`:
	install missing runtime packages in the SD venv:
	```bash
	/Users/kevinorange/stable-diffusion-webui/venv/bin/pip install diffusers transformers sentencepiece accelerate safetensors
	```

- If you see `cannot import name 'SiglipImageProcessor'`:
	align package versions:
	```bash
	/Users/kevinorange/stable-diffusion-webui/venv/bin/pip install --upgrade "transformers==4.41.2" "diffusers==0.30.3"
	```

- If port 7860 is already in use:
	```bash
	pkill -f "/Users/kevinorange/stable-diffusion-webui/minimal_api.py"
	```

- If running from a different directory fails:
	always use absolute paths (as shown above) to avoid cwd-related script errors.

### Note On `webui.sh --api --listen`

The upstream A1111 launcher path currently has repository compatibility issues in this environment. The `minimal_api.py` path above is verified working and satisfies local API generation requirements for this project.

## Run Backend Tests

From the backend folder:

```bash
cd /Users/kevinorange/minecraft-ai-builder/python
```

Install test dependencies (if needed):

```bash
python3 -m pip install -r requirements.txt pytest
```

Run only Stable Diffusion service tests:

```bash
python3 -m pytest -q tests/test_sd_service.py
```

Run all backend tests:

```bash
python3 -m pytest -q tests
```

Quick runtime smoke check for SD service:

```bash
python3 -c "from services.sd_service import generate_image; data=generate_image('minecraft tower',64,64); print(type(data).__name__, len(data), data[:8])"
```

Expected smoke check output:
- `bytes`
- non-zero length
- PNG header: `b'\\x89PNG\\r\\n\\x1a\\n'`

## Backend API Verification (DEV-84 to DEV-88)

These are the exact commands used to verify the new `/generate-image` route behavior.

### 1) Run backend tests

```bash
cd /Users/kevinorange/minecraft-ai-builder/python
/Users/kevinorange/stable-diffusion-webui/venv/bin/python -m pytest -q
```

Expected: all tests pass.

### 2) Start dependencies

Stable Diffusion API (required for successful image generation):

```bash
/Users/kevinorange/stable-diffusion-webui/venv/bin/python /Users/kevinorange/stable-diffusion-webui/minimal_api.py
```

Ollama (optional, only needed for `/refine-prompt`):

```bash
ollama serve
```

### 3) Start backend API

Use the known working interpreter and explicit app dir:

```bash
cd /Users/kevinorange/minecraft-ai-builder/python
/Users/kevinorange/stable-diffusion-webui/venv/bin/python -m uvicorn services.main:app --app-dir /Users/kevinorange/minecraft-ai-builder/python --host 127.0.0.1 --port 8000
```

### 4) Verify health endpoint

```bash
curl -sS -o /tmp/health.json -w '%{http_code}\n' http://127.0.0.1:8000/health && echo '---' && cat /tmp/health.json
```

Expected:
- HTTP `200`
- `{"status":"ok"}`

### 5) Verify image generation success

```bash
curl -sS -o /tmp/gen_ok.json -w '%{http_code}\n' \
	-X POST http://127.0.0.1:8000/generate-image \
	-H 'Content-Type: application/json' \
	-d '{"prompt":"minecraft house","width":64,"height":64}' && \
echo '---' && \
python3 - <<'PY'
import json
with open('/tmp/gen_ok.json') as f:
		d = json.load(f)
print('has_image=', 'image' in d, 'len=', len(d.get('image', '')))
PY
```

Expected:
- HTTP `200`
- `has_image=True`
- non-zero base64 length

### 6) Verify request validation errors (Pydantic)

Invalid width:

```bash
curl -sS -o /tmp/gen_bad_width.json -w '%{http_code}\n' \
	-X POST http://127.0.0.1:8000/generate-image \
	-H 'Content-Type: application/json' \
	-d '{"prompt":"minecraft house","width":0,"height":64}' && \
echo '---' && cat /tmp/gen_bad_width.json
```

Missing prompt:

```bash
curl -sS -o /tmp/gen_missing_prompt.json -w '%{http_code}\n' \
	-X POST http://127.0.0.1:8000/generate-image \
	-H 'Content-Type: application/json' \
	-d '{"width":64,"height":64}' && \
echo '---' && cat /tmp/gen_missing_prompt.json
```

Expected both calls: HTTP `422`.

### 7) Verify mapped `503` error path for SD unavailable

Start backend with an intentionally unreachable SD host:

```bash
cd /Users/kevinorange/minecraft-ai-builder/python
SD_API_HOST=http://127.0.0.1:7999 /Users/kevinorange/stable-diffusion-webui/venv/bin/python -m uvicorn services.main:app --app-dir /Users/kevinorange/minecraft-ai-builder/python --host 127.0.0.1 --port 8000
```

Then call:

```bash
curl -sS -o /tmp/gen_sd_down.json -w '%{http_code}\n' \
	-X POST http://127.0.0.1:8000/generate-image \
	-H 'Content-Type: application/json' \
	-d '{"prompt":"minecraft house","width":64,"height":64}' && \
echo '---' && cat /tmp/gen_sd_down.json
```

Expected:
- HTTP `503`
- error detail indicating Stable Diffusion API is unreachable

## Running Tests

### All Backend Tests
```bash
cd python
source venv/bin/activate
python -m pytest tests/ -v
```

### Individual Test Files
```bash
# Ollama prompt engineering tests
python -m pytest tests/test_ollama_service.py -v

# Color matching algorithm tests
python -m pytest tests/test_color_matcher.py -v
```

### Manual Service Tests

**Test prompt refinement (requires Ollama running):**
```bash
cd python
python -m services.ollama_service
```

**Test color matching and benchmark:**
```bash
cd python
python -m services.color_matcher
```

**Validate block color database:**
```bash
cd python
python -m utils.validate_blocks
```
Before starting, make sure you have:

- **Node.js 22+** — check with `node -v`
- **Python 3.10** — needed for Stable Diffusion (`python3.10 --version`)
- **Python 3.10+** — for the backend (`python3 --version`)
- **Ollama** — install with `brew install ollama`
- **Git** — check with `git --version`
- **Homebrew** (Mac) — for installing dependencies

## First Time Setup

### 1. Clone the repo
```bash
git clone https://github.com/T-Dawg71/minecraft-ai-builder.git
cd minecraft-ai-builder
```

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Set Up Python Backend
```bash
cd python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 4. Install Ollama and Pull Llama 3
```bash
brew install ollama
ollama pull llama3
```
This downloads the Llama 3 model (~4.7 GB). Only needed once.

### 5. Install Stable Diffusion (WebUI Forge)
```bash
cd ~
git clone https://github.com/lllyasviel/stable-diffusion-webui-forge.git
cd stable-diffusion-webui-forge
```

Create a Python 3.10 venv for SD (requires Python 3.10):
```bash
brew install python@3.10
/usr/local/opt/python@3.10/bin/python3.10 -m venv venv
source venv/bin/activate
pip install setuptools==69.5.1
pip install git+https://github.com/openai/CLIP.git
```

### 6. Download the Stable Diffusion Model
```bash
curl -L "https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors" -o ~/stable-diffusion-webui-forge/models/Stable-diffusion/v1-5-pruned-emaonly.safetensors
```
This downloads the SD 1.5 model (~4 GB). Only needed once.

---

## Running the Application

You need **4 terminal windows/tabs** running simultaneously.

### Terminal 1 — Ollama
```bash
ollama serve
```
If you see "address already in use", Ollama is already running — that's fine.

> **Note:** MLX warnings on Mac are non-fatal and can be ignored.

### Terminal 2 — Stable Diffusion
```bash
cd ~/stable-diffusion-webui-forge
source venv/bin/activate
./webui.sh --api --listen --skip-torch-cuda-test
```
Wait until you see `Running on local URL: http://0.0.0.0:7860` before proceeding.

First time: go to `http://localhost:7860` in your browser and select the `v1-5-pruned-emaonly` model from the **Checkpoint** dropdown.

> **Note:** svglib/joblib warnings during startup are non-fatal and can be ignored.
> **Note:** On Intel Macs (no GPU), image generation takes 1-2 minutes per image.

### Terminal 3 — Python Backend
```bash
cd ~/minecraft-ai-builder/python
source venv/bin/activate
uvicorn services.main:app --reload
```
Backend runs on `http://localhost:8000`.

### Terminal 4 — Next.js Frontend
```bash
cd ~/minecraft-ai-builder
npm run dev
```
Frontend runs on `http://localhost:3000`.

### Open the App
Go to **http://localhost:3000** in your browser. Type a description (e.g., "a castle on a hill at sunset") and click **Generate**.

---

## How It Works

1. **Refine Prompt** — Your text is sent to Ollama/Llama 3 which optimizes it for image generation with blocky, voxel-friendly keywords
2. **Generate Image** — The refined prompt is sent to Stable Diffusion which generates a 512x512 image
3. **Convert to Blocks** — The image is analyzed and each pixel is matched to the closest Minecraft block color
4. **Preview** — You see the original image and block preview side by side

---

## Running Tests

### All Backend Tests
```bash
cd python
source venv/bin/activate
python -m pytest tests/ -v
```

### Individual Test Files
```bash
# Ollama prompt engineering tests
python -m pytest tests/test_ollama_service.py -v

# Color matching algorithm tests
python -m pytest tests/test_color_matcher.py -v
```

### Manual Service Tests

**Test prompt refinement (requires Ollama running):**
```bash
cd python
python -m services.ollama_service
```

**Test color matching and benchmark:**
```bash
cd python
python -m services.color_matcher
```

**Validate block color database:**
```bash
cd python
python -m utils.validate_blocks
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/refine-prompt` | Refine user description via Ollama/Llama 3 |
| POST | `/generate-image` | Generate image via Stable Diffusion |
| POST | `/convert-to-blocks` | Convert image to Minecraft block grid |

### Example: Full Pipeline via curl
```bash
# Step 1: Refine prompt
curl -X POST http://localhost:8000/refine-prompt \
  -H "Content-Type: application/json" \
  -d '{"description": "a castle on a hill"}'

# Step 2: Generate image (use refined prompt from step 1)
curl -X POST http://localhost:8000/generate-image \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a castle on a hill"}'

# Step 3: Convert to blocks (use base64 image from step 2)
curl -X POST http://localhost:8000/convert-to-blocks \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "", "width": 64, "height": 64}'
```

---

## Project Structure
```
minecraft-ai-builder/
├── app/                          # Next.js frontend
│   ├── api/                      # API routes (proxy to Python backend)
│   │   ├── refine-prompt/        # Prompt refinement endpoint
│   │   ├── generate-image/       # Image generation endpoint
│   │   ├── convert-to-blocks/    # Block conversion endpoint
│   │   └── block-colors/         # Block color data endpoint
│   ├── page.tsx                  # Main application page
│   └── layout.tsx                # App layout
├── components/                   # React components
│   ├── PromptInput.tsx           # Text input with character counter
│   ├── PipelineStatus.tsx        # Step-by-step progress indicator
│   ├── BlockPreview.tsx          # Canvas-based block grid preview
│   ├── ComparisonView.tsx        # Side-by-side image comparison
│   ├── ConversionSettings.tsx    # Grid size, palette, dithering controls
│   ├── Header.tsx                # App header
│   └── LayoutShell.tsx           # Layout wrapper
├── hooks/                        # Custom React hooks
│   └── useImageGeneration.ts     # Full pipeline state management
├── python/                       # Python backend
│   ├── data/                     # Static data files
│   │   ├── block_colors.json     # 204 Minecraft blocks with RGB values
│   │   └── palettes.json         # Palette presets (wool, concrete, etc.)
│   ├── services/                 # Core services
│   │   ├── main.py               # FastAPI app entry point
│   │   ├── ollama_service.py     # Ollama/Llama 3 prompt refinement
│   │   ├── sd_service.py         # Stable Diffusion image generation
│   │   ├── color_matcher.py      # Color distance + block matching
│   │   ├── block_mapper.py       # Image to block grid conversion
│   │   └── image_processor.py    # Image preprocessing
│   ├── utils/                    # Helper scripts
│   │   └── validate_blocks.py    # Block database validator
│   └── tests/                    # Unit tests
│       ├── test_ollama_service.py
│       └── test_color_matcher.py
├── docker-compose.yml            # Docker setup (optional)
├── Dockerfile.frontend           # Frontend Docker config
└── README.md
```

---

## System Requirements

| Component | RAM | Disk | Notes |
|-----------|-----|------|-------|
| Ollama (Llama 3) | 8 GB min, 16 GB recommended | ~5 GB | Runs on CPU |
| Stable Diffusion | 8 GB min, 16 GB recommended | ~5-10 GB | GPU recommended, CPU works but slow |
| **Total** | **16 GB min, 32 GB recommended** | ~15 GB | All services running simultaneously |

### Performance Notes
- **With NVIDIA GPU:** Image generation takes ~5-15 seconds
- **With Apple Silicon (M1/M2):** Image generation takes ~30-60 seconds
- **Intel Mac (no GPU):** Image generation takes ~1-3 minutes
- Block conversion for 64x64 grid takes <1 second
- Block conversion for 128x128 grid takes <3 seconds

---

## Troubleshooting

### "Refine failed" error
- Make sure Ollama is running (`ollama serve`)
- Check that Llama 3 is downloaded (`ollama list` should show llama3)

### "Image generation failed" error  
- Make sure Stable Diffusion is running on port 7860
- Check that a model is selected in the SD web UI
- On first run, go to `http://localhost:7860` and select the checkpoint

### "Conversion failed" error
- Make sure the Python backend is running on port 8000
- Check the Python terminal for error details

### SD startup errors
- `svglib` / `pycairo` errors: Non-fatal, can be ignored
- `joblib` error: Non-fatal, can be ignored  
- `CUDA not enabled`: Expected on Mac, uses CPU instead
- `No module named 'pkg_resources'`: Run `pip install setuptools==69.5.1` in SD venv

### General
- Make sure all 4 terminals are running before using the app
- Wait for SD to fully start (shows "Running on local URL") before generating images