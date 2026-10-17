# Exercise answers

## 1. Training and evaluation

`artifacts/metadata.json` records accuracy, train/test counts, random seed, hyperparameters, package versions, input shape, training-code hash, and model hash. The held-out test set contains 360 examples. A training score can reward memorization and does not estimate performance on unseen examples. The scaler fits only on training data because it lives inside the fitted pipeline.

Changing `C` creates another candidate. Compare on a validation split when tuning repeatedly, then use the untouched test set for the final evaluation. The fixed seed makes this workshop repeatable but does not prove robustness across all data distributions.

## 2. The input contract

`PredictionInput` rejects wrong lengths, nonnumeric values, booleans, nonfinite values, values outside 0–16, and unexpected fields. FastAPI returns HTTP 422 before the prediction function runs. The request/error counter increases, but successful predictions and brightness-window counts do not. Do not fix an invalid input by simply removing validation.

The preprocessing pipeline must travel with the estimator. The serving-parity test runs the whole holdout through the API and checks that it matches offline accuracy.

## 3. Monitoring

HTTP success means a request completed, not that the answer was correct. The brighter-input exercise adds eight to every pixel, capped at sixteen, shifting the input distribution while preserving the schema. The alert compares average brightness across up to 100 recent valid predictions to training-image brightness. It requires at least 20 predictions and a shift greater than two training standard deviations.

This teaching heuristic can raise a useful question, but it neither proves accuracy fell nor catches every kind of drift. Measuring production accuracy requires trusted labels aligned to the predictions, often arriving later. A high model score can also be wrong. A green health endpoint means the service has loaded its artifact, not that every prediction is accurate.

Recovery: send 100 normal samples to replace the rolling window. Restarting also resets it, but discards the evidence rather than demonstrating recovery.
