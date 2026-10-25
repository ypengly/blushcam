# BlushCam 🌸 — your camera, your aesthetic

A private, in-browser photo studio: live camera, 34 filters, Korean four-cut booth, stickers & text, collage maker, multi-page scrapbook, honest AI tools — with an optional Go + PostgreSQL backend for accounts and cloud projects.

| Part | Tech |
|---|---|
| `frontend/` | Next.js 15 (App Router), React 19, strict TypeScript, Tailwind, Canvas API |
| `backend/` | Go 1.23, chi, pgx, Argon2id, S3-compatible storage |
| `image-service/` | Python 3.12, FastAPI, Pillow, NumPy, OpenCV (optional) |
| infra | PostgreSQL 16, Docker Compose, GitHub Actions CI |

Docs: [architecture](docs/architecture.md) · [API](docs/api.md) · [database](docs/database.md) · [privacy](docs/privacy.md) · [deployment](docs/deployment.md)

## Quick start

**Everything with Docker**
```bash
cp .env.example .env            # set POSTGRES_PASSWORD and STORAGE_SIGNING_SECRET=$(openssl rand -hex 32)
docker compose up --build       # http://localhost:3000
./scripts/seed-templates.sh     # optional (needs Go + Node locally)
```

**Frontend only** (camera, filters, booth, collage, scrapbook, export all work without a backend)
```bash
cd frontend && npm install && npm run dev
```

**Each service separately**
```bash
docker compose up -d db
cd backend && go mod tidy && go run ./cmd/api            # :8080  (/healthz, /readyz)
cd image-service && pip install -r requirements.txt && uvicorn app.main:app --port 8000
cd frontend && npm install && npm run dev                # :3000 (proxies /api/v1 → :8080)
```
Camera needs HTTPS or `localhost`.

## Tests
```bash
cd frontend && npm test                       # Node built-in runner (pure logic)
cd frontend && npm run lint && npm run typecheck && npm run build
cd frontend && npm run test:e2e               # Playwright, fake camera device + synthetic fixtures
cd backend  && go vet ./... && go test ./... -race     # integration tests need TEST_DATABASE_URL
cd image-service && pip install -r requirements-dev.txt && pytest -q
```

## Implemented
* **Camera**: real `getUserMedia`, permission only on click, front/rear + device picker, resolution choice, mirror toggle, 3/5/10 s timer, flash effect, retake/confirm, devicechange recovery, clear errors, visible "camera on", tracks stopped on exit, state machine.
* **Filters**: 34 presets in 7 categories as data; pixel engine (brightness, contrast, saturation, temperature, tint, fade, blur, glow, vignette, grain, light leak, colour wash), strength slider, manual adjustments, hold-to-compare, reset, undo/redo; exports contain the effect.
* **Booth**: 1/2/4/6/9 layouts, 14 frame themes, auto-capture with countdown, retake single/all, extra shots + selection, caption/date/frame colour, upload instead of camera.
* **Editor**: shared canvas editor — stickers (12 collections of original vector art), text, move/resize/rotate, layering, opacity, duplicate, lock, keyboard shortcuts, zoom/fit, mobile bottom sheet, unsaved indicator.
* **Collage**: 10 layouts, aspect ratios, spacing/radius/border/shadow, add/swap photos, layout switching never loses photos.
* **Scrapbook**: 8 templates, paper styles, polaroids/tape/date/caption, multi-page (add/reorder/delete), PNG/JPEG per page, multi-page PDF.
* **Export**: PNG/JPEG/WebP, 1×/2×, custom size, social ratios (fit, never stretch), transparency rules, progress + cancel, hard limits with explicit errors, real download.
* **Accounts**: register/login/logout/me, Argon2id, hashed sessions, CSRF, rate limits, password reset (SMTP optional), preferences, account deletion.
* **Cloud**: projects CRUD/duplicate/search/sort, asset upload with decode validation + quota, signed URLs, owner-scoped queries, gallery (local + cloud), server-side route protection (`middleware.ts`).
* **AI service**: lighting correction, portrait smoothing, cleanup, Lanczos upscale (classical, labelled as such); background remove/replace/blur through a configurable provider; style transfer reported unavailable; capabilities endpoint; consent required.

## Not implemented / needs credentials
* Background removal/replacement/blur need an external provider (`AI_PROVIDER=remove_bg_http` + URL + key). Without it they report *unavailable*.
* Style transformation: not implemented (needs a generative model).
* OAuth login: not implemented (email/password only).
* Password-reset emails need `SMTP_*`.
* Collections/folders: schema exists, no API/UI.
* Light-leak/grain "overlay assets" are procedural (no image textures).

## Known limitations
* Blur/glow filters are CPU box-blur in the main thread (fast enough for previews at screen size; large exports can pause the UI briefly — moving `applyFilterToImageData` into a Web Worker is the next performance step).
* The in-memory rate limiter is per instance.
* WebP export depends on the browser; unsupported browsers get an explicit error instead of a PNG in disguise.
* Live camera filter preview uses CSS filters (approximate); the editor/export use the exact pixel engine.
* No `go.sum` / `package-lock.json` are committed (generated offline-hostile): run `go mod tidy` and `npm install` once and commit them.

## Verification status (what was actually run when this repo was generated)

The generation sandbox had **no network access and no Go toolchain**, so dependency installs, `next build`, Go compilation, Playwright and the FastAPI route tests could **not** be run there. Be aware:

| Check | Result |
|---|---|
| Frontend pure-logic unit tests (filters, editor/history, camera machine, booth/collage/scrapbook builders, stickers, export planning + render, validation) via `node --test` | **# tests 41 # pass 41 # fail 0 ** |
| Strict `tsc` on `lib/` + `features/**/*.ts` | clean |
| `tsc` on all TSX/pages with *stubbed* React/Next/lucide types | clean (checks our own modules and imports; React prop typing is loose under stubs) |
| Python image-service core tests (validation, upscale, lighting, portrait/cleanup, provider/capability honesty, fake-provider background ops) | **21 passed, 0 failed** |
| Template export script (`scripts/export-templates.mts`) | runs, emits 32 templates |
| `npm install`, `next build`, ESLint, Playwright e2e | **not run** |
| Go: `go build`, `go vet`, unit + integration tests (written, incl. auth/CSRF/ownership/upload-security/quota/AI-consent tests) | **not run — expect a few compile fixes on first `go mod tidy && go vet ./...`** |
| Python FastAPI route tests (`tests/test_api.py`) | **not run** (fastapi not installed there) |
| Docker build / compose | **not run** |

Treat the first local run of `npm run build`, `go vet ./...` and `go test ./...` as the real acceptance gate and fix whatever they surface.
