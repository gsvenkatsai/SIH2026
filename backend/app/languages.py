"""
Centralized language configuration for MediKiosk patient interaction.

Canonical codes are BCP-47 style locale tags (en-IN / hi-IN / kn-IN) used by:
  - the frontend i18n layer and language selector
  - ASR language hints (mapped to ISO-639-1 short codes for Whisper)
  - TTS voice selection (exact locale match, then language-family fallback)
  - per-response language metadata stored on InterviewResponse

Legacy human-readable names ("English", "Hindi", "Kannada") and short codes
("en", "hi", "kn") remain accepted on input and normalized to canonical form
so existing records and older clients keep working.
"""

from typing import Dict, List, Optional

# Canonical supported languages (MVP: exactly these three)
SUPPORTED_LANGUAGES: Dict[str, Dict[str, str]] = {
    "en-IN": {
        "code": "en-IN",
        "name": "English",
        "native": "English",
        "short_code": "en",   # Whisper ASR language hint
        "flag": "🇬🇧",
    },
    "hi-IN": {
        "code": "hi-IN",
        "name": "Hindi",
        "native": "हिन्दी",
        "short_code": "hi",
        "flag": "🇮🇳",
    },
    "kn-IN": {
        "code": "kn-IN",
        "name": "Kannada",
        "native": "ಕನ್ನಡ",
        "short_code": "kn",
        "flag": "🇮🇳",
    },
}

DEFAULT_LANGUAGE = "en-IN"

# Accepts canonical codes, short codes, and legacy display names.
_ALIASES: Dict[str, str] = {
    "en-in": "en-IN", "en": "en-IN", "english": "en-IN", "en_in": "en-IN",
    "hi-in": "hi-IN", "hi": "hi-IN", "hindi": "hi-IN", "hi_in": "hi-IN",
    "kn-in": "kn-IN", "kn": "kn-IN", "kannada": "kn-IN", "kn_in": "kn-IN",
}


def normalize_language(language: Optional[str]) -> str:
    """Normalize any legacy name / short code / locale tag to a canonical code.

    Returns DEFAULT_LANGUAGE for None/empty/unknown values (never raises).
    """
    if not language:
        return DEFAULT_LANGUAGE
    return _ALIASES.get(str(language).strip().lower(), DEFAULT_LANGUAGE)


def is_supported(language: Optional[str]) -> bool:
    """Strict check: True only for strings that map directly to a supported language
    (canonical code, short code, or name). Unknown values return False — unlike
    normalize_language, which falls back to the default for graceful degradation."""
    if not language:
        return False
    return str(language).strip().lower() in _ALIASES


def get_language_config(language: Optional[str]) -> Dict[str, str]:
    """Returns full display/config metadata for a language (any accepted form)."""
    return SUPPORTED_LANGUAGES[normalize_language(language)]


def get_asr_language(language: Optional[str]) -> str:
    """Returns the ISO-639-1 short code used as the Whisper ASR language hint."""
    return get_language_config(language)["short_code"]


def supported_language_list() -> List[Dict[str, str]]:
    """Ordered list for UI selectors: Kannada, Hindi, English (patient-first order)."""
    order = ["kn-IN", "hi-IN", "en-IN"]
    return [SUPPORTED_LANGUAGES[code] for code in order]
