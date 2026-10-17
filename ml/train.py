"""Train, evaluate, and package one reproducible sklearn pipeline."""

import argparse
import hashlib
import json
import platform
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.datasets import load_digits
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import MinMaxScaler
from sklearn.svm import SVC

ROOT = Path(__file__).resolve().parents[1]
SEED = 42


def split_data():
    data = load_digits()
    return train_test_split(
        data.data, data.target, test_size=0.2, random_state=SEED, stratify=data.target
    )


def train(output: Path, c: float = 10.0, minimum_accuracy: float = 0.93):
    x_train, x_test, y_train, y_test = split_data()
    model = make_pipeline(
        MinMaxScaler(), SVC(C=c, kernel="rbf", probability=True, random_state=SEED)
    )
    model.fit(x_train, y_train)
    # Serve and evaluate the same rule. SVC.predict() can disagree with the
    # highest probability, so evaluate the scores actually returned by the API.
    predictions = model.classes_[model.predict_proba(x_test).argmax(axis=1)]
    accuracy = float(accuracy_score(y_test, predictions))
    # A failed quality gate never replaces the previous artifact.
    if accuracy < minimum_accuracy:
        raise ValueError(f"Quality gate failed: {accuracy:.3f} < {minimum_accuracy:.3f}")
    output.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output / "model.joblib")
    digest = hashlib.sha256((output / "model.joblib").read_bytes()).hexdigest()
    metadata = {
        "model_version": f"digits-{digest[:12]}",
        "sha256": digest,
        "dataset": "scikit-learn load_digits (UCI Optical Recognition of Handwritten Digits)",
        "seed": SEED,
        "train_samples": len(x_train),
        "test_samples": len(x_test),
        "test_accuracy": accuracy,
        "minimum_accuracy": minimum_accuracy,
        "confusion_matrix": confusion_matrix(y_test, predictions).tolist(),
        "classifier": "SVC",
        "preprocessing": "MinMaxScaler fitted on training data",
        "decision_rule": "argmax(predict_proba)",
        "hyperparameters": {"C": c, "kernel": "rbf", "gamma": "scale", "probability": True},
        "python_version": platform.python_version(),
        "sklearn_version": sklearn.__version__,
        "numpy_version": np.__version__,
        "training_code_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "input": {"shape": [8, 8], "flatten": "row-major", "min": 0, "max": 16},
        "baseline_brightness_mean": float(x_train.mean(axis=1).mean()),
        "baseline_brightness_std": float(x_train.mean(axis=1).std()),
    }
    (output / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    # Real held-out examples make the demo repeatable. No private data is involved.
    samples = []
    for digit in range(10):
        index = int(np.flatnonzero(y_test == digit)[0])
        samples.append({"label": digit, "pixels": x_test[index].astype(int).tolist()})
    (output / "samples.json").write_text(json.dumps(samples), encoding="utf-8")
    print(f"Held-out accuracy: {accuracy:.2%} ({len(x_test)} examples)")
    print(f"Packaged {metadata['model_version']} in {output}")
    return metadata


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts")
    parser.add_argument("--c", type=float, default=10.0)
    parser.add_argument("--minimum-accuracy", type=float, default=0.93)
    args = parser.parse_args()
    if args.c <= 0 or not 0 <= args.minimum_accuracy <= 1:
        parser.error("C must be positive and minimum accuracy must be between 0 and 1")
    train(args.output, args.c, args.minimum_accuracy)
