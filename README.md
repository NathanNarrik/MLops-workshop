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
- Docker packages the same application for a hosted deployment.

**Workshop guide:** [student exercises](docs/WORKSHOP.md) · [presenter runbook](docs/PRESENTER.md) · [deployment walkthrough](docs/DEPLOYMENT.md) · [solutions](docs/SOLUTIONS.md)

See [verification results and remaining rehearsal steps](docs/VALIDATION.md) for what has been tested locally.

**Updating an older copy:** if drawings all predict 4, update the repository, stop the server, run `python -m ml.train`, and restart the server. Reload the browser with **Ctrl+Shift+R**. The revised model uses `MinMaxScaler` + a nonlinear `SVC`, and the drawing interface normalizes the ink before inference. `/model` should show `classifier: "SVC"`.

**Slides:** [`slides/SoDA-MLOps-Workshop.pptx`](slides/SoDA-MLOps-Workshop.pptx). Editable PowerPoint with presenter notes, using the supplied SoDA theme. Install Space Grotesk for matching text appearance on another computer.

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
python scripts/traffic.py --mode invalid   # expected 422 responses
```

Run the traffic commands in a second terminal. Add `--url https://YOUR-SERVICE.onrender.com` to target a deployment you control. After the shifted exercise, send `--mode normal --count 100` to replace the whole rolling window.

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
| `docs/` | Student guide, facilitator script, deployment and answers |
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
