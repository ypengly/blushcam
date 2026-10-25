"""Single source of truth for which operations exist and whether they are *really* available right now."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable

from PIL import Image

from ..config import Settings
from ..providers import provider_status
from . import background as bg
from . import enhancement as enh

COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


@dataclass
class Op:
    key: str
    label: str
    kind: str  # local-classical | external-provider | unavailable
    external: bool


OPS = [
    Op("portrait-enhance", "Portrait enhancement", "local-classical", False),
    Op("upscale", "Photo upscaling", "local-classical", False),
    Op("remove-background", "Background removal", "external-provider", True),
    Op("replace-background", "Background replacement", "external-provider", True),
    Op("blur-background", "Background blur", "external-provider", True),
    Op("lighting-correct", "Lighting correction", "local-classical", False),
    Op("style-transform", "Style transformation", "unavailable", False),
    Op("cleanup", "Automatic cleanup", "local-classical", False),
]
BY_KEY = {o.key: o for o in OPS}


def capabilities(s: Settings) -> list[dict]:
    provider, why_not = provider_status(s)
    out = []
    for o in OPS:
        if o.kind == "local-classical":
            avail, reason = True, "Classical image processing on our server (not generative AI)."
            if o.key == "upscale":
                reason = "Lanczos resampling with sharpening (not generative super-resolution)."
        elif o.kind == "external-provider":
            avail = provider is not None
            reason = f"Uses the “{provider.name}” provider; your photo is sent to it." if avail else f"Unavailable: {why_not}"
        else:
            avail, reason = False, "Not implemented: needs a generative model that this deployment doesn't include."
        out.append({"operation": o.key, "label": o.label, "available": avail, "kind": o.kind if avail or o.kind == "unavailable" else "external-provider", "reason": reason, "external": o.external and avail})
    return out


class Unavailable(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class BadParam(Exception):
    pass


def run(op_key: str, img: Image.Image, params: dict, s: Settings, provider_override=None) -> Image.Image:
    """Run one operation. `provider_override` lets tests inject a fake provider."""
    op = BY_KEY.get(op_key)
    if op is None:
        raise KeyError(op_key)
    if op.kind == "unavailable":
        raise Unavailable("Style transformation isn't available: it needs a generative model that isn't part of this deployment.")
    if op.key == "portrait-enhance":
        return enh.portrait_enhance(img)
    if op.key == "lighting-correct":
        return enh.lighting_correct(img)
    if op.key == "cleanup":
        return enh.cleanup(img)
    if op.key == "upscale":
        try:
            scale = int(params.get("scale", 2))
        except (TypeError, ValueError):
            raise BadParam("scale must be 2, 3 or 4")
        if scale not in (2, 3, 4):
            raise BadParam("scale must be 2, 3 or 4")
        return enh.upscale(img, scale, s.max_output_pixels)
    # external-provider operations
    provider, why_not = (provider_override, None) if provider_override is not None else provider_status(s)
    if provider is None:
        raise Unavailable(f"{op.label} isn't available: {why_not}")
    t = s.timeout_seconds
    if op.key == "remove-background":
        return bg.remove_background(img, provider, t)
    if op.key == "replace-background":
        color = params.get("background") or "#FFFFFF"
        if not COLOR_RE.match(color):
            raise BadParam("background must be a #RRGGBB colour")
        return bg.replace_background(img, provider, t, color)
    return bg.blur_background(img, provider, t)
