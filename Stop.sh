#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# Minecraft AI Builder — Stop All Services (Mac)
# Kills Stable Diffusion, Python Backend, and Next.js Frontend
# Usage: ./stop.sh
# ─────────────────────────────────────────────────────────────────────────────

echo "🛑 Stopping Minecraft AI Builder services..."
echo ""

# Kill Next.js (next dev)
if pkill -f "next dev" 2>/dev/null; then
  echo "✅ Next.js frontend stopped"
else
  echo "⚠️  Next.js was not running"
fi

# Kill uvicorn (Python backend)
if pkill -f "uvicorn services.main:app" 2>/dev/null; then
  echo "✅ Python backend stopped"
else
  echo "⚠️  Python backend was not running"
fi

# Kill Stable Diffusion (webui.sh)
if pkill -f "webui.sh" 2>/dev/null; then
  echo "✅ Stable Diffusion stopped"
else
  echo "⚠️  Stable Diffusion was not running"
fi

# Kill any lingering torch/python SD processes
pkill -f "stable-diffusion-webui-forge" 2>/dev/null

echo ""
echo "✅ All services stopped."