#!/usr/bin/env bash
# Preflight: catches the class of bug where a third-party import works
# locally (satisfied by requirements-dev.txt's extras, already installed in
# the dev venv) but is missing from requirements.txt — the only file
# Vercel's build installs from. A build can still report "Ready" despite
# this, since it never imports the app (see the httpx incident, 2026-11-19).
#
# Builds a throwaway venv from requirements.txt ALONE (no dev extras) and:
#   1. imports app.main — catches a module-scope import gap (the httpx bug).
#   2. imports every third-party package found behind a function-scope
#      (deferred) import anywhere under app/ or api/ — catches the same
#      class of bug for a package that's never reached at module-load time
#      (e.g. anthropic, stream_chat, pywebpush, resend are all deferred this
#      way to avoid circular imports), which (1) alone can't see: that code
#      path would boot clean and only fail on a live request that happens
#      to hit it. The package list is derived from the code
#      (scripts/_find_deferred_imports.py), not hardcoded here, so a new
#      deferred import is covered automatically.
#
# The venv is cached, keyed on a hash of requirements.txt, at
# .preflight-cache/<hash>/venv — kept in `verify`'s normal path (rather than
# split into a separate predeploy-only script) specifically so it can't be
# skipped for being slow: an unchanged requirements.txt reuses the cached
# venv and skips straight to the (sub-second) import checks; only an actual
# dependency change pays for a fresh `pip install`. Only one hash's venv is
# kept at a time — a stale one from a previous requirements.txt is removed
# before building the new one, so this can't grow unbounded.
set -euo pipefail

cd "$(dirname "$0")/.."  # backend/

REQ_HASH="$(shasum -a 256 requirements.txt | cut -d' ' -f1)"
CACHE_ROOT=".preflight-cache"
VENV_DIR="$CACHE_ROOT/$REQ_HASH/venv"
VENV_PY="$VENV_DIR/bin/python"

if [ -x "$VENV_PY" ]; then
  echo "--- using cached venv for requirements.txt@$REQ_HASH ---"
else
  echo "--- requirements.txt changed (or no cache yet) — building venv for @$REQ_HASH ---"
  rm -rf "$CACHE_ROOT"  # single-slot cache: drop any stale hash's venv first
  mkdir -p "$(dirname "$VENV_DIR")"
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --quiet --upgrade pip
  "$VENV_DIR/bin/pip" install --quiet -r requirements.txt
fi

echo "--- module-scope: import app.main ---"
"$VENV_PY" -c "import app.main"
echo "check_prod_imports: app.main imports cleanly from requirements.txt alone."

echo "--- function-scope (deferred) imports ---"
DEFERRED="$(python3 scripts/_find_deferred_imports.py app api)"

if [ -z "$DEFERRED" ]; then
  echo "check_prod_imports: no deferred third-party imports found."
  exit 0
fi

ERR_DIR="$(mktemp -d)"
trap 'rm -rf "$ERR_DIR"' EXIT

failed=0
while IFS=$'\t' read -r root files; do
  [ -z "$root" ] && continue
  err_file="$ERR_DIR/err_$root.txt"
  if "$VENV_PY" -c "import $root" >"$err_file" 2>&1; then
    echo "  OK    $root"
  else
    echo "  FAIL  $root — referenced (function-scope) in: $files"
    sed 's/^/        /' "$err_file"
    failed=1
  fi
done <<<"$DEFERRED"

if [ "$failed" -ne 0 ]; then
  echo "check_prod_imports: one or more deferred (function-scope) imports are missing from requirements.txt." >&2
  exit 1
fi

echo "check_prod_imports: all deferred third-party imports resolve from requirements.txt alone."
