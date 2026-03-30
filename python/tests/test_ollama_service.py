"""Unit tests for Ollama prompt engineering service."""

import pytest
from unittest.mock import patch, MagicMock
from services.ollama_service import refine_prompt


class TestRefinePrompt:
    """Tests for the refine_prompt function."""

    @patch("services.ollama_service.requests.post")
    def test_successful_refinement(self, mock_post):
        """Should return refined prompt on successful API call."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": "A majestic stone castle with bold geometric towers"
        }
        mock_post.return_value = mock_response

        result = refine_prompt("a castle")
        assert result == "A majestic stone castle with bold geometric towers"
        mock_post.assert_called_once()

    @patch("services.ollama_service.requests.post")
    def test_strips_whitespace(self, mock_post):
        """Should strip whitespace from response."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "response": "  A refined prompt with spaces  \n"
        }
        mock_post.return_value = mock_response

        result = refine_prompt("test")
        assert result == "A refined prompt with spaces"

    def test_empty_input_raises_error(self):
        """Should raise ValueError for empty input."""
        with pytest.raises(ValueError, match="cannot be empty"):
            refine_prompt("")

    def test_whitespace_input_raises_error(self):
        """Should raise ValueError for whitespace-only input."""
        with pytest.raises(ValueError, match="cannot be empty"):
            refine_prompt("   ")

    @patch("services.ollama_service.requests.post")
    def test_empty_response_raises_error(self, mock_post):
        """Should raise RuntimeError when Ollama returns empty response."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"response": ""}
        mock_post.return_value = mock_response

        with pytest.raises(RuntimeError, match="empty response"):
            refine_prompt("a castle")

    @patch("services.ollama_service.requests.post")
    @patch("services.ollama_service.time.sleep")
    def test_retries_on_timeout(self, mock_sleep, mock_post):
        """Should retry with backoff on timeout."""
        import requests as req
        mock_post.side_effect = req.exceptions.Timeout()

        with pytest.raises(TimeoutError):
            refine_prompt("a castle")

        assert mock_post.call_count == 3
        mock_sleep.assert_any_call(1)
        mock_sleep.assert_any_call(2)

    @patch("services.ollama_service.requests.post")
    @patch("services.ollama_service.time.sleep")
    def test_retries_on_connection_error(self, mock_sleep, mock_post):
        """Should retry with backoff on connection error."""
        import requests as req
        mock_post.side_effect = req.exceptions.ConnectionError()

        with pytest.raises(ConnectionError):
            refine_prompt("a castle")

        assert mock_post.call_count == 3

    @patch("services.ollama_service.requests.post")
    @patch("services.ollama_service.time.sleep")
    def test_succeeds_after_retry(self, mock_sleep, mock_post):
        """Should succeed if a retry works."""
        import requests as req

        mock_success = MagicMock()
        mock_success.status_code = 200
        mock_success.json.return_value = {"response": "Enhanced prompt"}

        mock_post.side_effect = [req.exceptions.Timeout(), mock_success]

        result = refine_prompt("a castle")
        assert result == "Enhanced prompt"
        assert mock_post.call_count == 2