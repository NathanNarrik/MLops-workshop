"""A single-process API with deliberately small, inspectable monitoring."""

import hashlib
import json
import logging
import math
import os
import time
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Annotated
from uuid import uuid4

import joblib
import numpy as np
from fastapi import FastAPI, Request
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
    # Our API contract: one flattened 8x8 image, read left-to-right, top-to-bottom.
    # Reject extra fields (including labels) so only features reach the model.
    model_config = ConfigDict(extra="forbid")
    pixels: list[Pixel] = Field(min_length=64, max_length=64)


def inspect_payload(body):
    """Bound the teaching log; never retain arbitrary extra fields or raw bodies."""
    if not isinstance(body, dict) or not isinstance(body.get("pixels"), list):
        return {"note": "Expected an object containing a pixels array."}
    values = body["pixels"]
    safe = []
    for value in values[:64]:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            safe.append(value if math.isfinite(value) else str(value))
        else:
            safe.append("<invalid pixel type>")
    result = {"pixels": safe}
    if len(values) != 64:
        result["received_pixel_count"] = len(values)
    if len(values) > 64:
        result["note"] = "Preview truncated to 64 pixels."
    if set(body) - {"pixels"}:
        result["extra_fields_omitted"] = True
    return result


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
    journal = deque(maxlen=50)
    errors = deque(maxlen=20)
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
        # FastAPI rejects invalid inputs BEFORE predict() runs. This is an HTTP
        # contract failure, not a wrong model prediction. Keep JSON safe for NaN.
        details = [{key: error[key] for key in ("loc", "msg", "type")} for error in exc.errors()]
        content = {
            "error": "invalid_prediction_input",
            "message": "Request rejected before inference. Check the fields in detail.",
            "detail": details,
            "expected": {"pixels": "Exactly 64 finite numbers, each from 0 through 16."},
            "fix": "Flatten an 8x8 grayscale image row by row; remove extra fields.",
            "model_ran": False,
            "request_id": getattr(request.state, "request_id", None),
        }
        request.state.input_preview = inspect_payload(exc.body)
        request.state.output_preview = content
        return JSONResponse(status_code=422, content=content)

    @api.middleware("http")
    async def record_prediction(request, call_next):
        if request.url.path != "/predict" or request.method != "POST":
            return await call_next(request)
        begin = time.perf_counter()
        request.state.request_id = uuid4().hex
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["X-Request-ID"] = request.state.request_id
            return response
        finally:
            elapsed = time.perf_counter() - begin
            requests.labels(status=str(status)).inc()
            latency.observe(elapsed)
            entry = {
                "request_id": request.state.request_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "method": "POST",
                "path": "/predict",
                "status": status,
                "latency_ms": round(elapsed * 1000, 2),
                "request": getattr(request.state, "input_preview", {}),
                "response": getattr(
                    request.state,
                    "output_preview",
                    {"error": "internal_error", "message": "See the server traceback."},
                ),
            }
            with lock:
                state["requests"] += 1
                state["errors"] += int(status >= 400)
                latencies.append(elapsed * 1000)
                journal.append(entry)
                if status >= 400:
                    errors.append(entry)
            # Same correlation ID in client JSON, response header, dashboard,
            # and terminal. Verbose pixel logging is intentional for this demo.
            LOGGER.info(json.dumps({"event": "prediction_request", **entry}))

    @api.get("/", include_in_schema=False)
    def home():
        return FileResponse(ROOT / "app/static/index.html")

    @api.get("/health")
    def health():
        # GET reads information; readiness lets a host know it can send traffic.
        return {"status": "ready", "model_version": api.state.metadata["model_version"]}

    @api.get("/model")
    def model_info():
        # GET /model: which artifact is running, and how was it evaluated?
        return api.state.metadata

    @api.get("/samples")
    def samples():
        # GET /samples: labeled teaching examples. Labels are never sent to predict.
        return api.state.samples

    @api.post("/predict")
    def predict(payload: PredictionInput, request: Request):
        # POST carries JSON in its body. Pydantic has validated all 64 pixels.
        # Reuse the saved scaler AND classifier; never fit anything in this route.
        request.state.input_preview = payload.model_dump()
        pixels = np.asarray(payload.pixels).reshape(1, -1)
        probabilities = api.state.model.predict_proba(pixels)[0]
        digit = int(api.state.model.classes_[np.argmax(probabilities)])
        confidence = float(probabilities.max())
        with lock:
            state["predictions"] += 1
            state["low_confidence"] += int(confidence < 0.8)
            brightness.append(float(pixels.mean()))
            labels[digit] += 1
        result = {
            "digit": digit,
            "confidence": confidence,
            "probabilities": probabilities.tolist(),
            "model_version": api.state.metadata["model_version"],
            "request_id": request.state.request_id,
        }
        request.state.output_preview = result
        return result

    @api.get("/requests")
    def recent_requests():
        # GET polls our bounded demo log, including requests from traffic.py.
        # These images are public demo data. Do not log real sensitive inputs.
        with lock:
            return {
                "requests": list(reversed(journal)),
                "errors": list(reversed(errors)),
                "request_limit": 50,
                "error_limit": 20,
            }

    @api.get("/stats")
    def stats():
        # GET /stats returns the numbers used by the dashboard. Reading it does
        # not count as a prediction. Counters reset when this process restarts.
        # Brightness drift is a warning about INPUTS; accuracy needs true labels.
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
        # GET /metrics exposes machine-readable Prometheus text, unlike /stats JSON.
        return Response(generate_latest(registry), media_type=CONTENT_TYPE_LATEST)

    api.mount("/static", StaticFiles(directory=ROOT / "app/static"), name="static")
    return api


app = create_app()
