# Spree

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

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Create `backend/.env` from `backend/.env.example`.

## Local Infrastructure

```bash
docker compose up -d
```

## Verification

```bash
npm run lint
npm run typecheck
npm run build
cd backend && ./.venv/bin/pytest
```
