# Minecraft AI Image-to-Blocks Generator

An AI-powered tool that converts text descriptions into Minecraft block patterns. Type a description, Stable Diffusion generates an image, and the system converts it to Minecraft blocks you can import directly into your world — with one click.

## Tech Stack

- **Frontend:** Next.js 16 (React, TypeScript, Tailwind CSS v4)
- **Image Generation:** Stable Diffusion 1.5 (local, via WebUI Forge)
- **Block Mapping:** Python (FastAPI, NumPy, SciPy)
- **Minecraft Export:** WorldEdit (.schem) / Structure Blocks (.nbt)
- **History Storage:** SQLite (via Python backend)

> **Note:** Ollama/Llama 3 is installed but no longer active in the pipeline. User input is passed directly to Stable Diffusion for simplicity and reliability.

---

## Prerequisites

- **Node.js 22+** — `node -v`
- **Python 3.13+** — for the backend — `python3 --version`
- **Python 3.10** — required for Stable Diffusion — `brew install python@3.10`
- **Git** — `git --version`
- **Homebrew** (Mac) — for installing dependencies

---

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

### 4. Install Stable Diffusion (WebUI Forge)
```bash
cd ~
git clone https://github.com/lllyasviel/stable-diffusion-webui-forge.git
cd stable-diffusion-webui-forge
/usr/local/opt/python@3.10/bin/python3.10 -m venv venv
source venv/bin/activate
pip install setuptools==69.5.1
pip install git+https://github.com/openai/CLIP.git
```

### 5. Download the SD Model
```bash
curl -L "https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors" \
  -o ~/stable-diffusion-webui-forge/models/Stable-diffusion/v1-5-pruned-emaonly.safetensors
```
Downloads ~4 GB. Only needed once.

### 6. (Optional) Install Ollama
Ollama is included in the codebase but is not active in the current pipeline.
```bash
brew install ollama
ollama pull llama3
```

---

## Running the Application

Open **3 terminal windows**:

### Terminal 1 — Stable Diffusion
```bash
cd ~/stable-diffusion-webui-forge
source venv/bin/activate
./webui.sh --api --listen --skip-torch-cuda-test
```
Wait for `Running on local URL: http://0.0.0.0:7860` before proceeding.
First time only: open `http://localhost:7860` and select the `v1-5-pruned-emaonly` checkpoint.

### Terminal 2 — Python Backend
```bash
cd ~/minecraft-ai-builder/python
source venv/bin/activate
uvicorn services.main:app --reload
```

### Terminal 3 — Next.js Frontend
```bash
cd ~/minecraft-ai-builder
npm run dev
```

### Open the App
Go to **http://localhost:3000** and type a description like `a castle on a hill`.

---

## How It Works

1. **Generate Image** — Your description is sent directly to Stable Diffusion which generates a 512×512 image
2. **Flatten & Preprocess** — The image is contrast-boosted, posterized, and color-flattened to improve block mapping accuracy
3. **Convert to Blocks** — Each pixel is matched to the closest Minecraft block using CIE76 Delta-E in LAB color space across 75 blocks (concrete, wool, terracotta, special blocks)
4. **Preview** — Side-by-side comparison of the original image and block grid with zoom/pan controls
5. **Send to Minecraft** — One-click export that copies the `.schem` directly to your WorldEdit schematics folder. Run two commands in-game and the build appears instantly.
6. **Export** — Also available: download `.schem`, `.nbt`, preview PNG, or block list CSV
7. **History** — Every generation is saved automatically. Browse, remix, or delete past creations from the gallery

---

## Importing into Minecraft

### Option 1 — Send to Minecraft Button (Easiest)
1. Generate a build in the app
2. Click **🎮 Send to Minecraft** in the Export panel
3. Open Minecraft, stand where you want the build placed
4. Run in chat:
```
//schem load minecraft-build
//paste
```
The `.schem` file is copied automatically — no manual file moving needed.

> **Mac:** `~/Library/Application Support/minecraft/config/worldedit/schematics/`
> **Windows:** `~/AppData/Roaming/.minecraft/config/worldedit/schematics/`
> **Linux:** `~/.minecraft/config/worldedit/schematics/`

