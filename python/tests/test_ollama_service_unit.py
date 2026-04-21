import pytest
from services.ollama_service import parse_refined_prompt, refine_prompt
from unittest import mock
import requests


def test_parse_refined_prompt_correct():
    resp = "Prompt: castle, flat vector illustration, bold black outline\nNegative: photograph, photo, realistic"
    pos, neg = parse_refined_prompt(resp)
    assert pos.startswith("castle")
    assert "realistic" in neg

def test_parse_refined_prompt_missing_negative():
    resp = "Prompt: apple, flat vector illustration, bold black outline"
    pos, neg = parse_refined_prompt(resp)
    assert pos.startswith("apple")
    assert "realistic" in neg

def test_parse_refined_prompt_missing_prompt():
    resp = "Negative: photograph, photo, realistic"
    pos, neg = parse_refined_prompt(resp)
    assert pos == "Negative: photograph, photo, realistic"
    assert "realistic" in neg

def test_parse_refined_prompt_blob():
    resp = "Just a blob of text"
    pos, neg = parse_refined_prompt(resp)
    assert pos == "Just a blob of text"
    assert "realistic" in neg


def test_refine_prompt_empty():
    with pytest.raises(ValueError):
        refine_prompt("")


def test_refine_prompt_timeout():
    with mock.patch("services.ollama_service.requests.post", side_effect=requests.exceptions.Timeout):
        with pytest.raises(TimeoutError):
            refine_prompt("a castle")


def test_refine_prompt_connection_error():
    with mock.patch("services.ollama_service.requests.post", side_effect=requests.exceptions.ConnectionError):
        with pytest.raises(ConnectionError):
            refine_prompt("a castle")


def test_refine_prompt_http_error():
    mock_resp = mock.Mock()
    mock_resp.raise_for_status.side_effect = requests.exceptions.HTTPError(response=mock.Mock(status_code=500))
    mock_resp.json.return_value = {"response": ""}
    with mock.patch("services.ollama_service.requests.post", return_value=mock_resp):
        with pytest.raises(RuntimeError):
            refine_prompt("a castle")


def test_refine_prompt_unexpected_error():
    with mock.patch("services.ollama_service.requests.post", side_effect=Exception("fail")):
        with pytest.raises(RuntimeError):
            refine_prompt("a castle")


def test_refine_prompt_success():
    mock_resp = mock.Mock()
    mock_resp.raise_for_status.return_value = None
    mock_resp.json.return_value = {"response": "Prompt: castle, flat vector illustration\nNegative: photograph, photo, realistic"}
    with mock.patch("services.ollama_service.requests.post", return_value=mock_resp):
        pos, neg = refine_prompt("a castle")
        assert pos.startswith("castle")
        assert "realistic" in neg
