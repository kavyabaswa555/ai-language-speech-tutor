
from pathlib import Path
from uuid import uuid4
import shutil

from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.services.voice_pipeline import (
    answer_from_text,
    transcribe_audio,
    generate_speech,
)


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="LLM Meet Speech Assistant"
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

STATIC_DIR = BASE_DIR / "static"

DATA_DIR = BASE_DIR / "data"
INPUT_DIR = DATA_DIR / "input"
AUDIO_DIR = DATA_DIR / "audio"

INPUT_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# STATIC
# ============================================================

app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_DIR)),
    name="static",
)


# ============================================================
# HOME
# ============================================================

@app.get("/")
async def home():

    return FileResponse(
        STATIC_DIR / "index.html"
    )


# ============================================================
# TEXT MODEL
# ============================================================

class TextRequest(BaseModel):

    text: str


# ============================================================
# TEXT API
# ============================================================

@app.post("/api/text")
async def text_api(request: TextRequest):

    print("=" * 60)
    print("TEXT REQUEST")
    print("TEXT:", request.text)
    print("=" * 60)

    try:

        text = request.text.strip()

        if not text:
            return {
                "success": False,
                "error": "Please enter some text."
            }

        # Gemini answer
        answer = answer_from_text(text)

        print("ANSWER:")
        print(answer)

        # Edge TTS
        print("Generating speech...")

        audio_path = await generate_speech(answer)

        audio_url = f"/audio/{audio_path.name}"

        print("AUDIO URL:")
        print(audio_url)

        return {
            "success": True,
            "transcript": text,
            "answer": answer,
            "audio_url": audio_url,
        }

    except Exception as e:

        print("TEXT ERROR:", repr(e))

        return {
            "success": False,
            "error": str(e),
        }


# ============================================================
# VOICE API
#
# IMPORTANT:
# We intentionally receive Request instead of:
#
# file: UploadFile = File(...)
#
# This prevents FastAPI from returning 422 before
# our function executes.
# ============================================================

@app.post("/api/voice")
async def voice_api(request: Request):

    print("=" * 60)
    print("VOICE REQUEST RECEIVED")
    print("METHOD:", request.method)
    print(
        "CONTENT TYPE:",
        request.headers.get("content-type")
    )
    print("=" * 60)

    try:

        # ----------------------------------------------------
        # Read multipart form
        # ----------------------------------------------------

        form = await request.form()

        print("FORM KEYS:")

        for key in form.keys():
            print(
                "  KEY:",
                key
            )

        # ----------------------------------------------------
        # Find uploaded file
        # ----------------------------------------------------

        uploaded_file = None

        for key, value in form.multi_items():

            print(
                "FORM ITEM:",
                key,
                type(value)
            )

            # UploadFile has filename
            if hasattr(value, "filename"):

                if value.filename:

                    uploaded_file = value

                    print(
                        "FOUND FILE UNDER FIELD:",
                        key
                    )

                    print(
                        "FILENAME:",
                        value.filename
                    )

                    print(
                        "CONTENT TYPE:",
                        value.content_type
                    )

                    break

        # ----------------------------------------------------
        # No file
        # ----------------------------------------------------

        if uploaded_file is None:

            print(
                "NO AUDIO FILE FOUND IN FORM"
            )

            return {
                "success": False,
                "error": (
                    "No audio file received. "
                    "The browser did not send an audio file."
                )
            }

        # ----------------------------------------------------
        # Filename
        # ----------------------------------------------------

        original_name = (
            uploaded_file.filename
            or "question.webm"
        )

        extension = (
            Path(original_name)
            .suffix
            .lower()
        )

        # If browser doesn't provide extension
        if not extension:

            content_type = (
                uploaded_file.content_type
                or ""
            ).lower()

            if "webm" in content_type:
                extension = ".webm"

            elif "ogg" in content_type:
                extension = ".ogg"

            elif "wav" in content_type:
                extension = ".wav"

            elif "mpeg" in content_type:
                extension = ".mp3"

            else:
                extension = ".webm"

        # ----------------------------------------------------
        # Save input
        # ----------------------------------------------------

        input_filename = (
            f"input_{uuid4().hex}{extension}"
        )

        input_path = (
            INPUT_DIR /
            input_filename
        )

        with input_path.open("wb") as buffer:

            shutil.copyfileobj(
                uploaded_file.file,
                buffer
            )

        size = input_path.stat().st_size

        print(
            "SAVED AUDIO:",
            input_path
        )

        print(
            "AUDIO SIZE:",
            size
        )

        # ----------------------------------------------------
        # Validate size
        # ----------------------------------------------------

        if size == 0:

            return {
                "success": False,
                "error": "The recorded audio is empty."
            }

        # ----------------------------------------------------
        # TRANSCRIBE
        # ----------------------------------------------------

        print("=" * 60)
        print("TRANSCRIBING")
        print("=" * 60)

        transcript = transcribe_audio(
            input_path
        )

        print("TRANSCRIPT:")
        print(transcript)

        if not transcript:

            return {
                "success": False,
                "error": "Could not transcribe the recording."
            }

        # ----------------------------------------------------
        # GEMINI ANSWER
        # ----------------------------------------------------

        print("=" * 60)
        print("GENERATING ANSWER")
        print("=" * 60)

        answer = answer_from_text(
            transcript
        )

        print("ANSWER:")
        print(answer)

        # ----------------------------------------------------
        # TEXT TO SPEECH
        # ----------------------------------------------------

        print("=" * 60)
        print("GENERATING VOICE")
        print("=" * 60)

        audio_path = await generate_speech(
            answer
        )

        audio_url = (
            f"/audio/{audio_path.name}"
        )

        print(
            "FINAL AUDIO URL:",
            audio_url
        )

        # ----------------------------------------------------
        # RETURN
        # ----------------------------------------------------

        return {
            "success": True,
            "transcript": transcript,
            "answer": answer,
            "audio_url": audio_url,
        }

    except Exception as e:

        print("=" * 60)
        print("VOICE ERROR")
        print(repr(e))
        print("=" * 60)

        return {
            "success": False,
            "error": str(e),
        }


# ============================================================
# SERVE GENERATED MP3
# ============================================================

@app.get("/audio/{filename}")
async def serve_audio(filename: str):

    audio_path = AUDIO_DIR / filename

    print(
        "SERVING AUDIO:",
        audio_path
    )

    if not audio_path.exists():

        raise HTTPException(
            status_code=404,
            detail="Audio file not found."
        )

    return FileResponse(
        audio_path,
        media_type="audio/mpeg",
        filename=filename,
    )
