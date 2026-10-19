#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
printf '\nChecking workshop dependencies (the first run may take a few minutes)...\n'
# Use the same interpreter for installation, training, and serving. A Codespace
# may have skipped or interrupted postCreateCommand, or switched Python envs.
# pip reuses installed packages when all pinned requirements are satisfied.
python -m pip install --disable-pip-version-check -r requirements-dev.txt
if [ ! -f artifacts/model.joblib ]; then
  python -m ml.train
fi
workshop_port="${PORT:-8000}"
printf '\nSoDA Digit Lab\n'
if [ "${CODESPACES:-false}" = "true" ]; then
  printf 'Open the Ports tab, find port %s, and click Open in Browser.\n' "$workshop_port"
  printf 'If the port is missing, choose Forward a Port and enter %s.\n' "$workshop_port"
else
  printf 'Open in your browser: http://localhost:%s/\n' "$workshop_port"
fi
printf '0.0.0.0 in the server log is a listening address, not the browser URL.\n'
printf 'Keep this terminal running. Wait for Application startup complete.\n\n'
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "$workshop_port"