### Option 2 — Download & Copy Manually
1. Click **Download schem** in the Export panel
2. Copy the file to your WorldEdit schematics folder (paths above)
3. Run `//schem load minecraft-build` then `//paste` in-game

### Option 3 — Structure Blocks (.nbt) — Vanilla, no mods needed
1. Copy the `.nbt` file to:
```
~/.minecraft/saves/[world]/generated/minecraft/structures/
```
2. Place a Structure Block in-game (`/give @s minecraft:structure_block`)
3. Set mode to **Load**, enter the filename, click **LOAD**

> Structure blocks have a 48×48×48 size limit. Use WorldEdit for larger builds.

---

## UI Features

| Feature | Description |
|---------|-------------|
| 🎮 Send to Minecraft | One-click copies .schem directly to WorldEdit folder |
| 🌙 Dark/Light Theme | Toggle in top-right corner, persists across sessions via localStorage |
| ⏳ Loading Skeleton | Animated placeholder appears immediately while SD generates |
| 🔍 Zoom & Pan | Mouse wheel zoom + drag on the block preview |
| 🖼 Image Editor | Crop and adjust the SD image before converting to blocks |
| 📋 History Gallery | Browse, remix, or delete past generations |
| 🔄 Re-convert | Adjust brightness/contrast/depth and re-run block mapping without regenerating the image |
| 🎚 Precision Sliders | Brightness, contrast, and depth sliders all have clearable text inputs for exact values |

---

## Running Tests

```bash
cd python
source venv/bin/activate

# All tests
python -m pytest tests/ -v

# Individual test suites
python -m pytest tests/test_color_matcher.py -v
python -m pytest tests/test_schematic_exporter.py -v
python -m pytest tests/test_structure_exporter.py -v
```

### Manual Service Tests
```bash
# Test color matching and benchmark
python -m services.color_matcher

# Validate block color database (should report 150+ blocks, 0 errors)
python -m utils.validate_blocks

# Test history service
python -m services.history_service
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/refine-prompt` | Returns input as-is (Ollama bypassed) |
| POST | `/generate-image` | Generate image via Stable Diffusion |
| POST | `/convert-to-blocks` | Convert image to Minecraft block grid |
| POST | `/export/schematic` | Export block grid as .schem or .nbt |
| POST | `/export/preview-image` | Export block grid as PNG |
| POST | `/export/block-list` | Export block list as CSV |
| POST | `/export/send-to-minecraft` | Copy .schem directly to WorldEdit schematics folder |
| GET | `/history` | Get paginated generation history |
| POST | `/history` | Save a generation to history |
| GET | `/history/{id}` | Get a single history entry |
| DELETE | `/history/{id}` | Delete a single history entry |
| DELETE | `/history` | Clear all history |

---

## Project Structure

