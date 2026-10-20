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


def test_error_explanation_correlates_with_journal_and_does_not_run_model(client):
    sample = client.get("/samples").json()[0]
    pixels = [99, *sample["pixels"][1:]]
    response = client.post("/predict", json={"pixels": pixels})
    body = response.json()
    assert response.status_code == 422
    assert body["model_ran"] is False
    assert body["detail"] == [{"loc": ["body", "pixels", 0]}]
    assert response.headers["x-request-id"] == body["request_id"]
    history = client.get("/requests").json()
    entry = history["errors"][0]
    assert entry == history["requests"][0]
    assert entry["request"] == {"pixels": pixels}
    assert entry["response"] == body
    assert entry["request_id"] == body["request_id"]
    stats = client.get("/stats").json()
    assert stats["requests"] == stats["errors"] == 1
    assert stats["predictions"] == stats["window_size"] == 0


def test_journal_is_bounded_and_errors_survive_normal_traffic(client):
    for _ in range(25):
        client.post("/predict", json={"pixels": [99] * 64})
    first_error = client.get("/requests").json()["errors"][0]
    for _ in range(55):
        client.post("/predict", json={"pixels": [0] * 64})
    history = client.get("/requests").json()
    assert len(history["requests"]) == 50
    assert len(history["errors"]) == 20
    assert history["errors"][0] == first_error
    assert all(entry["status"] == 200 for entry in history["requests"])
    assert len({entry["request_id"] for entry in history["requests"]}) == 50
    assert client.get("/stats").json()["requests"] == 80


def test_journal_summarizes_malformed_payloads_without_retaining_extra_values(client):
    client.post("/predict", json={"pixels": [0] * 70, "token": "not-for-the-log"})
    entry = client.get("/requests").json()["requests"][0]
    assert len(entry["request"]["pixels"]) == 64
    assert entry["request"]["received_pixel_count"] == 70
    assert "not-for-the-log" not in json.dumps(entry)
    response = client.post(
        "/predict", content=b'{"pixels":', headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422
    assert client.get("/requests").json()["errors"][0]["response"]["model_ran"] is False


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
    assert response.json()["detail"] == [
        {"loc": ["body", "pixels", index]} for index in range(64)
    ]
    assert len(client.get("/requests").json()["errors"]) == 1
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
