#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${PORT:-3000}"

if [ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" ]; then
  echo "Backend virtualenv is missing."
  echo "Run: cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -e '.[dev]'"
  exit 1
fi

cleanup() {
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [ -n "${FRONTEND_PID:-}" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting Spree backend on http://$BACKEND_HOST:$BACKEND_PORT"
(
  cd "$BACKEND_DIR"
  ./.venv/bin/uvicorn app.main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

echo "Starting Spree frontend on http://localhost:$FRONTEND_PORT"
(
  cd "$ROOT_DIR"
  BACKEND_API_URL="${BACKEND_API_URL:-http://$BACKEND_HOST:$BACKEND_PORT/api/v1}" \
    NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:$FRONTEND_PORT}" \
    npx next dev --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done

BACKEND_STATUS=0
FRONTEND_STATUS=0
wait "$BACKEND_PID" 2>/dev/null || BACKEND_STATUS=$?
wait "$FRONTEND_PID" 2>/dev/null || FRONTEND_STATUS=$?

if [ "$BACKEND_STATUS" -ne 0 ]; then
  exit "$BACKEND_STATUS"
fi

exit "$FRONTEND_STATUS"
