"""Unit tests for Stable Diffusion image service."""

import base64
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
import requests
from PIL import Image

from services.sd_service import (
    DEFAULT_CFG_SCALE,
    DEFAULT_HEIGHT,
    DEFAULT_SAMPLER_NAME,
    DEFAULT_STEPS,
    DEFAULT_WIDTH,
    REQUEST_TIMEOUT_SECONDS,
    SDServiceError,
    SDServiceTimeoutError,
    SDServiceUnavailableError,
    generate_image,
)


def _png_b64() -> str:
    """Create a tiny valid PNG and return its base64 representation."""
    image = Image.new("RGB", (2, 2), (255, 0, 0))
    buf = BytesIO()
    image.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


class TestGenerateImage:
    @patch("services.sd_service.requests.post")
    def test_generate_image_success_returns_png_bytes(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"images": [_png_b64()]}
        mock_post.return_value = mock_response

        result = generate_image("a red block")

        assert isinstance(result, bytes)
        assert result.startswith(b"\x89PNG\r\n\x1a\n")
        mock_post.assert_called_once()
        kwargs = mock_post.call_args.kwargs
        assert kwargs["timeout"] == REQUEST_TIMEOUT_SECONDS
        assert kwargs["json"]["steps"] == 18
        assert kwargs["json"]["sampler_name"] == "Euler a"
        assert kwargs["json"]["cfg_scale"] == 7
        assert kwargs["json"]["width"] == DEFAULT_WIDTH
        assert kwargs["json"]["height"] == DEFAULT_HEIGHT

    @patch("services.sd_service.requests.post")
    def test_generate_image_supports_single_image_field(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"image": _png_b64()}
        mock_post.return_value = mock_response

        result = generate_image("a red block")
        assert isinstance(result, bytes)
        assert result.startswith(b"\x89PNG\r\n\x1a\n")

    def test_generate_image_empty_prompt_raises(self):
        with pytest.raises(ValueError, match="Prompt cannot be empty"):
            generate_image("  ")

    def test_generate_image_non_positive_size_raises(self):
        with pytest.raises(ValueError, match="positive"):
            generate_image("a tower", width=0, height=512)

    @patch("services.sd_service.requests.post")
    def test_generate_image_missing_images_raises(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {}
        mock_post.return_value = mock_response

        with pytest.raises(SDServiceError, match="did not include image data"):
            generate_image("a castle")

    @patch("services.sd_service.requests.post")
    def test_generate_image_invalid_image_payload_raises(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"images": [None]}
        mock_post.return_value = mock_response

        with pytest.raises(SDServiceError, match="invalid image payload"):
            generate_image("a castle")

    @patch("services.sd_service.requests.post")
    def test_generate_image_connection_error_maps_unavailable(self, mock_post):
        mock_post.side_effect = requests.exceptions.ConnectionError()

        with pytest.raises(SDServiceUnavailableError, match="Cannot connect"):
            generate_image("a castle")

    @patch("services.sd_service.requests.post")
    def test_generate_image_http_503_maps_unavailable(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 503
        http_error = requests.exceptions.HTTPError(response=mock_response)

        failing_response = MagicMock()
        failing_response.raise_for_status.side_effect = http_error
        mock_post.return_value = failing_response

        with pytest.raises(SDServiceUnavailableError, match="temporarily unavailable"):
            generate_image("a castle")

    @patch("services.sd_service.requests.post")
    def test_generate_image_timeout_maps_timeout_error(self, mock_post):
        mock_post.side_effect = requests.exceptions.Timeout()

        with pytest.raises(SDServiceTimeoutError, match="timed out"):
            generate_image("a castle")
