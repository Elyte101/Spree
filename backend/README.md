# Spree Backend

FastAPI backend for the Spree storefront. It ships with a SQLite database for local development, seed data for the catalog, and a route structure that matches the frontend's current needs.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

The API starts at `http://127.0.0.1:8000` and exposes the storefront endpoints under `/api/v1`.

## Configuration

Copy `backend/.env.example` to `backend/.env` to override defaults.

The local development seed also creates an admin account:

```text
Email: admin@spree.local
Password: ChangeMe123!
```

## Verify

```bash
python3 -m compileall app
pytest
```
