# Verification record

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
