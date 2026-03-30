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