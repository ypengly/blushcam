"""Tests for the implemented operations. Pure Pillow/numpy: runnable with `pytest` (or the bundled minimal runner)."""
import io

import numpy as np
import pytest
from PIL import Image

from app.config import Settings
from app.providers import provider_status
from app.providers.base import ProviderError
from app.security.validation import ImageRejected, encode, load_validated
from app.services import enhancement as enh
from app.services import registry
from app.services.filters import basic_adjust


def make_png(w=64, h=48, color=(120, 100, 90), mode="RGB") -> bytes:
    b = io.BytesIO()
    Image.new(mode, (w, h), color).save(b, "PNG")
    return b.getvalue()


def gradient(w=64, h=48) -> Image.Image:
    x = np.tile(np.linspace(60, 140, w, dtype=np.uint8), (h, 1))
    return Image.fromarray(np.stack([x, x, x], -1))


# ---------- validation ----------
def test_valid_png_jpeg_webp():
    for fmt, mime in (("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")):
        b = io.BytesIO(); Image.new("RGB", (20, 10), (1, 2, 3)).save(b, fmt)
        v = load_validated(b.getvalue(), 1_000_000, 1_000_000)
        assert v.mime == mime and v.image.size == (20, 10)


@pytest.mark.parametrize("data", [b"", b"<html>nope</html>", b"GIF89a" + b"\0" * 20, b"\x89PNG\r\n\x1a\n" + b"junk"])
def test_rejects_non_images(data):
    with pytest.raises(ImageRejected):
        load_validated(data, 1_000_000, 1_000_000)


