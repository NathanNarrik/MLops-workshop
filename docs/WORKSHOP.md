# Your 60-minute lab

You will turn a small handwritten-digit model into an API that another person can use.

## 0–15 minutes: What MLOps means

Start with the concept slides before using the app. No ML experience is assumed.

A **model** learns a pattern from examples. **Training** fits that model, and **inference** uses it to predict a new answer. **MLOps** covers the practices around building, releasing, and maintaining the resulting application.

You will learn why teams record code, data, and model versions, organize work into repeatable pipelines, expose predictions through APIs, and monitor the running system. You will also distinguish service health from prediction quality and learn why changed inputs can require investigation.

**Discuss:** The app returns the wrong digit in 50 milliseconds. What evidence would you inspect before deciding what went wrong?

**Checkpoint:** Explain training versus inference and give one reason a saved model file is not a complete application.

## 15–18 minutes: A working app

Open the instructor's app, choose a digit example, and predict it. Try your own handwriting. Discuss: if the prediction is wrong, is that automatically a server bug?

Look at **What the model sees**. The browser crops empty space, centers the ink, and averages it into 64 pixels. This step is part of the application: shrinking the entire canvas originally caused every small test drawing to be predicted as 4. A working API and a strong dataset score did not catch that failure. Tests now draw on the actual canvas.

Open your Codespace and start the server with `bash scripts/start.sh`. Keep this terminal open. In **Ports**, find **8000** and click the globe icon (**Open in Browser**). If the row is missing, choose **Forward a Port** and enter `8000`. The server log may show `0.0.0.0:8000`; that is a listening address, not the page to open. If setup is still running, pair with a neighbor until it finishes.

**Checkpoint:** You can see the app and a model version.

## 18–27 minutes: Train

Open `notebooks/01_train.ipynb`. Select the Python 3.12 kernel. Run the cells in order.

The data contains 1,797 images, each 8 × 8 pixels. Pixel values range from 0 to 16. The training script fixes the split seed and uses a stratified 80/20 split. `MinMaxScaler` fits on the training portion inside the pipeline.

**Exercise 1:** Find `test_accuracy` and `test_samples` in `artifacts/metadata.json`. Explain why an accuracy measured on training examples would be misleading.

**Checkpoint:** `python -m ml.train` creates `model.joblib`, `metadata.json`, and `samples.json`.

## 27–36 minutes: Package

Open `app/main.py`. Find `PredictionInput` and the `/predict` route. The API contract is exactly 64 finite numbers from 0 through 16, flattened row by row.

Open `/docs` in the app and inspect the request schema. Then use a second terminal:

```bash
python scripts/smoke.py
python scripts/traffic.py --mode invalid --count 1
```

**Exercise 2:** Explain the 422 response. Did the model run? Check the dashboard error rate and prediction count in `/stats`.

Run `python -m pytest -q`. The tests compare every held-out example through the API with the offline evaluation. This catches mismatched training and serving preprocessing.

**Checkpoint:** A valid request succeeds, an invalid request fails, and you can identify the running model version.

## 36–46 minutes: Deploy

Follow the instructor's deployment. They connect this repository to Render and run its Docker service. Students do not need a Render account for the core workshop.

While the deployment builds, inspect the `Dockerfile`. Find where it trains and where it serves. Why train during the build instead of during each prediction?

Optional, if Docker is ready in your Codespace:

```bash
docker build -t soda-digit-lab:workshop .
docker run --rm -p 8001:8000 soda-digit-lab:workshop
```

In another terminal:

```bash
python scripts/smoke.py --url http://localhost:8001
```

**Checkpoint:** You can explain the difference between a Codespaces forwarded port and a separately hosted service. Use the hosted URL after the instructor shares it.

## 46–55 minutes: Monitor

In your own app, click **Send 30 normal samples**, then **Send 30 brighter samples**. Watch the brightness check and model scores.

**Exercise 3:** Does a successful HTTP response prove the model is right? Does a brightness alert prove accuracy decreased? What labels would you need to answer that?

Restore the input window:

```bash
python scripts/traffic.py --mode normal --count 100
```

**Checkpoint:** The input-shift alert clears after the recent window returns to normal.

## 55–60 minutes: Explain your system

Tell a neighbor what happens between clicking **Predict** and seeing a digit. Include the request schema, fitted preprocessing, model artifact, response, and monitoring.

Optional after the workshop: train a candidate with `python -m ml.train --c 0.1 --output artifacts/candidate`. Compare it with the baseline. Keep the test set as an evaluation set, rather than repeatedly tuning against it. Introduce a validation split before systematic tuning.

Stop unused Codespaces after the workshop. Remove the shared demo service when the event is finished if it is no longer needed.
