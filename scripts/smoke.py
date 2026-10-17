"""Verify the full contract against a running local or hosted service."""

import argparse
import json
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    base = args.url.rstrip("/")

    def get(path):
        with urllib.request.urlopen(base + path, timeout=60) as response:
            return json.load(response)

    health = get("/health")
    assert health["status"] == "ready"
    sample = get("/samples")[3]
    request = urllib.request.Request(
        base + "/predict",
        data=json.dumps({"pixels": sample["pixels"]}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        prediction = json.load(response)
    assert prediction["digit"] == sample["label"]
    assert prediction["model_version"] == health["model_version"]
    assert abs(sum(prediction["probabilities"]) - 1) < 1e-6
    invalid = urllib.request.Request(
        base + "/predict", data=b'{"pixels": [99]}', headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(invalid, timeout=30)
    except urllib.error.HTTPError as exc:
        assert exc.code == 422
    else:
        raise AssertionError("Invalid input must return 422")
    assert get("/stats")["requests"] >= 2
    print("PASS: readiness, prediction, version, validation, and monitoring")


if __name__ == "__main__":
    main()
