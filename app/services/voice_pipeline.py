from pathlib import Path
from uuid import uuid4
import asyncio
import os
import time

from dotenv import load_dotenv
from google import genai
import edge_tts


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is missing. Add it to your .env file."
    )


# ============================================================
# GEMINI CLIENT
# ============================================================

client = genai.Client(
    api_key=GEMINI_API_KEY
)


# ============================================================
# MODELS
# ============================================================

LLM_MODEL = "gemini-3.6-flash"
TRANSCRIPTION_MODEL = "gemini-3.5-transcribe"


# ============================================================
# DIRECTORIES
# ============================================================

AUDIO_DIR = Path("data/audio")
AUDIO_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
You are a helpful AI voice assistant for college students.

Answer clearly and naturally.

Keep answers concise enough to be comfortable when spoken aloud.

Avoid unnecessary markdown, tables, and complicated formatting.

Give practical and easy-to-understand answers.
"""


# ============================================================
# TEXT -> GEMINI -> TEXT
# ============================================================

def answer_from_text(user_text: str) -> str:

    if not user_text or not user_text.strip():
        raise ValueError("User text is empty.")

    response = client.models.generate_content(
        model=LLM_MODEL,
        contents=[
            SYSTEM_PROMPT,
            user_text.strip()
        ]
    )

    if not response.text:
        raise RuntimeError(
            "Gemini returned an empty response."
        )

    return response.text.strip()


# ============================================================
# WAIT FOR GEMINI FILE
# ============================================================

def wait_for_file(uploaded_file):

    max_wait_seconds = 60
    start_time = time.time()

    current_file = uploaded_file

    while True:

        state = current_file.state

        state_name = getattr(
            state,
            "name",
            str(state)
        )

        state_name = str(state_name).upper()

        print(
            f"Gemini file state: {state_name}"
        )

        if state_name == "ACTIVE":
            return current_file

        if state_name in [
            "FAILED",
            "PROCESSING_FAILED"
        ]:

            error = getattr(
                current_file,
                "error",
                None
            )

            raise RuntimeError(
                "Gemini failed to process audio: "
                f"{error}"
            )

        if time.time() - start_time > max_wait_seconds:

            raise RuntimeError(
                "Gemini audio processing timed out."
            )

        time.sleep(2)

        current_file = client.files.get(
            name=current_file.name
        )


# ============================================================
# AUDIO -> TEXT
# ============================================================

def transcribe_audio(audio_path: Path) -> str:

    if not audio_path.exists():
        raise FileNotFoundError(
            f"Audio file does not exist: {audio_path}"
        )

    print(
        f"Uploading audio: {audio_path}"
    )

    suffix = audio_path.suffix.lower()

    if suffix == ".webm":
        mime_type = "audio/webm"

    elif suffix == ".ogg":
        mime_type = "audio/ogg"

    elif suffix == ".wav":
        mime_type = "audio/wav"

    elif suffix == ".mp3":
        mime_type = "audio/mpeg"

    elif suffix == ".m4a":
        mime_type = "audio/mp4"

    else:
        raise ValueError(
            f"Unsupported audio format: {suffix}"
        )

    print(
        f"Using MIME type: {mime_type}"
    )

    audio_file = client.files.upload(
        file=str(audio_path),
        config={
            "mime_type": mime_type
        }
    )

    print(
        f"Uploaded Gemini file: {audio_file.name}"
    )

    audio_file = wait_for_file(
        audio_file
    )

    print(
        "Audio file is ACTIVE."
    )

    interaction = client.interactions.create(
        model=TRANSCRIPTION_MODEL,
        input=[
            {
                "type": "audio",
                "uri": audio_file.uri,
                "mime_type": mime_type
            }
        ]
    )

    transcript = (
        interaction.output_text
        if interaction.output_text
        else ""
    )

    transcript = transcript.strip()

    if not transcript:
        raise RuntimeError(
            "Gemini returned an empty transcript."
        )

    print(
        f"Transcript: {transcript}"
    )

    return transcript


# ============================================================
# TEXT -> SPEECH
# ============================================================

async def _generate_speech(
    text: str,
    output_path: Path
):

    communicator = edge_tts.Communicate(
        text=text,
        voice="en-US-AriaNeural"
    )

    await communicator.save(
        str(output_path)
    )


# ============================================================
# GENERATE SPEECH
# ============================================================

async def generate_speech(
    text: str
) -> Path:

    if not text or not text.strip():
        raise ValueError(
            "Text for speech is empty."
        )

    output_path = (
        AUDIO_DIR /
        f"response_{uuid4().hex}.mp3"
    )

    await _generate_speech(
        text,
        output_path
    )

    if not output_path.exists():
        raise RuntimeError(
            "Text-to-speech failed: audio file was not created."
        )

    if output_path.stat().st_size == 0:
        raise RuntimeError(
            "Text-to-speech created an empty audio file."
        )

    print(
        f"Audio created: {output_path}"
    )

    print(
        f"Audio size: {output_path.stat().st_size} bytes"
    )

    return output_path