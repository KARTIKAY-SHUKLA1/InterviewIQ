from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import whisper
import tempfile
import os
import traceback

app = FastAPI()

print("Loading Whisper model...")
model = whisper.load_model("base")
print("Whisper model loaded!")

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    try:
        suffix = os.path.splitext(audio.filename)[1] or ".mp3"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await audio.read())
            tmp_path = tmp.name

        result = model.transcribe(tmp_path, word_timestamps=True)
        os.unlink(tmp_path)

        # Build transcript with timestamps
        segments = []
        full_transcript = ""

        for segment in result["segments"]:
            start = segment["start"]
            text = segment["text"].strip()
            minutes = int(start // 60)
            seconds = int(start % 60)
            timestamp = f"{minutes:02d}:{seconds:02d}"
            segments.append({
                "timestamp": timestamp,
                "start_seconds": start,
                "text": text
            })
            full_transcript += f"[{timestamp}] {text} "

        return {
            "transcript": full_transcript.strip(),
            "segments": segments,
            "language": result["language"]
        }
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
