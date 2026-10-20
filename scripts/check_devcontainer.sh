#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# This check runs INSIDE the configured dev container, after its lifecycle hooks.
# Check their result before start.sh has a chance to repair missing dependencies.
python -c 'import sys, joblib; assert sys.version_info[:2] == (3, 12); print("Python 3.12 and joblib ready")'
test -s artifacts/model.joblib
for attempt in {1..30}; do
  if docker info >/dev/null 2>&1; then break; fi
  sleep 1
done
docker info --format '{{.ServerVersion}}'

startup_log=$(mktemp)
PORT=8011 bash scripts/start.sh > "$startup_log" 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; cat "$startup_log"; rm -f "$startup_log"' EXIT
for attempt in {1..60}; do
  if curl -fsS http://localhost:8011/health >/dev/null; then break; fi
  if ! kill -0 "$server_pid" 2>/dev/null; then exit 1; fi
  sleep 2
done
python scripts/smoke.py --url http://localhost:8011
