#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# Minecraft AI Builder — Start All Services (Mac)
# Opens 3 Terminal windows: Stable Diffusion, Python Backend, Next.js Frontend
# Usage: ./start.sh
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SD_DIR="$HOME/stable-diffusion-webui-forge"

echo "🎮 Starting Minecraft AI Builder..."
echo ""

# Check Stable Diffusion exists
if [ ! -d "$SD_DIR" ]; then
  echo "❌ Stable Diffusion not found at $SD_DIR"
  echo "   Run the setup instructions in README.md first."
  exit 1
fi

osascript <<EOF
tell application "Terminal"
  -- Window 1: Stable Diffusion
  set w1 to do script "echo '🖼  Stable Diffusion' && cd $SD_DIR && source venv/bin/activate && ./webui.sh --api --listen --skip-torch-cuda-test"
  set custom title of w1 to "SD"

  -- Window 2: Python Backend
  set w2 to do script "echo '🐍 Python Backend' && cd $SCRIPT_DIR/python && source venv/bin/activate && uvicorn services.main:app --reload"
  set custom title of w2 to "Backend"

  -- Window 3: Next.js Frontend
  set w3 to do script "echo '⚡ Next.js Frontend' && cd $SCRIPT_DIR && npm run dev"
  set custom title of w3 to "Frontend"

  activate
end tell
EOF

echo ""
echo "✅ All 3 services starting in separate Terminal windows."
echo ""
echo "⏳ Wait for Stable Diffusion to show:"
echo "   'Running on local URL: http://0.0.0.0:7860'"
echo ""
echo "   First time only: go to http://localhost:7860"
echo "   and select the v1-5-pruned-emaonly checkpoint."
echo ""
echo "🌐 Then open: http://localhost:3000"