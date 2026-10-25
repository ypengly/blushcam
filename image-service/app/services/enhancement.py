"""Classical (non-generative) enhancement. These are honest, deterministic image operations — not AI models."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

try:  # OpenCV is optional: used when present for better edge-preserving smoothing/denoising
    import cv2  # type: ignore
except Exception:  # pragma: no cover
    cv2 = None


def _rgb(img: Image.Image) -> tuple[Image.Image, Image.Image | None]:
    """Return (RGB image, alpha band or None) so alpha survives processing."""
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        return rgba.convert("RGB"), rgba.getchannel("A")
    return img.convert("RGB"), None


def _restore_alpha(img: Image.Image, alpha: Image.Image | None) -> Image.Image:
    if alpha is None:
        return img
    out = img.convert("RGBA")
    out.putalpha(alpha)
    return out


def lighting_correct(img: Image.Image, strength: float = 1.0) -> Image.Image:
    """Stretch luminance between its 1st/99th percentiles and nudge mid-tones toward a balanced exposure."""
    rgb, alpha = _rgb(img)
    ycc = np.asarray(rgb.convert("YCbCr"), dtype=np.float32)
    y = ycc[..., 0]
    lo, hi = np.percentile(y, [1, 99])
    if hi - lo < 8:  # flat image: nothing sensible to do
        return _restore_alpha(rgb, alpha)
    stretched = np.clip((y - lo) / (hi - lo), 0, 1)
    mean = float(stretched.mean())
    gamma = float(np.clip(np.log(0.5) / np.log(max(mean, 1e-3)), 0.7, 1.5))  # <1 brightens, >1 darkens
    corrected = (stretched ** gamma) * 255.0
    ycc[..., 0] = y * (1 - strength) + corrected * strength
    out = Image.fromarray(np.clip(ycc, 0, 255).astype(np.uint8), "YCbCr").convert("RGB")
    return _restore_alpha(out, alpha)


def portrait_enhance(img: Image.Image) -> Image.Image:
    """Gentle skin-friendly smoothing (edge-preserving), light-balance, a touch of detail and warmth."""
    rgb, alpha = _rgb(lighting_correct(img, 0.6))
    arr = np.asarray(rgb)
    if cv2 is not None:
        smooth = cv2.bilateralFilter(arr, d=9, sigmaColor=60, sigmaSpace=9)
        smooth_img = Image.fromarray(smooth)
    else:
        smooth_img = rgb.filter(ImageFilter.MedianFilter(3))
    blended = Image.blend(rgb, smooth_img, 0.5)
    blended = blended.filter(ImageFilter.UnsharpMask(radius=1.2, percent=25, threshold=8))  # threshold keeps sharpening from re-amplifying noise
    blended = ImageEnhance.Color(blended).enhance(1.05)
    return _restore_alpha(blended, alpha)


def cleanup(img: Image.Image) -> Image.Image:
    """Light denoise + auto-contrast."""
    rgb, alpha = _rgb(img)
    if cv2 is not None:
        arr = cv2.fastNlMeansDenoisingColored(np.asarray(rgb), None, 4, 4, 7, 15)
        rgb = Image.fromarray(arr)
    else:
        rgb = rgb.filter(ImageFilter.MedianFilter(3))
    rgb = ImageOps.autocontrast(rgb, cutoff=0.5)
    return _restore_alpha(rgb, alpha)


class OutputTooLarge(Exception):
    pass


def upscale(img: Image.Image, scale: int, max_output_pixels: int) -> Image.Image:
    """Lanczos resampling + mild sharpening. This is classical interpolation, NOT generative super-resolution."""
    if scale not in (2, 3, 4):
        raise ValueError("scale must be 2, 3 or 4")
    w, h = img.size
    if w * scale * h * scale > max_output_pixels:
        raise OutputTooLarge(f"The upscaled image would exceed {max_output_pixels // 1_000_000} megapixels.")
    out = img.resize((w * scale, h * scale), Image.LANCZOS)
    return out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
