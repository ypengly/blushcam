from __future__ import annotations

import asyncio

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse, Response

from ..config import get_settings
from ..providers.base import ProviderError
from ..schemas.models import CapabilitiesResponse, ErrorResponse, HealthResponse
from ..security.validation import ImageRejected, encode, load_validated
from ..services import registry
from ..services.enhancement import OutputTooLarge

router = APIRouter()
_slots = asyncio.Semaphore(2)  # bound concurrent CPU-heavy jobs


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": {"code": code, "message": message}})


@router.get("/healthz", response_model=HealthResponse)
def healthz() -> HealthResponse:
    return HealthResponse()


@router.get("/v1/capabilities", response_model=CapabilitiesResponse)
def capabilities() -> dict:
    return {"operations": registry.capabilities(get_settings())}


async def _read_limited(file: UploadFile, limit: int) -> bytes:
    chunks, total = [], 0
    while True:
        chunk = await file.read(1024 * 256)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise ImageRejected("too_large", f"Image is larger than {limit // (1024 * 1024)} MB.", 413)
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/v1/{operation}", responses={400: {"model": ErrorResponse}, 413: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 501: {"model": ErrorResponse}, 504: {"model": ErrorResponse}})
async def process(operation: str, file: UploadFile = File(...), scale: str | None = Form(None), background: str | None = Form(None)):
    s = get_settings()
    if operation not in registry.BY_KEY:
        return _err(404, "unknown_operation", f"Unknown operation “{operation}”.")
    try:
        data = await _read_limited(file, s.max_bytes)
        v = load_validated(data, s.max_bytes, s.max_pixels)
    except ImageRejected as e:
        return _err(e.status, e.code, e.message)
    params = {k: val for k, val in (("scale", scale), ("background", background)) if val}

    def work():
        out = registry.run(operation, v.image, params, s)
        fmt = "PNG" if ("A" in out.getbands() or v.format == "PNG") else v.format
        return encode(out, fmt)

    try:
        async with _slots:
            body, mime = await asyncio.wait_for(asyncio.to_thread(work), timeout=s.timeout_seconds + 5)
    except registry.Unavailable as e:
        return _err(501, "unavailable", e.message)  # honest: never fake a result
    except registry.BadParam as e:
        return _err(422, "bad_parameter", str(e))
    except OutputTooLarge as e:
        return _err(422, "output_too_large", str(e))
    except ProviderError as e:
        return _err(e.status, "provider_error", e.message)
    except asyncio.TimeoutError:
        return _err(504, "timeout", "Processing took too long.")
    except Exception:  # noqa: BLE001 - never leak internals
        return _err(500, "processing_failed", "The image couldn't be processed.")
    return Response(content=body, media_type=mime, headers={"Cache-Control": "no-store"})
