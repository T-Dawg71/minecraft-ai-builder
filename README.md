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