"""Provider interface for operations that need an external model (background segmentation)."""
from __future__ import annotations

from typing import Protocol

from PIL import Image


class ProviderError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.message, self.status = message, status


class BackgroundProvider(Protocol):
    name: str

    def remove_background(self, png_bytes: bytes, timeout: float) -> Image.Image:
        """Return an RGBA image whose alpha channel is the foreground mask."""
        ...
