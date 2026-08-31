import os
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is missing. Add it to your .env file."
    )

client = genai.Client(
    api_key=GEMINI_API_KEY
)

LLM_MODEL = "gemini-3.6-flash"

TRANSCRIPTION_MODEL = "gemini-3.5-transcribe"

AUDIO_DIR = Path("data/audio")
AUDIO_DIR.mkdir(
    parents=True,
    exist_ok=True
)