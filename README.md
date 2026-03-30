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