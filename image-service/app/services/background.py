"""Background operations. Segmentation needs a model, so these use a configured provider; compositing is done locally with Pillow."""
from __future__ import annotations

import io

from PIL import Image, ImageFilter

from ..providers.base import BackgroundProvider


def _png(img: Image.Image) -> bytes:
    b = io.BytesIO()
    img.convert("RGB").save(b, "PNG")
    return b.getvalue()


def cutout(img: Image.Image, provider: BackgroundProvider, timeout: float) -> Image.Image:
    fg = provider.remove_background(_png(img), timeout)
    if fg.size != img.size:
        fg = fg.resize(img.size, Image.LANCZOS)
    return fg


def remove_background(img: Image.Image, provider: BackgroundProvider, timeout: float) -> Image.Image:
    return cutout(img, provider, timeout)


def replace_background(img: Image.Image, provider: BackgroundProvider, timeout: float, color: str) -> Image.Image:
    fg = cutout(img, provider, timeout)
    base = Image.new("RGBA", img.size, color)
    return Image.alpha_composite(base, fg)


def blur_background(img: Image.Image, provider: BackgroundProvider, timeout: float, radius: float | None = None) -> Image.Image:
    fg = cutout(img, provider, timeout)
    r = radius if radius is not None else max(img.size) / 60
    base = img.convert("RGBA").filter(ImageFilter.GaussianBlur(r))
    return Image.alpha_composite(base, fg)
