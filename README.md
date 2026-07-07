# Spree

This system was built end-to-end by `Lyte952` for `Elyte101`.

Spree is a Next.js storefront with a FastAPI backend for catalog, auth, cart, profile, notifications, and admin product management.

## Stack

- Next.js 16
- React 19
- MUI
- FastAPI
- SQLAlchemy
- SQLite (local dev) / PostgreSQL (production)

## Local development

Both servers must be running for the full stack to work. Start them in two terminals (or use `npm run dev:full` to run both together in one terminal).

### Quick start (two terminals)

**Terminal 1 — FastAPI backend (port 8000)**

```bash
# First time only: create the virtualenv and install deps
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Copy env and start
cp .env.example .env            # edit if needed — defaults work for local dev
.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend auto-creates `backend/data/spree_store.db` and seeds the admin account on first start. Verify it is ready:

```bash
curl http://127.0.0.1:8000/healthz   # → {"status":"ok","environment":"development"}
curl http://127.0.0.1:8000/readyz    # → {"status":"ready"}
```

**Terminal 2 — Next.js frontend (port 3000)**

```bash
# From the repo root
npm install
cp .env.example .env.local           # already configured for local dev
npm run dev
```

### One-liner (both servers together)

```bash
npm run dev:full
```

### Environment variables (frontend — `.env.local`)

| Variable | Default | Description |
|---|---|---|
| `BACKEND_API_URL` | `http://127.0.0.1:8000/api/v1` | FastAPI base URL (must match the port uvicorn binds) |
| `BACKEND_INTERNAL_API_KEY` | `spree-internal-dev-key` | Must match `INTERNAL_API_KEY` in `backend/.env` |
| `NEXTAUTH_URL` | `http://localhost:3000` | Frontend origin — do not change for local dev |
| `NEXTAUTH_SECRET` | _(set in file)_ | Any random string for local dev |

### Seeded admin account

```text
Email:    admin@spree.local
Password: ChangeMe123!
```

### Schema migrations

The backend uses SQLAlchemy `create_all` — tables are created automatically on startup. There are no migration files. If the local database is stale after a model change, delete it and restart:

```bash
rm backend/data/spree_store.db
# then restart the backend — it will recreate the DB and re-seed the admin account
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
TRUSTED_HOSTS=["your-backend-domain.vercel.app","your-custom-backend-domain.com"]
ENABLE_API_DOCS=false
SEED_ADMIN_NAME=<admin-name>
SEED_ADMIN_EMAIL=<admin-email>
SEED_ADMIN_PASSWORD=<admin-password>
INTERNAL_API_KEY=<long-random-secret>
AUTO_INITIALIZE_DATABASE=true
LOG_LEVEL=INFO
```

Notes:

- `backend/server.py` is the Vercel entrypoint for the FastAPI app.
- `DATABASE_URL` is required in deployed environments so production never silently runs on ephemeral state.
- Common `postgres://` and `postgresql://` URLs are normalized for the `psycopg` SQLAlchemy driver.
- On deployed environments, admin auto-seeding only runs when all `SEED_ADMIN_*` values are explicitly configured.
- `CORS_ORIGINS` accepts either a JSON array or a comma-separated list.
- `/healthz` is a lightweight uptime probe; `/readyz` verifies database connectivity.

## Chat setup

Spree uses [Stream Chat](https://getstream.io/chat/) for buyer–support conversations and an Anthropic Claude Haiku auto-reply bot.

### 1. Create a Stream app

1. Sign up at [dashboard.getstream.io](https://dashboard.getstream.io).
2. Create a new app. Note the **API Key** and **API Secret**.
3. Under **Chat** → **Channel Types**, create a channel type named **`support`**.
4. Under **Webhooks**, add a webhook pointing to `https://your-backend-domain/webhooks/stream`.
   Copy the **Signing Secret** shown in the dashboard.

### 2. Set environment variables

**Frontend (`.env.local`):**

```text
NEXT_PUBLIC_STREAM_API_KEY=<your stream api key>
```

**Backend (`backend/.env`):**

```text
STREAM_API_KEY=<your stream api key>
STREAM_API_SECRET=<your stream api secret>
STREAM_ADMIN_USER_ID=spree-admin          # shared admin identity
STREAM_WEBHOOK_SECRET=<signing secret from dashboard>
ANTHROPIC_API_KEY=sk-ant-...              # for auto-reply bot
```

### 3. How it works

- Each buyer gets a personal `support-{userId}` channel shared with `spree-admin`.
- The `ChatWidget` FAB connects eagerly on login so the unread badge updates in real time.
- Admins access all conversations at `/dashboard/chat`.
- When a buyer sends a message, the webhook fires, Claude Haiku generates a reply (rate-limited to 1 per 20 s per channel, 20 per hour), and an in-app + email notification is sent to the buyer.

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
