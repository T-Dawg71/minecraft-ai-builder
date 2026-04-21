

import sys
import os
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport

# Ensure project root is in sys.path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from services.main import app


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_refine_prompt_valid(monkeypatch):
    import services.main
    monkeypatch.setattr(services.main, "refine_prompt", lambda desc: ("refined", "negative"))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/refine-prompt", json={"description": "a castle"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["refined"] == "refined"
        assert data["negative"] == "negative"


@pytest.mark.asyncio
async def test_refine_prompt_invalid():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/refine-prompt", json={"description": ""})
        assert resp.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_generate_image_invalid():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/generate-image", json={"prompt": ""})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_convert_to_blocks_invalid():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/convert-to-blocks", json={"image_base64": "", "width": 0, "height": 0, "palette": "full"})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_concurrent_refine_prompt(monkeypatch):
    import services.main
    monkeypatch.setattr(services.main, "refine_prompt", lambda desc: ("refined", "negative"))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        async def call():
            return await ac.post("/refine-prompt", json={"description": "castle"})
        results = await asyncio.gather(call(), call(), call())
        for resp in results:
            assert resp.status_code == 200
            assert resp.json()["refined"] == "refined"

# More tests for the full pipeline, timeouts, and large grid sizes would require
# additional mocking and setup, especially for image generation and block mapping.
# These can be added incrementally to cover DEV-330, DEV-334, DEV-335.
