#!/usr/bin/env bash
# Local development without Docker for the app processes (Postgres via compose).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { cp .env.example .env; echo "Created .env — set STORAGE_SIGNING_SECRET (openssl rand -hex 32) and POSTGRES_PASSWORD, then re-run."; exit 1; }
set -a; . ./.env; set +a
docker compose up -d db
( cd image-service && python3 -m venv .venv >/dev/null 2>&1; . .venv/bin/activate; pip install -q -r requirements.txt; exec uvicorn app.main:app --port 8000 ) &
( cd backend && go run ./cmd/api ) &
( cd frontend && npm install && npm run dev ) &
wait
