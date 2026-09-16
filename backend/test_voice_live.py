"""
End-to-end verification of POST /voice/transcribe with REAL Groq Whisper
transcription across all three supported languages.

Synthesizes speech via gTTS (same technique as test_whisper_languages.py),
sends the audio to the running backend, and prints the transcript.
Run with the backend live:  python test_voice_live.py
"""
import io
import os
import sys

# Windows consoles default to cp1252 and crash printing Devanagari/Kannada.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import requests
from gtts import gTTS

BASE_URL = os.getenv("BASE_URL", "http://localhost:8005")

# (canonical language, spoken phrase, gTTS voice code)
CASES = [
    ("en-IN", "I have crushing chest pain radiating to my left arm since two hours", "en"),
    ("hi-IN", "मुझे दो घंटे से सीने में दर्द है जो बाएं हाथ तक जाता है", "hi"),
    ("kn-IN", "ಎರಡು ಗಂಟೆಗಳಿಂದ ನನಗೆ ಎದೆ ನೋವು ಇದೆ, ಅದು ಎಡಗೈಗೆ ಹೋಗುತ್ತದೆ", "kn"),
]


def main():
    print("=" * 72)
    print("LIVE /voice/transcribe verification (Groq Whisper-large-v3)")
    print("=" * 72)

    results = []
    for canonical, phrase, gtts_lang in CASES:
        print(f"\n[{canonical}] phrase: {phrase}")
        buf = io.BytesIO()
        try:
            gTTS(text=phrase, lang=gtts_lang).write_to_fp(buf)
        except Exception as e:
            print(f"  gTTS failed: {e}")
            results.append((canonical, None, "gtts_error"))
            continue
        buf.seek(0)

        try:
            res = requests.post(
                f"{BASE_URL}/voice/transcribe",
                files={"file": (f"speech_{gtts_lang}.mp3", buf, "audio/mpeg")},
                data={"language": canonical},
                timeout=60,
            )
        except Exception as e:
            print(f"  request failed: {e}")
            results.append((canonical, None, "request_error"))
            continue

        if res.status_code != 200:
            print(f"  HTTP {res.status_code}: {res.text[:200]}")
            results.append((canonical, None, f"http_{res.status_code}"))
            continue

        data = res.json()
        transcript = data.get("transcript", "")
        conf = data.get("confidence", 0.0)
        print(f"  transcript : {transcript}")
        print(f"  confidence : {conf:.2f} | language: {data.get('language')}")
        results.append((canonical, transcript, conf))

    print("\n" + "=" * 72)
    ok = sum(1 for _, t, _ in results if t)
    print(f"RESULT: {ok}/{len(results)} languages transcribed successfully")
    for canonical, transcript, extra in results:
        status = "OK" if transcript else f"FAIL ({extra})"
        print(f"  {canonical}: {status} -> {str(transcript)[:60]}")
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
