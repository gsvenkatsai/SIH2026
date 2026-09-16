import io
import requests
from gtts import gTTS

BASE_URL = "http://localhost:8005"

TEST_CASES = [
    {
        "lang_code": "en",
        "lang_name": "English",
        "phrase": "I have had chest pain for three days",
        "gtts_lang": "en"
    },
    {
        "lang_code": "hi",
        "lang_name": "Hindi",
        "phrase": "मुझे तीन दिनों से सीने में दर्द है",
        "gtts_lang": "hi"
    },
    {
        "lang_code": "kn",
        "lang_name": "Kannada",
        "phrase": "ನನಗೆ ಮೂರು ದಿನಗಳಿಂದ ಎದೆ ನೋವು ಇದೆ",
        "gtts_lang": "kn"
    }
]

def run_whisper_language_tests():
    print("=" * 80)
    print("🎙️ GROQ WHISPER-LARGE-V3 MULTI-LANGUAGE VOICE TRANSCRIPTION TEST")
    print("=" * 80)

    # 1. Start a visit first to get a valid visit_id & question_id
    start_res = requests.post(f"{BASE_URL}/interview/start", json={
        "chief_complaint": "Chest pain",
        "patient_name": "Voice Test Patient",
        "language": "English"
    })
    if start_res.status_code != 200:
        print("x Failed to start visit session:", start_res.text)
        return

    start_data = start_res.json()
    visit_id = start_data["visit_id"]
    question_id = start_data["question_id"]
    print(f"✓ Started test intake visit #{visit_id} for question '{question_id}'\n")

    results = []

    for case in TEST_CASES:
        lang_code = case["lang_code"]
        lang_name = case["lang_name"]
        phrase = case["phrase"]

        print("-" * 60)
        print(f"🗣️ Testing Language: {lang_name} (code: '{lang_code}')")
        print(f"  Input Original Phrase: \"{phrase}\"")

        # Generate audio using gTTS
        mp3_buffer = io.BytesIO()
        try:
            tts = gTTS(text=phrase, lang=case["gtts_lang"], slow=False)
            tts.write_to_fp(mp3_buffer)
            mp3_buffer.seek(0)
        except Exception as e:
            print(f"  x Failed to generate audio sample via gTTS: {e}")
            continue

        # Send audio clip to /interview/answer-voice
        files = {
            "file": (f"test_speech_{lang_code}.mp3", mp3_buffer, "audio/mpeg")
        }
        data = {
            "visit_id": visit_id,
            "question_id": question_id,
            "language": lang_code
        }

        try:
            res = requests.post(f"{BASE_URL}/interview/answer-voice", data=data, files=files)
            if res.status_code != 200:
                print(f"  x API Error ({res.status_code}): {res.text}")
                continue

            res_json = res.json()
            transcript = res_json.get("transcript", "").strip()

            print(f"  📝 Returned Transcript: \"{transcript}\"")

            # Check reliability
            is_empty = len(transcript) == 0
            is_garbled = len(transcript) < 3
            
            # Evaluate Kannada reliability specifically
            status_flag = "RELIABLE"
            if is_empty or is_garbled:
                status_flag = "UNRELIABLE (empty/garbled)"
            elif lang_code == "kn":
                # Check if Kannada contains script or readable Kannada words
                has_kannada_script = any('\u0C80' <= char <= '\u0CFF' for char in transcript)
                if not has_kannada_script:
                    status_flag = "UNRELIABLE (Kannada script missing / wrong language detected)"

            print(f"  📊 Evaluation Status: {status_flag}")

            results.append({
                "language": lang_name,
                "code": lang_code,
                "original": phrase,
                "transcript": transcript,
                "reliability": status_flag
            })

        except Exception as e:
            print(f"  x Request Exception: {e}")

    print("\n" + "=" * 80)
    print("📋 SUMMARY REPORT — GROQ WHISPER-LARGE-V3 ACCURACY Across 3 LANGUAGES")
    print("=" * 80)
    for r in results:
        print(f"Language: {r['language']} ({r['code']})")
        print(f"  Original   : {r['original']}")
        print(f"  Transcribed: {r['transcript']}")
        print(f"  Reliability: {r['reliability']}")
        print("-" * 50)

if __name__ == "__main__":
    run_whisper_language_tests()
