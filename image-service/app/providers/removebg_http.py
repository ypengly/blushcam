"""Adapter for remove.bg-compatible HTTP APIs: multipart `image_file`, `X-Api-Key` header, PNG-with-alpha response."""
from __future__ import annotations

import io

from PIL import Image

from .base import ProviderError


class RemoveBgHttpProvider:
    name = "remove_bg_http"

    def __init__(self, url: str, api_key: str):
        self.url, self.api_key = url, api_key

    def remove_background(self, png_bytes: bytes, timeout: float) -> Image.Image:
        import httpx  # imported lazily: only needed when this provider is actually used

        try:
            r = httpx.post(self.url, headers={"X-Api-Key": self.api_key}, files={"image_file": ("image.png", png_bytes, "image/png")},
                           data={"size": "auto", "format": "png"}, timeout=timeout)
        except httpx.TimeoutException:
            raise ProviderError("The background-removal provider timed out.", 504)
        except httpx.HTTPError:
            raise ProviderError("Could not reach the background-removal provider.", 502)
        if r.status_code in (401, 403):
            raise ProviderError("The background-removal provider rejected our credentials.", 502)
        if r.status_code == 429:
            raise ProviderError("The background-removal provider is rate limiting us. Try again later.", 503)
        if r.status_code != 200:
            raise ProviderError(f"The background-removal provider returned an error ({r.status_code}).", 502)
        try:
            out = Image.open(io.BytesIO(r.content))
            out.load()
        except Exception:
            raise ProviderError("The provider returned an unreadable image.", 502)
        if "A" not in out.getbands():
            raise ProviderError("The provider did not return transparency.", 502)
        return out.convert("RGBA")
