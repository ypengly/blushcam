"""Settings come from environment variables (see .env.example)."""
import os
from dataclasses import dataclass


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    max_bytes: int = _int("IMAGE_MAX_BYTES", 15 * 1024 * 1024)
    max_pixels: int = _int("IMAGE_MAX_PIXELS", 40_000_000)
    max_output_pixels: int = _int("IMAGE_MAX_OUTPUT_PIXELS", 60_000_000)
    timeout_seconds: float = float(os.environ.get("IMAGE_PROCESS_TIMEOUT_SECONDS", "20"))
    ai_provider: str = os.environ.get("AI_PROVIDER", "none")
    ai_provider_url: str = os.environ.get("AI_PROVIDER_URL", "")
    ai_provider_api_key: str = os.environ.get("AI_PROVIDER_API_KEY", "")


def get_settings() -> Settings:
    return Settings()
