# Architecture

```
Browser (Next.js app, TypeScript)
 ├─ camera (getUserMedia) → state machine → Blob
 ├─ editor document model (Doc/Layer) + history (undo/redo)
 ├─ filter engine (pure pixel math)        ← same code path for preview AND export
 ├─ canvas renderer → export (PNG/JPEG/WebP, PDF for scrapbooks)
 └─ local persistence: IndexedDB (guest projects) · /api/v1 (same-origin proxy) for account features
        │
        ▼  Next.js rewrites /api/v1/* → Go API (first-party cookie, no CORS in the browser)
Go API (chi + pgx)
 ├─ auth (Argon2id, opaque session tokens hashed in DB, CSRF token + Origin check)
 ├─ projects / assets / templates / preferences  (every query is owner-scoped in SQL)
 ├─ storage: local disk | S3-compatible, HMAC / presigned short-lived URLs
 └─ imageclient ──► Python FastAPI image service (optional)
PostgreSQL 16 (migrations embedded in the API binary)
```

## Key decisions

* **One document model for every editor.** Photo, booth, collage and scrapbook are all a `Doc` (`frontend/lib/editor/model.ts`): background, a global filter state and an ordered list of `photo | sticker | text | shape` layers in a fixed coordinate space. Booth/collage/scrapbook are *builders* that produce layers; the editor, history, renderer and exporter are shared. A `Project` is `docs[]` (1 page, or many for scrapbooks).
* **Preview == export.** `renderDoc` draws a Doc at any scale. The editor calls it with the on-screen scale; the exporter calls it with the output scale. Layer coordinates are multiplied by the same factor, so positions match (covered by tests). Filters run per photo layer on pixels at the final size, so exported files really contain the effect; CSS filters are only used for thumbnails / live camera preview.
* **Local first.** Camera, filters, stickers, collage, booth, scrapbook and export need no server. Guest projects live in IndexedDB. Photos are uploaded only on an explicit "Save to account" confirmation or an AI request with a consent checkbox.
* **Honest AI.** The Go API asks the Python service what it can *actually* do (`/v1/capabilities`). Classical operations (lighting, portrait smoothing, cleanup, Lanczos upscale) run locally on the server; background operations need a configured external provider; style transfer is reported as unavailable. If the service is down, everything is reported unavailable — never faked.
* **Security boundaries.** Authorization lives in SQL (`WHERE owner_id = $user`), so a missing handler check can't leak data; cross-user access returns 404. Upload bytes are decoded and pixel-capped before being stored. Storage keys are server-generated and flat.
* **No empty enterprise packages.** Every Go package has one job: `config`, `httpx` (middleware/errors), `auth` (crypto), `validation`, `store` (SQL), `storage`, `imageclient`, `mail`, `handlers`.

## Camera state machine

`idle → requesting → ready → (countdown →) capturing → reviewing → ready`, with `error` reachable from anywhere and `STOP` returning to `idle`. Illegal events are ignored (unit-tested). Tracks are stopped on unmount, on STOP, and before re-requesting a stream.

## Frontend layout

`app/` routes · `features/{camera,filters,photo-booth,stickers,collage,scrapbook,editor,gallery,auth,ai-studio}` · `lib/` (model, renderer, export, API, blobs) · `hooks/` · `components/`.
Pure logic is written in erasable TypeScript so it is unit-tested with Node's built-in runner, no bundler required.

## Limits (documented, enforced)

| Where | Limit |
|---|---|
| Browser input image | 25 MB, 48 MP, PNG/JPEG/WebP only (decoded, not trusted by extension) |
| Export | ≤ 8192 px per side and ≤ 36 MP; larger requests are *refused*, never silently downscaled |
| API JSON body | `MAX_BODY_BYTES` (1 MiB) |
| API upload | `MAX_UPLOAD_BYTES` (15 MiB), `IMAGE_MAX_PIXELS` (40 MP), per-user quota `USER_QUOTA_BYTES` (500 MiB) |
| Image service | `IMAGE_MAX_BYTES`, `IMAGE_MAX_PIXELS`, `IMAGE_MAX_OUTPUT_PIXELS`, timeout, 2 concurrent jobs |
| Auth endpoints | `AUTH_RATE_PER_MINUTE` per IP (in-memory; put a shared limiter in front when running >1 instance) |
