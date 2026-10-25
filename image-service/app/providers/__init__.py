from __future__ import annotations

from ..config import Settings
from .base import BackgroundProvider, ProviderError  # noqa: F401
from .removebg_http import RemoveBgHttpProvider

KNOWN = {"none", "remove_bg_http"}


def provider_status(s: Settings) -> tuple[BackgroundProvider | None, str | None]:
    """(provider, None) when usable; (None, reason) otherwise. Never pretends a provider works."""
    if s.ai_provider == "none":
        return None, "No external AI provider is configured (AI_PROVIDER=none)."
    if s.ai_provider not in KNOWN:
        return None, f"Unknown AI provider “{s.ai_provider}”. Supported: remove_bg_http."
    if s.ai_provider == "remove_bg_http":
        if not s.ai_provider_url or not s.ai_provider_api_key:
            return None, "remove_bg_http needs AI_PROVIDER_URL and AI_PROVIDER_API_KEY."
        return RemoveBgHttpProvider(s.ai_provider_url, s.ai_provider_api_key), None
    return None, "Provider not available."
