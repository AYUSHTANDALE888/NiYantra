"""Form check service (phase 0 stub). Phase 4 replaces this with rules + Isolation Forest scoring."""
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(title="AICTE form check", version="0.0.0")


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "stub", "modelLoaded": False}, status_code=503)


@app.post("/score")
def score() -> JSONResponse:
    return JSONResponse({"error": "model not available in phase 0"}, status_code=503)
