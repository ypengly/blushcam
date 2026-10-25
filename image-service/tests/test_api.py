"""Route tests (need fastapi + httpx installed: `pip install -r requirements.txt -r requirements-dev.txt`)."""
import io

import pytest
from PIL import Image

fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def png(w=32, h=24):
    b = io.BytesIO(); Image.new("RGB", (w, h), (120, 90, 80)).save(b, "PNG"); return b.getvalue()


def test_health_and_capabilities():
    assert client.get("/healthz").json() == {"status": "ok"}
    ops = {o["operation"]: o for o in client.get("/v1/capabilities").json()["operations"]}
    assert ops["upscale"]["available"] and not ops["remove-background"]["available"]


def test_upscale_roundtrip_dimensions_and_type():
    r = client.post("/v1/upscale", files={"file": ("a.png", png(), "application/octet-stream")}, data={"scale": "3"})
    assert r.status_code == 200 and r.headers["content-type"] == "image/png"
    assert Image.open(io.BytesIO(r.content)).size == (96, 72)


def test_unavailable_is_501_with_code_not_fake_success():
    r = client.post("/v1/remove-background", files={"file": ("a.png", png(), "image/png")})
    assert r.status_code == 501 and r.json()["detail"]["code"] == "unavailable"
    assert client.post("/v1/style-transform", files={"file": ("a.png", png(), "image/png")}).status_code == 501


def test_rejects_bad_uploads_and_unknown_ops():
    assert client.post("/v1/cleanup", files={"file": ("a.png", b"<html>", "image/png")}).status_code == 422
    assert client.post("/v1/nope", files={"file": ("a.png", png(), "image/png")}).status_code == 404
    assert client.post("/v1/upscale", files={"file": ("a.png", png(), "image/png")}, data={"scale": "9"}).status_code == 422
