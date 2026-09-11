import os
import wave
import struct
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=api_key)

# Generate a 1-second silent WAV file for API testing
wav_filename = "test_audio.wav"
with wave.open(wav_filename, "wb") as wav_file:
    wav_file.setnchannels(1)       # Mono
    wav_file.setsampwidth(2)      # 16-bit
    wav_file.setframerate(16000)   # 16kHz
    for _ in range(16000):
        wav_file.writeframes(struct.pack("<h", 0))

print("Created test silent audio file.")

try:
    with open(wav_filename, "rb") as audio_file:
        transcription = client.audio.transcriptions.create(
            file=(wav_filename, audio_file.read()),
            model="whisper-large-v3",
            language="en",
            response_format="json"
        )
    print("✓ Groq Whisper API Call Succeeded!")
    print("Result:", transcription)
except Exception as e:
    print("x Groq Whisper API Error:", e)

if os.path.exists(wav_filename):
    os.remove(wav_filename)
