import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from ml.train import split_data, train


@pytest.fixture(scope="session")
def artifacts(tmp_path_factory):
    directory = tmp_path_factory.mktemp("artifacts")
    train(directory)
    return directory


@pytest.fixture
def client(artifacts):
    with TestClient(create_app(artifacts)) as test_client:
        yield test_client


def test_quality_gate_and_metadata(artifacts):
    metadata = json.loads((artifacts / "metadata.json").read_text())
    assert metadata["test_accuracy"] >= 0.93
    assert metadata["train_samples"] + metadata["test_samples"] == 1797
    assert sum(map(sum, metadata["confusion_matrix"])) == metadata["test_samples"]


def test_failed_quality_gate_preserves_existing_artifact(artifacts):
    previous = (artifacts / "model.joblib").read_bytes()
    with pytest.raises(ValueError, match="Quality gate failed"):
        train(artifacts, c=1e-10, minimum_accuracy=1.0)
    assert (artifacts / "model.joblib").read_bytes() == previous


def test_full_holdout_api_matches_offline_evaluation(client):
    _, x_test, _, y_test = split_data()
    predictions = [
        client.post("/predict", json={"pixels": row.tolist()}).json()["digit"] for row in x_test
    ]
    assert (
        np.mean(np.asarray(predictions) == y_test) == client.get("/model").json()["test_accuracy"]
    )


def test_prediction_contract(client):
    sample = client.get("/samples").json()[3]
    response = client.post("/predict", json={"pixels": sample["pixels"]})
    result = response.json()
    assert response.status_code == 200
    assert result["digit"] == sample["label"]
    assert len(result["probabilities"]) == 10
    assert sum(result["probabilities"]) == pytest.approx(1)
    assert result["model_version"] == client.get("/health").json()["model_version"]


@pytest.mark.parametrize(
    "payload",
    [
        {"pixels": [0] * 63},
        {"pixels": [0] * 65},
        {"pixels": [-1] * 64},
        {"pixels": [17] * 64},
        {"pixels": ["3"] * 64},
        {"pixels": [True] * 64},
        {"pixels": [0] * 64, "secret": "no"},
        {},
        {"pixels": [None] * 64},
    ],
)
def test_invalid_inputs_are_rejected_and_counted(client, payload):
    assert client.post("/predict", json=payload).status_code == 422
    stats = client.get("/stats").json()
    assert stats["requests"] == stats["errors"] == 1
    assert stats["predictions"] == 0


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity"])
def test_nonfinite_inputs_return_valid_json_errors(client, value):
    payload = '{"pixels": [' + ",".join([value] * 64) + "]}"
    response = client.post(
        "/predict", content=payload, headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "finite_number"
    assert client.get("/stats").json()["errors"] == 1


def test_monitoring_detects_shift_and_recovers(client):
    samples = client.get("/samples").json()
    for i in range(30):
        pixels = [min(16, value + 8) for value in samples[i % 10]["pixels"]]
        assert client.post("/predict", json={"pixels": pixels}).status_code == 200
    assert client.get("/stats").json()["input_shift_alert"] is True
    for i in range(100):
        client.post("/predict", json={"pixels": samples[i % 10]["pixels"]})
    stats = client.get("/stats").json()
    assert stats["input_shift_alert"] is False
    assert stats["window_size"] == 100
    assert stats["requests"] == sum(stats["prediction_counts"]) == 130
    assert "soda_predictions_total" in client.get("/metrics").text


def test_static_ui_and_readiness(client):
    assert "SoDA Digit Lab" in client.get("/").text
    assert client.get("/static/app.js").status_code == 200
    assert client.get("/health").json()["status"] == "ready"
    # Polling and documentation must not inflate prediction request counters.
    assert client.get("/stats").json()["requests"] == 0


def test_corrupted_artifact_fails_startup(artifacts, tmp_path):
    (tmp_path / "metadata.json").write_bytes((artifacts / "metadata.json").read_bytes())
    (tmp_path / "model.joblib").write_bytes(b"corrupted")
    with pytest.raises(RuntimeError, match="Model unavailable"):
        with TestClient(create_app(tmp_path)):
            pass


def test_missing_artifact_fails_startup(tmp_path):
    with pytest.raises(RuntimeError, match="python -m ml.train"):
        with TestClient(create_app(tmp_path)):
            pass