def test_rejects_oversize_bytes_and_pixels_and_truncated():
    png = make_png(200, 200)
    with pytest.raises(ImageRejected) as e:
        load_validated(png, 100, 10**9)
    assert e.value.status == 413
    with pytest.raises(ImageRejected) as e:
        load_validated(png, 10**7, 1000)
    assert e.value.code == "too_many_pixels"
    with pytest.raises(ImageRejected):
        load_validated(png[: len(png) // 2], 10**7, 10**9)


def test_gif_is_rejected_even_though_pillow_can_open_it():
    b = io.BytesIO(); Image.new("P", (4, 4)).save(b, "GIF")
    with pytest.raises(ImageRejected):
        load_validated(b.getvalue(), 10**6, 10**6)


# ---------- output format / dimensions ----------
def test_encode_formats():
    img = Image.new("RGBA", (5, 5), (1, 2, 3, 128))
    for fmt, mime in (("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")):
        data, m = encode(img, fmt)
        assert m == mime and Image.open(io.BytesIO(data)).size == (5, 5)


# ---------- enhancement ----------
def test_upscale_dimensions_and_limit():
    img = gradient(30, 20)
    for k in (2, 3, 4):
        assert enh.upscale(img, k, 10**9).size == (30 * k, 20 * k)
    with pytest.raises(enh.OutputTooLarge):
        enh.upscale(img, 4, 1000)
    with pytest.raises(ValueError):
        enh.upscale(img, 5, 10**9)


def test_lighting_correct_brightens_dark_and_darkens_bright_images():
    dark = Image.fromarray((np.random.default_rng(1).random((40, 40, 3)) * 60).astype(np.uint8))
    bright = Image.fromarray((195 + np.random.default_rng(2).random((40, 40, 3)) * 60).astype(np.uint8))
    assert np.asarray(enh.lighting_correct(dark)).mean() > np.asarray(dark).mean() + 20
    assert np.asarray(enh.lighting_correct(bright)).mean() < np.asarray(bright).mean() - 20


def test_flat_image_unchanged_not_crashing():
    flat = Image.new("RGB", (16, 16), (100, 100, 100))
    assert enh.lighting_correct(flat).size == (16, 16)


def test_portrait_and_cleanup_preserve_size_and_alpha():
    rgba = Image.new("RGBA", (40, 30), (200, 150, 140, 255)); rgba.putpixel((0, 0), (0, 0, 0, 0))
    for fn in (enh.portrait_enhance, enh.cleanup):
        out = fn(gradient(40, 30)); assert out.size == (40, 30)
        out = fn(rgba); assert out.size == (40, 30) and out.mode == "RGBA" and out.getpixel((0, 0))[3] == 0


def test_portrait_enhance_smooths_moderate_noise():
    """Skin-like gradient with sensor-level noise. (Extreme white noise is out of scope for a gentle portrait filter.)"""
    hf = lambda a: np.abs(a[1:, :, :] - a[:-1, :, :]).mean()  # high-frequency energy
    ramp = np.tile(np.linspace(90, 170, 60, dtype=np.float32), (60, 1))[..., None].repeat(3, 2)
    for sd, seed in ((6, 3), (10, 4)):
        noisy = Image.fromarray(np.clip(ramp + np.random.default_rng(seed).normal(0, sd, ramp.shape), 0, 255).astype(np.uint8))
        baseline = np.asarray(enh.lighting_correct(noisy, 0.6)).astype(float)  # same exposure fix, no smoothing
        assert hf(np.asarray(enh.portrait_enhance(noisy)).astype(float)) < hf(baseline)


def test_portrait_enhance_smooths_without_opencv_too():
    saved = enh.cv2
    enh.cv2 = None
    try:
        test_portrait_enhance_smooths_moderate_noise()
    finally:
        enh.cv2 = saved


def test_basic_adjust_validation():
    assert basic_adjust(gradient(), 1.2, 1.1, 0.9).size == (64, 48)
    with pytest.raises(ValueError):
        basic_adjust(gradient(), 5)


# ---------- providers / registry ----------
def caps(**kw):
    return {c["operation"]: c for c in registry.capabilities(Settings(**kw))}


def test_capabilities_are_honest_without_provider():
    c = caps(ai_provider="none")
    for op in ("portrait-enhance", "upscale", "lighting-correct", "cleanup"):
        assert c[op]["available"] and not c[op]["external"]
    for op in ("remove-background", "replace-background", "blur-background"):
        assert not c[op]["available"] and "provider" in c[op]["reason"].lower()
    assert not c["style-transform"]["available"]


def test_unknown_and_misconfigured_providers_are_unavailable():
    assert provider_status(Settings(ai_provider="magic-ai"))[0] is None
    assert "Unknown" in provider_status(Settings(ai_provider="magic-ai"))[1]
    assert provider_status(Settings(ai_provider="remove_bg_http", ai_provider_url="", ai_provider_api_key=""))[0] is None
    p, why = provider_status(Settings(ai_provider="remove_bg_http", ai_provider_url="https://x.test", ai_provider_api_key="k"))
    assert p is not None and why is None
    assert caps(ai_provider="remove_bg_http", ai_provider_url="https://x.test", ai_provider_api_key="k")["remove-background"]["external"]


def test_background_ops_refuse_without_provider_and_style_transform_never_fakes():
    img = gradient()
    for op in ("remove-background", "replace-background", "blur-background"):
        with pytest.raises(registry.Unavailable):
            registry.run(op, img, {}, Settings(ai_provider="none"))
    with pytest.raises(registry.Unavailable):
        registry.run("style-transform", img, {}, Settings())


class FakeProvider:
    name = "fake"

    def remove_background(self, png_bytes, timeout):  # left half foreground, right half transparent
        im = Image.open(io.BytesIO(png_bytes)).convert("RGBA"); w, h = im.size
        a = Image.new("L", (w, h), 0); a.paste(255, (0, 0, w // 2, h)); im.putalpha(a); return im


def test_background_ops_with_injected_provider():
    img = Image.new("RGB", (40, 20), (200, 30, 30)); s = Settings(ai_provider="none")
    cut = registry.run("remove-background", img, {}, s, FakeProvider())
    assert cut.getpixel((30, 5))[3] == 0 and cut.getpixel((5, 5))[3] == 255
    rep = registry.run("replace-background", img, {"background": "#00FF00"}, s, FakeProvider())
    assert rep.getpixel((30, 5))[:3] == (0, 255, 0) and rep.getpixel((5, 5))[:3] == (200, 30, 30)
    blur = registry.run("blur-background", img, {}, s, FakeProvider())
    assert blur.getpixel((5, 5))[:3] == (200, 30, 30)
    with pytest.raises(registry.BadParam):
        registry.run("replace-background", img, {"background": "red; drop table"}, s, FakeProvider())


def test_provider_failure_surfaces_instead_of_fake_success():
    class Broken:
        name = "broken"
        def remove_background(self, b, t): raise ProviderError("down", 502)
    with pytest.raises(ProviderError):
        registry.run("remove-background", gradient(), {}, Settings(), Broken())


def test_bad_upscale_param():
    with pytest.raises(registry.BadParam):
        registry.run("upscale", gradient(), {"scale": "9"}, Settings())
    with pytest.raises(registry.BadParam):
        registry.run("upscale", gradient(), {"scale": "abc"}, Settings())
