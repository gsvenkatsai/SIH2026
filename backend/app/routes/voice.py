"""
Voice transcription router — ASR only, deliberately decoupled from clinical
interpretation.

Flow boundary maintained:
    Audio -> ASR (this router) -> transcript -> /interview/answer (clinical engine)

This endpoint never stores anything and never touches the interview engine,
so voice is strictly an input modality feeding the same clinical pipeline as
typed answers.
"""

import os
import time

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from app.groq_service import transcribe_audio, TranscriptionError
from app.languages import get_language_config
from app.schemas import VoiceTranscribeResponse

router = APIRouter(prefix="/voice", tags=["Voice"])

# 25 MB — matches Groq's free-tier upload ceiling; a 30s kiosk recording is far smaller.
MAX_AUDIO_BYTES = 25 * 1024 * 1024

SUPPORTED_AUDIO_EXTENSIONS = {
    ".mp3", ".mp4", ".mpge", ".mpeg", ".m4a", ".wav", ".webm", ".ogg", ".opus", ".flac"
}


@router.post("/transcribe", response_model=VoiceTranscribeResponse)
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form("en-IN"),
):
    """Transcribe patient audio to text in the selected language.

    Returns the transcript + confidence only. The frontend is responsible for
    showing it to the patient for confirmation BEFORE submitting it through
    the existing clinical interpretation endpoint (/interview/answer).
    """
    canonical = get_language_config(language)["code"]

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="empty_audio")

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio_too_large")

    filename = file.filename or "recording.webm"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in SUPPORTED_AUDIO_EXTENSIONS:
        # Don't reject unknown extensions outright (Content-Type varies by browser);
        # let Whisper try — its failure is surfaced as unsupported_format below.
        print(f"[Voice Router] Unusual audio extension '{ext}' — attempting transcription anyway.")

    started = time.time()
    try:
        result = transcribe_audio(audio_bytes, filename, language=canonical)
    except TranscriptionError as exc:
        # Machine-readable detail codes let the frontend show patient-friendly,
        # correctly translated messages instead of raw API errors.
        status_map = {
            "no_api_key": 503,
            "empty_audio": 400,
            "asr_unavailable": 503,
            "unsupported_format": 415,
            "transcription_failed": 502,
        }
        raise HTTPException(status_code=status_map.get(exc.kind, 502), detail=exc.kind)

    elapsed = round(time.time() - started, 2)
    print(f"[Voice Router] Transcribed {len(audio_bytes)}B as '{canonical}' in {elapsed}s "
          f"(conf={result['confidence']:.2f}, chars={len(result['transcript'])})")

    return VoiceTranscribeResponse(
        success=True,
        language=result["language"],
        transcript=result["transcript"],
        confidence=result["confidence"],
    )
