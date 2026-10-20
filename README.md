# SoDA MLOps Workshop: From Model to Deployment

**You trained a model. Now what?** Build a working digit-recognition app and follow **Train → Package → Deploy → Monitor**.

For ASU students interested in AI/ML and software engineering. Designed for 60 minutes at **7:30 PM Arizona time, PSH 150, ASU Tempe**. Event date, primary owner, and RSVP are TBD.

The first 15 minutes introduce ML and core MLOps concepts for beginners. The live demo and hands-on exercises follow after that foundation.

## Start in GitHub Codespaces

1. Open [asusoda/MLops-workshop](https://github.com/asusoda/MLops-workshop) and select **Code → Codespaces → Create codespace on main**. If you cannot create a Codespace in that repo, fork it first. A GitHub account and available Codespaces quota are required.
2. Wait for the dev container setup to finish. It installs Python dependencies and trains the model automatically.
3. In the terminal, run:

   ```bash
   bash scripts/start.sh
   ```

4. In the **Ports** tab next to the terminal, find **8000** and click its globe icon (**Open in Browser**). If the row is missing, choose **Forward a Port** and enter `8000`. Use that forwarded address, not `http://0.0.0.0:8000` from the server log. Choose a sample, click **Predict digit**, and explore the monitoring section.
5. Open [`notebooks/01_train.ipynb`](notebooks/01_train.ipynb). Choose the Python 3.12 kernel and run the cells.

No GPU, API key, database, or external dataset download is needed after dependency setup. The small digits dataset ships with scikit-learn. Keep the terminal running. After restarting a Codespace, run `bash scripts/start.sh` again.

The startup script checks and installs the pinned Python dependencies before training or serving. Its first run may take a few minutes; subsequent runs reuse installed packages. This also recovers from an incomplete Codespaces setup.

If an older checkout fails with `ModuleNotFoundError: No module named 'joblib'` (or another dependency), run:

```bash
git pull --ff-only
bash scripts/start.sh
```

You can also repair the current environment directly with `python -m pip install -r requirements-dev.txt`. Use `python -m pip` so installation targets the same interpreter that runs the app. Wait for **Application startup complete**, then open port **8000** in the **Ports** tab.

### Codespace says it is in recovery mode

In the recovery terminal, run `git pull --ff-only`. Then press **Ctrl+Shift+P**, choose **Codespaces: Rebuild Container** (or **Dev Containers: Rebuild Container** in desktop VS Code), and wait for setup to finish. Run `bash scripts/start.sh` after it reopens.

The original Python base image contained an unused Yarn apt repository with a missing signing key (`NO_PUBKEY 62D54FD4003F6525`). That broke installation of the Docker feature before Python setup could run. `.devcontainer/Dockerfile` removes the unused repository before Features install. Rebuilding is required to leave the recovery container; installing packages in that temporary container does not repair the build. The **Codespaces environment** workflow builds and starts the same dev container configuration, checks Python and Docker, and exercises the API.

## The demo

- Draw a digit or select a real held-out example.
- Drawings are cropped, centered, and averaged into 8 × 8 pixels. The preview shows the exact image sent to the model.
- A FastAPI endpoint validates 64 pixel values, then calls a fitted sklearn pipeline.
- Each response includes a digit, class scores, and the model version.
- Live counters show prediction requests, error rate, recent p95 latency, and low scores.
- Brighter inputs trigger a simple monitoring heuristic. Invalid inputs produce HTTP 422.
- The request inspector shows the sent image, JSON body, HTTP response, latency, and request ID, including calls from terminal scripts. A separate error log explains validation failures.
- The data drift gallery pairs original and brighter images with actual predictions. It highlights wrong answers that still returned HTTP 200.
- Docker packages the same application for a hosted deployment.

**Workshop guide:** [student exercises](docs/WORKSHOP.md) · [presenter runbook](docs/PRESENTER.md) · [deployment walkthrough](docs/DEPLOYMENT.md)

See [verification results and remaining rehearsal steps](docs/VALIDATION.md) for what has been tested locally.

**Updating an older copy:** if drawings all predict 4, update the repository, stop the server, run `python -m ml.train`, and restart the server. Reload the browser with **Ctrl+Shift+R**. The revised model uses `MinMaxScaler` + a nonlinear `SVC`, and the drawing interface normalizes the ink before inference. `/model` should show `classifier: "SVC"`.

**Slides:** [`slides/SoDA-MLOps-Workshop.pptx`](slides/SoDA-MLOps-Workshop.pptx). Editable PowerPoint with presenter notes, using the supplied SoDA theme. Install Space Grotesk for matching text appearance on another computer.

## Workshop demo flow

Follow this sequence after the beginner concept slides. Start the app using the Codespaces instructions above, choose a held-out digit, and click **Predict digit**. Compare its known label with the prediction, then try your own handwriting.

Keep the server running in the first terminal. Run the exercise commands in a **second terminal**, from the repository root.

### Exercise 1: your model artifact — Train

Run the training notebook, then run the same repeatable training process from the terminal:

```bash
python -m ml.train
```

Open `artifacts/metadata.json` and investigate:

1. Find `test_accuracy`. How many examples were used to evaluate the model?
2. Find `model_version` and the `input` contract. What shape and pixel values does the model expect?
3. Explain why training accuracy alone is not enough to decide whether a model is ready to use.

**Checkpoint:** `artifacts/` contains `model.joblib`, `metadata.json`, and `samples.json`. Explain what each file contributes to the application. The model artifact includes both the fitted preprocessing and classifier.

The running API loads its artifact only at startup. After training, stop the server in the first terminal with **Ctrl+C**, run `bash scripts/start.sh` again, and refresh the app. Compare the version shown by the app with the metadata.

### Exercise 2: an invalid request — Package and serve

Open `app/main.py` and locate `PredictionInput` and `POST /predict`. First verify a valid prediction and the service contract:

```bash
python scripts/smoke.py
```

The smoke check also sends an invalid input, so note the current counters before the next command. Now inspect one deliberately invalid request:

```bash
python scripts/traffic.py --mode invalid --count 1
```

1. Compare the original and sent images in the terminal. Read the actual JSON body: which pixel breaks the input contract?
2. Read the HTTP status and response. Find the field location in `detail`, the explanation, `model_ran`, and `request_id`.
3. In the dashboard, open **Inspect a real request** and **Error log**. Match the request ID to the terminal output and inspect the image and JSON together.
4. Check the dashboard error rate and compare `requests`, `errors`, and `predictions` in `/stats`. Explain whether the model ran.

To read `/stats`, click **Stats JSON** in the app header or append `/stats` to your forwarded Codespaces URL. From the second terminal:

```bash
curl -s http://localhost:8000/stats | python -m json.tool
```

**Checkpoint:** The invalid request returns **HTTP 422**. Explain which input rule it violated and why rejected inputs never reach prediction. Reading `/stats` does not add a prediction request.

### Deployment demo — Deploy

Follow the instructor's [deployment walkthrough](docs/DEPLOYMENT.md). Inspect how the Docker image packages the model and API, then open the hosted app and its `/health` endpoint. Explain how this hosted URL differs from a Codespaces forwarded port.

After the instructor shares the deployed URL, verify it from the second terminal, replacing the placeholder:

```bash
python scripts/smoke.py --url https://YOUR-SERVICE.onrender.com
```

Return to your own Codespaces app for the monitoring exercise so your counters reflect your own traffic.

### Exercise 3: what does the alert prove? — Monitor

Send normal inputs first, then brighter inputs:

```bash
python scripts/traffic.py --mode normal --count 30
python scripts/traffic.py --mode shifted --count 30
```

You can also use the dashboard's **Send 30 normal samples** and **Send 30 brighter samples** buttons. Watch the brightness check, model scores, and **Data drift: the inputs changed** gallery.

This simulates **data drift** caused by a camera exposure change: add 8 to each pixel, capped at 16. The known digit label stays the same, but the input distribution changes. Compare each original image with the actual brighter image sent to the API, its predicted digit, and its known label. Click **Inspect request** to see the corresponding JSON and response.

Discuss what the evidence tells you:

1. Does **HTTP 200** mean the predicted digit is correct?
2. Does an input-shift alert prove accuracy dropped?
3. Which true labels would you need to measure prediction quality?

The gallery uses known labels for ten repeated teaching examples; its results are not a fresh accuracy benchmark. The brightness alert is a signal to investigate, and does not measure accuracy itself.

Replace the entire 100-prediction monitoring window with normal inputs:

```bash
python scripts/traffic.py --mode normal --count 100
```

**Checkpoint:** Observe the brightness alert clear. Explain the difference between a failed HTTP request, an incorrect prediction, and a change in input data. Keep the server running during recovery: restarting would erase the monitoring history.

**Wrap-up:** Trace one prediction from image → JSON request → validation → saved pipeline → response → monitoring. Identify where each of the three exercises fits in **Train → Package → Deploy → Monitor**.

## Run locally

Use Python **3.12**. From the repo root:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m ml.train
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

On Windows, activate with `.venv\Scripts\Activate.ps1` instead. Visit `http://localhost:8000`. The API loads its artifact once at startup. Restart it after retraining.

`0.0.0.0` means “listen on all network interfaces”; it is not a browser destination. For local development, open `http://localhost:8000` or `http://127.0.0.1:8000`. In Codespaces, use **Ports → 8000 → Open in Browser**, because the server runs on the remote Codespace. Keep the server terminal running and wait for `Application startup complete` before opening the page.

## Commands worth knowing

```bash
python -m ml.train                         # evaluate and package
python -m pytest -q                        # meaningful model and API checks
ruff check .                              # Python lint
python scripts/smoke.py                    # verify a running service
python scripts/traffic.py --mode normal    # 30 valid requests
python scripts/traffic.py --mode shifted   # 30 brighter inputs
python scripts/traffic.py --mode invalid --count 1 # inspect a rejected image + JSON
curl -s http://localhost:8000/stats | python -m json.tool # monitoring JSON
```

Run the traffic commands in a second terminal. Add `--url https://YOUR-SERVICE.onrender.com` to target a deployment you control. After the shifted exercise, send `--mode normal --count 100` to replace the whole rolling window.

Each script prints the original/sent images as terminal pixel art, the actual request JSON, and the full response. For full visual images, use the dashboard inspector and drift gallery. Click **Stats JSON** in the header, or append `/stats` to your app's forwarded Codespaces URL. `/requests` returns the latest 50 request records and 20 errors; both logs and metrics reset on restart. These logs intentionally contain public demo pixels; do not use this logging pattern for sensitive production inputs.

Browser regression checks are optional for workshop attendees and run in CI. With the service running and Node.js 22+ installed:

```bash
npm ci
npx playwright install chromium
npm run test:browser
```

These checks draw all ten digits at different sizes and positions, submit the real canvas payload, verify predictions and the pixel preview, and check the mobile layout. They use hand-authored regression fixtures, not an independent handwriting benchmark. Set `APP_URL` to test another server you control, or `BROWSER_CHANNEL=msedge` to use an installed Edge browser.

## Package with Docker

```bash
docker build -t soda-digit-lab:workshop .
docker run --rm --name soda-digit-lab -p 8001:8000 soda-digit-lab:workshop
python scripts/smoke.py --url http://localhost:8001
```

Port 8001 lets the container run beside the development server on 8000. The builder stage trains and evaluates the model. The runtime stage contains the packaged artifact and serves it as a non-root user. Training never happens during an API request. In a larger system, training and image promotion would be separate jobs.

## Repository map

| Path | Purpose |
|---|---|
| `notebooks/01_train.ipynb` | Explore data, train, evaluate, package |
| `ml/train.py` | Reproducible training, quality gate, versioned metadata |
| `app/main.py` | Validation, prediction, health and monitoring endpoints |
| `app/static/` | Drawing interface and live dashboard |
| `tests/` | Model quality, serving parity, validation and monitoring checks |
| `.devcontainer/` | Codespaces environment |
| `Dockerfile`, `render.yaml` | Deployable container and Render Blueprint |
| `.github/workflows/ci.yml` | Lint, tests, container build and smoke check |
| `docs/` | Student guide, presenter runbook, deployment and verification |
| `slides/` | Deck, editable slide content and authoring source |
| `event/` | Event artwork and announcement copy with honest TBD fields |

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /` | Workshop app |
| `GET /docs` | Interactive OpenAPI documentation |
| `POST /predict` | `{ "pixels": [64 numbers in 0..16] }` |
| `GET /health` | Readiness and loaded model version |
| `GET /model` | Evaluation, input contract and provenance |
| `GET /samples` | Ten held-out teaching examples |
| `GET /stats` | Dashboard snapshot |
| `GET /metrics` | Prometheus text exposition |

## What this teaches, and its limits

This is a workshop-scale deployment, not a complete production platform. The holdout score measures this dataset and split, not arbitrary handwriting. Class scores are not validated probabilities for arbitrary user handwriting. The brightness check can miss many kinds of drift and does not establish model degradation. Live accuracy requires labels.

Metrics are bounded, in memory, and **per process**. Run **one worker** for this demo. Restarts and redeploys reset metrics. Production deployments need persistent telemetry, authentication where appropriate, request limits, alert routing, and a controlled model release process. `joblib` artifacts can execute code: only load artifacts generated by trusted training code. The checksum detects mismatches, not a malicious author changing both files.

Direct dependencies are pinned for the workshop. They are not a full transitive lock or a claim of long-term reproducibility. Rehearse a fresh build before the event, then avoid dependency changes during the session. No real student data or uploaded files are needed.

Theme assets come from the supplied SoDA presentation. Dataset attribution and technical references are in [docs/SOURCES.md](docs/SOURCES.md).
