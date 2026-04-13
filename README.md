# Minecraft AI Image-to-Blocks Generator

An AI-powered tool that converts text descriptions into Minecraft block patterns. Type a description, the AI refines it, generates an image, and converts it to Minecraft blocks you can import into your world.

## Tech Stack

- **Frontend:** Next.js 16 (React, TypeScript, Tailwind CSS)
- **NLP Processing:** Ollama + Llama 3
- **Image Generation:** Stable Diffusion 1.5 (local, via WebUI Forge)
- **Block Mapping:** Python (FastAPI, NumPy, SciPy)
- **Minecraft Export:** WorldEdit (.schem) / Structure Blocks (.nbt)
- **History Storage:** SQLite (via Python backend)

## Prerequisites

- **Node.js 22+** — `node -v`
- **Python 3.13+** — for the backend — `python3 --version`
- **Python 3.10** — required for Stable Diffusion — `brew install python@3.10`
- **Ollama** — `brew install ollama`
- **Git** — `git --version`
- **Homebrew** (Mac) — for installing dependencies

## First Time Setup

### 1. Clone the Repo
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
Downloads ~4.7 GB. Only needed once.

### 5. Install Stable Diffusion (WebUI Forge)
```bash
cd ~
git clone https://github.com/lllyasviel/stable-diffusion-webui-forge.git
cd stable-diffusion-webui-forge
/usr/local/opt/python@3.10/bin/python3.10 -m venv venv
source venv/bin/activate
pip install setuptools==69.5.1
pip install git+https://github.com/openai/CLIP.git
```

### 6. Download the SD Model
```bash
curl -L "https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors" \
  -o ~/stable-diffusion-webui-forge/models/Stable-diffusion/v1-5-pruned-emaonly.safetensors
```
Downloads ~4 GB. Only needed once.

---

## Running the Application

Open **4 terminal windows** and run each command:

### Terminal 1 — Ollama
```bash
ollama serve
```
"Address already in use" means it's already running — that's fine.

### Terminal 2 — Stable Diffusion
```bash
cd ~/stable-diffusion-webui-forge
source venv/bin/activate
./webui.sh --api --listen --skip-torch-cuda-test
```
Wait for `Running on local URL: http://0.0.0.0:7860` before proceeding. First time: open `http://localhost:7860` and select the `v1-5-pruned-emaonly` checkpoint.

### Terminal 3 — Python Backend
```bash
cd ~/minecraft-ai-builder/python
source venv/bin/activate
uvicorn services.main:app --reload
```

### Terminal 4 — Next.js Frontend
```bash
cd ~/minecraft-ai-builder
npm run dev
```

### Open the App
Go to **http://localhost:3000** and type a description like "a castle on a hill at sunset".

---

## How It Works

1. **Refine Prompt** — Ollama/Llama 3 optimizes your description for blocky, voxel-friendly image generation
2. **Generate Image** — Stable Diffusion generates a 512×512 image from the refined prompt
3. **Convert to Blocks** — Each pixel is matched to the closest Minecraft block color using CIE76 Delta-E in LAB color space
4. **Preview** — Side-by-side comparison of the original image and block preview with zoom/pan controls
5. **Export** — Download as .schem (WorldEdit) or .nbt (vanilla structure blocks) for import into Minecraft
6. **History** — Every generation is saved automatically. Browse past creations, remix a prompt, or delete entries from the gallery at the bottom of the page

---

## Running Tests

```bash
cd python
source venv/bin/activate

# All tests
python -m pytest tests/ -v

# Individual test suites
python -m pytest tests/test_ollama_service.py -v
python -m pytest tests/test_color_matcher.py -v
python -m pytest tests/test_schematic_exporter.py -v
python -m pytest tests/test_structure_exporter.py -v
```

