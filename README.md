# Spree

This system was built end-to-end by `Lyte952` for `Elyte101`.

Spree is a Next.js storefront with a FastAPI backend for catalog, auth, cart, profile, notifications, and admin product management.

## Stack

- Next.js 16
- React 19
- MUI
- FastAPI
- SQLAlchemy
- PostgreSQL for local docker setup

## Frontend

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example`.

For local full-stack work, start both servers together:

```bash
npm run dev:full
```

This runs the Next.js frontend and the FastAPI backend expected by
`BACKEND_API_URL=http://127.0.0.1:8000/api/v1`.

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Create `backend/.env` from `backend/.env.example`.

The local seeded admin account is:

```text
Email: admin@spree.local
Password: ChangeMe123!
```

## Production Deploy

Spree is production-ready to deploy as two Vercel projects from the same GitHub repository:

- Frontend project: repository root (`/`)
- Backend project: [`backend`](/Users/lyte/Spree/spree/backend)

Frontend Vercel environment variables:

```text
BACKEND_API_URL=https://your-backend-domain/api/v1
BACKEND_INTERNAL_API_KEY=<same-value-as-backend-internal-api-key>
NEXTAUTH_URL=https://your-frontend-domain
NEXTAUTH_SECRET=<long-random-secret>
```

You can also set `BACKEND_URL=https://your-backend-domain` instead of `BACKEND_API_URL`.

Backend Vercel environment variables:

```text
ENVIRONMENT=production
DATABASE_URL=<managed-postgres-url>
CORS_ORIGINS=["https://your-frontend-domain"]
SEED_ADMIN_NAME=<admin-name>
SEED_ADMIN_EMAIL=<admin-email>
SEED_ADMIN_PASSWORD=<admin-password>
INTERNAL_API_KEY=<long-random-secret>
AUTO_INITIALIZE_DATABASE=true
LOG_LEVEL=INFO
```

Notes:

- `backend/server.py` is the Vercel entrypoint for the FastAPI app.
- If `DATABASE_URL` is omitted on Vercel, the backend falls back to an ephemeral SQLite database in `/tmp`. That is useful for previews, not persistent production data.
- On deployed environments, admin auto-seeding only runs when all `SEED_ADMIN_*` values are explicitly configured.
- `CORS_ORIGINS` accepts either a JSON array or a comma-separated list.

## Local Infrastructure

```bash
docker compose up -d
```

## Verification

```bash
npm run verify
```

Or run the checks individually:

```bash
npm run lint
npm run typecheck
npm run build
cd backend && ./.venv/bin/pytest
```

## CI/CD

GitHub Actions now runs:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `backend` `pytest`

Once both Vercel projects are connected to the repository, every push triggers Vercel deployments and GitHub will show the deployment URLs alongside the CI checks.
