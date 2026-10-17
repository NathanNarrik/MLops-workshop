"""A single-process API with deliberately small, inspectable monitoring."""

import hashlib
import json
import logging
import os
import time
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
from typing import Annotated

import joblib
import numpy as np
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Histogram,
    generate_latest,
)
from pydantic import BaseModel, ConfigDict, Field

ROOT = Path(__file__).resolve().parents[1]
LOGGER = logging.getLogger("uvicorn.error")
Pixel = Annotated[float, Field(ge=0, le=16, allow_inf_nan=False, strict=True)]


class PredictionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pixels: list[Pixel] = Field(min_length=64, max_length=64)


def create_app(artifact_dir: Path | None = None) -> FastAPI:
    directory = artifact_dir or Path(os.getenv("MODEL_DIR", str(ROOT / "artifacts")))
    registry = CollectorRegistry()
    requests = Counter(
        "soda_predictions", "Prediction requests by HTTP status", ["status"], registry=registry
    )
    latency = Histogram("soda_prediction_seconds", "Prediction request latency", registry=registry)
    lock = Lock()
    state = {"requests": 0, "errors": 0, "predictions": 0, "low_confidence": 0}
    brightness = deque(maxlen=100)
    latencies = deque(maxlen=100)
    labels = [0] * 10
    started = time.monotonic()

    @asynccontextmanager
    async def lifespan(api: FastAPI):
        try:
            metadata = json.loads((directory / "metadata.json").read_text(encoding="utf-8"))
            data = (directory / "model.joblib").read_bytes()
            if hashlib.sha256(data).hexdigest() != metadata["sha256"]:
                raise ValueError("Model checksum does not match metadata")
            # joblib can execute code. Load only artifacts built by this repository.
            api.state.model = joblib.load(directory / "model.joblib")
            api.state.metadata = metadata
            api.state.samples = json.loads((directory / "samples.json").read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise RuntimeError("Model unavailable. Run: python -m ml.train") from exc
        LOGGER.info(json.dumps({"event": "model_loaded", "version": metadata["model_version"]}))
        yield

    api = FastAPI(title="SoDA Digit Lab", version="1.0.0", lifespan=lifespan)

    @api.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        # Do not echo raw inputs: nonfinite values cannot be encoded in a JSON response.
        details = [{key: error[key] for key in ("loc", "msg", "type")} for error in exc.errors()]
        return JSONResponse(status_code=422, content={"detail": details})

    @api.middleware("http")
    async def record_prediction(request, call_next):
        if request.url.path != "/predict" or request.method != "POST":
            return await call_next(request)
        begin = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            elapsed = time.perf_counter() - begin
            requests.labels(status=str(status)).inc()
            latency.observe(elapsed)
            with lock:
                state["requests"] += 1
                state["errors"] += int(status >= 400)
                latencies.append(elapsed * 1000)
            LOGGER.info(
                json.dumps(
                    {
                        "event": "prediction_request",
                        "status": status,
                        "latency_ms": round(elapsed * 1000, 2),
                    }
                )
            )

    @api.get("/", include_in_schema=False)
    def home():
        return FileResponse(ROOT / "app/static/index.html")

    @api.get("/health")
    def health():
        return {"status": "ready", "model_version": api.state.metadata["model_version"]}

    @api.get("/model")
    def model_info():
        return api.state.metadata

    @api.get("/samples")
    def samples():
        return api.state.samples

    @api.post("/predict")
    def predict(payload: PredictionInput):
        pixels = np.asarray(payload.pixels).reshape(1, -1)
        probabilities = api.state.model.predict_proba(pixels)[0]
        digit = int(api.state.model.classes_[np.argmax(probabilities)])
        confidence = float(probabilities.max())
        with lock:
            state["predictions"] += 1
            state["low_confidence"] += int(confidence < 0.8)
            brightness.append(float(pixels.mean()))
            labels[digit] += 1
        return {
            "digit": digit,
            "confidence": confidence,
            "probabilities": probabilities.tolist(),
            "model_version": api.state.metadata["model_version"],
        }

    @api.get("/stats")
    def stats():
        with lock:
            snapshot = dict(state)
            recent_brightness = list(brightness)
            recent_latency = list(latencies)
            distribution = list(labels)
        meta = api.state.metadata
        mean = float(np.mean(recent_brightness)) if recent_brightness else None
        shift = (
            (
                abs(mean - meta["baseline_brightness_mean"])
                / max(meta["baseline_brightness_std"], 1e-9)
            )
            if mean is not None
            else 0
        )
        return {
            **snapshot,
            "uptime_seconds": round(time.monotonic() - started),
            "error_rate": snapshot["errors"] / max(snapshot["requests"], 1),
            "p95_latency_ms": float(np.percentile(recent_latency, 95)) if recent_latency else 0,
            "prediction_counts": distribution,
            "window_size": len(recent_brightness),
            "window_limit": 100,
            "brightness_mean": mean,
            "baseline_brightness_mean": meta["baseline_brightness_mean"],
            "brightness_shift_std": shift,
            "input_shift_alert": len(recent_brightness) >= 20 and shift > 2,
            "model_version": meta["model_version"],
        }

    @api.get("/metrics", include_in_schema=False)
    def metrics():
        return Response(generate_latest(registry), media_type=CONTENT_TYPE_LATEST)

    api.mount("/static", StaticFiles(directory=ROOT / "app/static"), name="static")
    return api


app = create_app()