### Manual Service Tests
```bash
# Test prompt refinement (requires Ollama running)
python -m services.ollama_service

# Test color matching and benchmark
python -m services.color_matcher

# Test history service
python -m services.history_service

# Validate block color database
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
| GET | `/history` | Get paginated generation history |
| POST | `/history` | Save a generation to history |
| GET | `/history/{id}` | Get a single history entry with full data |
| DELETE | `/history/{id}` | Delete a single history entry |
| DELETE | `/history` | Clear all history |

---

## Project Structure
```
minecraft-ai-builder/
├── app/                          # Next.js frontend
│   ├── api/                      # API routes (proxy to Python backend)
│   │   ├── refine-prompt/        # Prompt refinement
│   │   ├── generate-image/       # Image generation
│   │   ├── convert-to-blocks/    # Block conversion
│   │   ├── block-colors/         # Block color data
│   │   └── history/              # Generation history (GET, POST, DELETE)
│   │       └── [id]/             # Single entry (GET, DELETE)
│   ├── page.tsx                  # Main application page
│   └── layout.tsx                # App layout
├── components/                   # React components
│   ├── PromptInput.tsx           # Text input with character counter
│   ├── PipelineStatus.tsx        # Step-by-step progress indicator
│   ├── BlockPreview.tsx          # Canvas-based block grid preview
│   ├── ComparisonView.tsx        # Side-by-side image comparison
│   ├── ConversionSettings.tsx    # Grid size, palette, dithering controls
│   ├── HistoryGallery.tsx        # Generation history gallery with remix/delete
│   ├── ImportGuide.tsx           # In-app Minecraft import instructions
│   ├── VersionCompatibility.tsx  # MC version block compatibility checker
│   ├── Header.tsx                # App header
│   └── LayoutShell.tsx           # Layout wrapper
├── hooks/                        # Custom React hooks
│   └── useImageGeneration.ts     # Full pipeline state management + history save
├── Docs/                         # Project documentation
│   └── export-format-decision.md # Export format research & decision
├── python/                       # Python backend
│   ├── data/
│   │   ├── block_colors.json     # 204 Minecraft blocks with RGB values
│   │   ├── palettes.json         # 8 palette presets
│   │   └── history.db            # SQLite history database (auto-created)
│   ├── services/
│   │   ├── main.py               # FastAPI app
│   │   ├── ollama_service.py     # Prompt refinement
│   │   ├── sd_service.py         # Image generation
│   │   ├── color_matcher.py      # Color distance + block matching
│   │   ├── block_mapper.py       # Image to block grid
│   │   ├── image_processor.py    # Image preprocessing
│   │   ├── schematic_exporter.py # .schem export
│   │   ├── structure_exporter.py # .nbt export
│   │   ├── grid_extruder.py      # 2D to 3D extrusion
│   │   └── history_service.py    # SQLite history storage
│   ├── utils/
│   │   └── validate_blocks.py    # Block database validator
│   └── tests/                    # Unit tests
├── docker-compose.yml            # Docker setup (optional)
└── README.md
```

---

## System Requirements

| Component | RAM | Disk | Notes |
|-----------|-----|------|-------|
| Ollama (Llama 3) | 8 GB min | ~5 GB | CPU only |
| Stable Diffusion | 8 GB min | ~5-10 GB | GPU recommended |
| **Total** | **16 GB min, 32 GB recommended** | ~15 GB | All services simultaneous |

### Performance
- **NVIDIA GPU:** ~5-15 seconds per image
- **Apple Silicon (M1/M2):** ~30-60 seconds per image
- **Intel Mac (CPU):** ~1-3 minutes per image
- Block conversion 64×64: <1 second
- Block conversion 128×128: <3 seconds

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Refine failed" | Make sure Ollama is running (`ollama serve`) and Llama 3 is downloaded (`ollama list`) |
| "Image generation failed" | Make sure SD is running on port 7860 with a model selected |
| "Conversion failed" | Check Python backend is running on port 8000 |
| "Gray blocks in preview" | Restart all 4 services; check Python backend logs for errors |
| History not showing | Delete `python/data/history.db` and regenerate — schema may be outdated |
| SD `svglib`/`pycairo` errors | Non-fatal, ignore |
| SD `joblib` error | Non-fatal, ignore |
| SD `CUDA not enabled` | Expected on Mac, uses CPU |
| MLX warnings (Ollama) | Non-fatal, ignore |
| Refine timeout (504) | Increase `TIMEOUT_SECONDS` in `python/services/ollama_service.py` |
| Prompt too long (422) | `max_length` in `GenerateImageRequest` in `main.py` is set to 2000 |