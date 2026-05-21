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

For Vercel deployments, [`server.py`](/Users/lyte/Spree/spree/backend/server.py) exports the FastAPI application directly and [`pyproject.toml`](/Users/lyte/Spree/spree/backend/pyproject.toml) points Vercel at that app.

The local development seed also creates an admin account:

```text
Email: admin@spree.local
Password: ChangeMe123!
```

When deployed on Vercel:

- `DATABASE_URL` should point to managed Postgres for persistent data
- `CORS_ORIGINS` can be a JSON array or comma-separated list
- `TRUSTED_HOSTS` should include the backend Vercel domain and any custom domain
- API docs are disabled by default in deployed environments; set `ENABLE_API_DOCS=true` only when you intentionally want them exposed
- `INTERNAL_API_KEY` must be set explicitly
- `SEED_ADMIN_*` must all be set if you want the admin user auto-created
- `DATABASE_URL` is required in deployed environments so production never silently runs on ephemeral state
- `/healthz` confirms the app is alive; `/readyz` confirms the database is reachable

## Verify

```bash
python3 -m compileall app
pytest
```
