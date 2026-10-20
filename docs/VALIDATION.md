# Verification record

## October 20 exercise walkthrough checks

- **23 API/model tests passed**, including request/response/header ID correlation, exact invalid-pixel location, rejection before inference, bounded history, retained errors after successful traffic, and safe JSON for malformed/nonfinite inputs.
- **Notebook and lint passed:** all cells executed in a fresh kernel; `ruff check .` passed.
- **Live scripts passed:** smoke and traffic commands print original/sent terminal images, actual JSON bodies, complete responses, known-label comparisons, and `/stats`.
- **Browser checks passed in Edge:** the existing drawing regression suite plus CLI-to-dashboard error correlation, invalid-pixel rendering, actual brighter-image/JSON equality, real prediction comparisons for all ten samples, inspecting retained errors after the recent request window fills, and mobile layout without overflow or JavaScript exceptions.
- **Observed drift example:** 9 of 10 distinct brighter teaching examples were misclassified, all with HTTP 200. These repeated samples illustrate a failure; they are not an independent estimate of model accuracy. Original drawing regression fixtures still pass.
- Dashboard screenshots were visually checked at desktop and mobile sizes. The request inspector displays pixel arrays in rows of eight while retaining valid JSON.

The [Codespaces environment run for the preceding setup fix](https://github.com/asusoda/MLops-workshop/actions/runs/39345713311) passed, including the dev container build/start and API checks. Local Docker remains unavailable; the new exercise changes require their own remote CI run after push. No Render deployment was created.

## Original local checks

Checked locally on October 17, 2026 with Python 3.12 on Windows.

- **20 tests passed:** quality gate, failed-candidate protection, full held-out serving parity, prediction contract, invalid/nonfinite inputs, input-shift detection and recovery, readiness, static resources, and missing/corrupt artifacts.
- **Notebook passed:** every cell executed from a fresh kernel without altering the saved teaching notebook.
- **Lint passed:** `ruff check .`.
- **Live smoke passed:** readiness, correct sample prediction, model version, invalid-input rejection, and request accounting.
- **Browser flow passed:** sample selection and prediction, normal traffic, shifted-input alert, invalid input, desktop and mobile layout, and no JavaScript exceptions during those exercises.
- **Drawing regression:** reproduced all ten small drawings predicting 4 with the original canvas conversion. Cropping, horizontal ink centering, area averaging, and the revised nonlinear classifier correctly classify 30 hand-authored drawings (0–9 at three sizes/positions). These fixtures informed the fix and are not a general handwriting accuracy estimate.
- **Browser regression suite passed:** `BROWSER_CHANNEL=msedge npm run test:browser` also verified the blank-input guard, preview/payload equality, sample pixels bypassing drawing conversion, clearing a sample before drawing, and mobile drawings of 1, 6, and 7. No JavaScript exceptions or mobile horizontal overflow. Linux Chromium execution is configured in CI but has not been run here.
- **Measured revised model:** 357 correct predictions out of 360 examples in the existing test split, or 99.17%. Seed 42, SVC C=10.0, 1,437 training examples. Both offline evaluation and serving use the highest-probability class. The reused split is a regression benchmark after model selection, not a fresh independent evaluation.

Docker Desktop's Linux engine was unavailable locally. The container build and Codespaces setup were not executed in this session, and no Render deployment was created. The GitHub Actions workflow is configured to build the Docker image and run the smoke check on Linux after the repository is pushed. A workflow file is not evidence of a successful remote CI run.

Before presenting, run the fresh-Codespace and hosted-deployment rehearsal in `PRESENTER.md`. Hosting behavior, network access, dependency resolution, and account quota can differ from this local environment.

## October 19 startup recovery check

The startup script was exercised locally through Git Bash with a fresh Python 3.12 virtual environment that had no `joblib` and a separate repository copy with no model artifacts. It installed the requirements, trained the model, started the API, and passed the live smoke check (readiness, prediction, model version, validation, and monitoring). CI now repeats the empty-environment startup check on Linux. The updated dev container waits for `postCreateCommand` before attaching.

The previous [Test and package run](https://github.com/asusoda/MLops-workshop/actions/runs/39072003731) succeeded for commit `cda9930`, including the Docker build, container smoke check, and Linux browser tests. That supersedes the earlier local-only container limitation above; it does not verify the user's Codespace setup logs or a hosted Render deployment.
