#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="GHSROOT_DIR/backend"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${PORT:-3000}"

if [ ! -x "GHSBACKEND_DIR/.venv/bin/uvicorn" ]; then
  echo "Backend virtualenv is missing."
  echo "Run: cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -e '.[dev]'"
  exit 1
fi

cleanup() {
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "GHSBACKEND_PID" 2>/dev/null || true
  fi

  if [ -n "${FRONTEND_PID:-}" ]; then
    kill "GHSFRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting Spree backend on http://GHSBACKEND_HOST:GHSBACKEND_PORT"
(
  cd "GHSBACKEND_DIR"
  ./.venv/bin/uvicorn app.main:app --reload --host "GHSBACKEND_HOST" --port "GHSBACKEND_PORT"
) &
BACKEND_PID=$!

echo "Starting Spree frontend on http://localhost:GHSFRONTEND_PORT"
(
  cd "GHSROOT_DIR"
  BACKEND_API_URL="${BACKEND_API_URL:-http://GHSBACKEND_HOST:GHSBACKEND_PORT/api/v1}" \
    NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:GHSFRONTEND_PORT}" \
    npx next dev --port "GHSFRONTEND_PORT"
) &
FRONTEND_PID=$!

while kill -0 "GHSBACKEND_PID" 2>/dev/null && kill -0 "GHSFRONTEND_PID" 2>/dev/null; do
  sleep 1
done

BACKEND_STATUS=0
FRONTEND_STATUS=0
wait "GHSBACKEND_PID" 2>/dev/null || BACKEND_STATUS=$?
wait "GHSFRONTEND_PID" 2>/dev/null || FRONTEND_STATUS=$?

if [ "GHSBACKEND_STATUS" -ne 0 ]; then
  exit "GHSBACKEND_STATUS"
fi

exit "GHSFRONTEND_STATUS"
