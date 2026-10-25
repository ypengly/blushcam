"""Image validation: real decoding, size caps, decompression-bomb protection."""
from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, UnidentifiedImageError

ALLOWED_FORMATS = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}


class ImageRejected(Exception):
    def __init__(self, code: str, message: str, status: int = 422):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


@dataclass
class Validated:
    image: Image.Image
    format: str
    mime: str


def load_validated(data: bytes, max_bytes: int, max_pixels: int) -> Validated:
    """Check size, identify the real format from the bytes, enforce the pixel cap BEFORE decoding pixels, then fully decode."""
    if not data:
        raise ImageRejected("empty", "No image data was received.", 400)
    if len(data) > max_bytes:
        raise ImageRejected("too_large", f"Image is larger than {max_bytes // (1024 * 1024)} MB.", 413)
    # Our explicit cap below runs on the header BEFORE any pixel decode; Pillow's built-in bomb guard remains as a second line of defence.
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format or ""
            w, h = probe.size
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        raise ImageRejected("unsupported_image", "Unsupported or corrupt image. Use PNG, JPEG or WebP.")
    if fmt not in ALLOWED_FORMATS:
        raise ImageRejected("unsupported_image", "Unsupported image format. Use PNG, JPEG or WebP.")
    if w <= 0 or h <= 0 or w * h > max_pixels:
        raise ImageRejected("too_many_pixels", f"Image has too many pixels (limit {max_pixels // 1_000_000} megapixels).")
    try:
        img = Image.open(io.BytesIO(data))
        img.load()  # full decode catches truncated / corrupt files
    except (OSError, Image.DecompressionBombError, ValueError, SyntaxError):
        raise ImageRejected("corrupt_image", "That image file is corrupt.")
    from PIL import ImageOps

    img = ImageOps.exif_transpose(img)  # honour camera orientation
    return Validated(image=img, format=fmt, mime=ALLOWED_FORMATS[fmt])


def encode(img: Image.Image, fmt: str = "PNG", quality: int = 92) -> tuple[bytes, str]:
    buf = io.BytesIO()
    if fmt == "JPEG":
        img.convert("RGB").save(buf, "JPEG", quality=quality, optimize=True)
        return buf.getvalue(), "image/jpeg"
    if fmt == "WEBP":
        img.save(buf, "WEBP", quality=quality)
        return buf.getvalue(), "image/webp"
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue(), "image/png"
