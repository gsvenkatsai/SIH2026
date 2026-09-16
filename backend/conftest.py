"""
Pytest configuration: force deterministic OFFLINE mode for the automated suite.

The automated tests must never depend on network availability or API keys:
groq_service.get_groq_client() returns None when the key equals the placeholder
value, so every LLM/ASR path exercises its deterministic fallback engine and
the suite runs identically on any machine, with or without backend/.env.

Live-API behavior (real Whisper transcription, real LLM extraction) is covered
separately by test_voice_live.py, which requires the backend to be running.
"""

import os

os.environ["GROQ_API_KEY"] = "gsk_your_groq_api_key_here"
