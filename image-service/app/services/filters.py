"""Server-side basic adjustments (shared helper). Real-time camera filters stay in the browser; this exists for batch/utility use."""
from __future__ import annotations

from PIL import Image, ImageEnhance


def basic_adjust(img: Image.Image, brightness: float = 1.0, contrast: float = 1.0, saturation: float = 1.0) -> Image.Image:
    for v in (brightness, contrast, saturation):
        if not 0.0 <= v <= 3.0:
            raise ValueError("adjustment factors must be between 0 and 3")
    out = img.convert("RGBA") if img.mode == "RGBA" else img.convert("RGB")
    alpha = out.getchannel("A") if out.mode == "RGBA" else None
    rgb = out.convert("RGB")
    rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    rgb = ImageEnhance.Color(rgb).enhance(saturation)
    if alpha is not None:
        rgb = rgb.convert("RGBA")
        rgb.putalpha(alpha)
    return rgb