```
minecraft-ai-builder/
├── app/                          # Next.js frontend
│   ├── api/                      # API routes (proxy to Python backend)
│   │   ├── refine-prompt/        # Returns input directly (Ollama bypassed)
│   │   ├── generate-image/       # Image generation via SD
│   │   ├── convert-to-blocks/    # Block conversion + color map attachment
│   │   ├── block-colors/         # Block color data from block_colors.json
│   │   ├── export/               # Schematic, preview image, block list, send-to-minecraft
│   │   └── history/              # Generation history (GET, POST, DELETE)
│   │       └── [id]/             # Single entry (GET, DELETE)
│   ├── page.tsx                  # Main application page
│   ├── layout.tsx                # App layout with ThemeToggle
│   └── globals.css               # Tailwind v4 theme + dark/light mode variables
├── components/                   # React components
│   ├── PromptInput.tsx           # Text input with character counter
│   ├── PipelineStatus.tsx        # Step-by-step progress indicator
│   ├── BlockPreview.tsx          # Canvas-based block grid renderer
│   ├── ComparisonView.tsx        # Side-by-side image vs block preview
│   ├── ConversionSettings.tsx    # Dithering, map art, brightness, contrast, depth sliders
│   ├── ExportPanel.tsx           # Send to Minecraft + download .schem/.nbt/PNG/CSV
│   ├── HistoryGallery.tsx        # Generation history with remix/delete
│   ├── ImportGuide.tsx           # In-app Minecraft import instructions (accordion)
│   ├── VersionCompatibility.tsx  # MC version block compatibility checker (default 1.21)
│   ├── SkeletonLoader.tsx        # Animated placeholder while generating
│   ├── ThemeToggle.tsx           # Dark/light theme toggle (fixed top-right)
│   ├── ImageEditor.tsx           # Pre-conversion image editing tools
│   ├── PaletteBuilder.tsx        # (Kept for reference, not active in UI)
│   └── MaterialsList.tsx         # Block materials list
├── hooks/
│   └── useImageGeneration.ts     # Pipeline state, settings persistence, history save
├── python/                       # Python backend
│   ├── data/
│   │   ├── block_colors.json     # 205 Minecraft blocks with RGB values
│   │   ├── palettes.json         # 8 palette presets (Full is default)
│   │   └── history.db            # SQLite history database (auto-created)
│   ├── services/
│   │   ├── main.py               # FastAPI app + all endpoints
│   │   ├── ollama_service.py     # Prompt formatter (bypassed in pipeline)
│   │   ├── sd_service.py         # SD image generation (DPM++ 2M Karras, CFG 9)
│   │   ├── color_matcher.py      # LAB color distance + KDTree block matching
│   │   ├── block_mapper.py       # Image to block grid (vectorized NumPy)
│   │   ├── image_processor.py    # Preprocessing: flatten, posterize, quantize
│   │   ├── schematic_exporter.py # WorldEdit .schem export
│   │   ├── structure_exporter.py # Vanilla .nbt export
│   │   ├── grid_extruder.py      # 2D to 3D extrusion for depth
│   │   └── history_service.py    # SQLite history storage
│   ├── utils/
│   │   └── validate_blocks.py    # Block database validator
│   └── tests/                    # Unit tests
│       ├── test_color_matcher.py
│       ├── test_schematic_exporter.py
│       └── test_structure_exporter.py
├── Docs/
│   └── export-format-decision.md # Export format research & decision
├── docker-compose.yml            # Docker setup (optional)
└── README.md
```

---

## Default Settings

| Setting | Value | Notes |
|---------|-------|-------|
| Grid size | 64×64 | Fixed — not user-selectable |
| Block palette | Full (75 blocks) | Fixed — concrete, wool, terracotta, special blocks |
| Minecraft version | 1.21 | Default in version compatibility checker |
| SD sampler | DPM++ 2M Karras | Better flat color output than Euler a |
| SD CFG scale | 9 | Higher prompt adherence |
| SD steps | 25 | Balance of speed and quality |
| Color algorithm | CIE76 Delta-E (LAB) | Most perceptually accurate |

---

## System Requirements

| Component | RAM | Disk | Notes |
|-----------|-----|------|-------|
| Stable Diffusion | 8 GB min | ~5-10 GB | GPU recommended |
| Python Backend | 2 GB | ~500 MB | FastAPI + NumPy |
| Next.js Frontend | 1 GB | ~300 MB | Dev mode |
| **Total** | **8 GB min, 16 GB recommended** | ~12 GB | |

### Performance
- **Apple Silicon (M1/M2/M3):** ~30-60 seconds per image
- **Intel Mac (CPU only):** ~1-3 minutes per image
- **NVIDIA GPU:** ~5-15 seconds per image
- Block conversion 64×64: <1 second

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Image generation failed: 500" | Make sure SD is running on port 7860 with a model selected |
| "Cannot reach the server" | Check Python backend is running on port 8000 (`uvicorn services.main:app --reload`) |
| "Conversion failed" | Restart Python backend; check terminal for errors |
| "Send to Minecraft" returns 404 | Make sure WorldEdit is installed and Minecraft has been launched at least once |
| Gray blocks in preview | Restart all services; check backend logs |
| SD slow on Mac | Expected — uses CPU. Apple Silicon is faster than Intel Mac |
| History not showing | Delete `python/data/history.db` and regenerate — schema may be outdated |
| SD `svglib`/`pycairo` errors | Non-fatal, ignore |
| SD `CUDA not enabled` | Expected on Mac, uses CPU |
| MLX warnings (Ollama) | Non-fatal, ignore — Ollama not active in pipeline |
| Theme not persisting | Clear localStorage in browser dev tools and reload |