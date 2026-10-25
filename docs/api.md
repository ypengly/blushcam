# API (v1)

Base path `/api/v1` (browser uses the same-origin proxy). JSON in/out. Errors always look like:

```json
{ "error": { "code": "validation_failed", "message": "…", "fields": { "email": "…" } } }
```

Auth is a session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` when `COOKIE_SECURE=true`). **Unsafe methods on authenticated routes require the `X-CSRF-Token` header** (returned by login/register/me) and, if an `Origin` header is present, it must be an allowed origin.

| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /auth/register` | – (rate limited) | `{email, password, displayName?}` | `201 {user, csrfToken}` + cookie | `422` field errors (weak password, duplicate email), `429` |
| `POST /auth/login` | – (rate limited) | `{email, password}` | `200 {user, csrfToken}` + cookie | `401 invalid_credentials` (identical for unknown email), `429` |
| `POST /auth/logout` | ✔ + CSRF | – | `204`, session deleted server-side | `401`, `403` |
| `GET /auth/me` | ✔ | – | `200 {user, csrfToken}` | `401` |
| `POST /auth/forgot-password` | – (rate limited) | `{email}` | `200 {message}` — **same response whether or not the account exists**; email sent only if SMTP is configured | `429` |
| `POST /auth/reset-password` | – (rate limited) | `{token, password}` | `200`; single-use token; all sessions revoked | `400 invalid_token`, `422` |
| `PATCH /me` | ✔ + CSRF | `{displayName}` | `200` | `422` |
| `DELETE /me` | ✔ + CSRF | `{password}` | `204`; deletes stored objects, then rows (cascade) | `403 invalid_credentials` |
| `GET/PUT /me/preferences` | ✔ (+CSRF) | `{theme, mirrorPreview, defaultExport, aiConsent}` | `200` | `422` |
| `GET /projects?q=&type=&sort=updated\|created\|name&limit=&offset=` | ✔ | – | `200 {projects:[{id,name,projectType,previewUrl,createdAt,updatedAt}]}` (own projects only) | `422` |
| `POST /projects` | ✔ + CSRF | `{name(1–120), projectType: photo\|booth\|collage\|scrapbook, document:{docs:[…],assets:{}}, previewAssetId?}` | `201` | `422` |
| `GET /projects/{id}` | ✔ owner | – | `200` incl. `document` | `404` (also for other users' ids) |
| `PATCH /projects/{id}` | ✔ owner + CSRF | any of `name`, `document`, `previewAssetId` | `200` | `404`, `422` (type can't change) |
| `DELETE /projects/{id}` | ✔ owner + CSRF | – | `204` | `404` |
| `POST /projects/{id}/duplicate` | ✔ owner + CSRF | – | `201` | `404` |
| `POST /assets` | ✔ + CSRF | multipart `file` (PNG/JPEG/WebP, verified by decoding) | `201 {id,url,width,height,mimeType,fileSize}`; `url` is short-lived | `413`, `422 invalid_image`, `507 quota_exceeded` |
| `GET /assets/{id}` | ✔ owner | – | `200` with fresh signed `url` | `404` |
| `DELETE /assets/{id}` | ✔ owner + CSRF | – | `204` | `404` |
| `GET /files/{key}?exp=&sig=` | signed URL | – | image bytes (`nosniff`, `sandbox` CSP) | `403 bad_signature` (tampered/expired), `404` |
| `GET /templates?kind=&audience=` · `GET /templates/{id}` | – | – | `200` (empty until `seed-templates` is run) | `404` |
| `GET /ai/capabilities` | – | – | `200 {operations:[{operation,label,available,kind,reason,external}], serviceReachable}` | – |
| `POST /ai/process` | ✔ + CSRF, 20/min/user | multipart `file`, `operation`, **`consent=true`**, optional `scale` (2–4), `background` (#RRGGBB) | image bytes | `400 consent_required`, `422`, `501 unavailable`, `503`, `504` |
| `GET /healthz` · `GET /readyz` | – | – | liveness · readiness (DB required; image service reported, optional) | `503` |

**Not exposed:** `POST /exports`. Exports are rendered in the browser (no photo upload); a server endpoint would add nothing but a privacy cost, so it is intentionally absent.

## Image service (internal, not exposed to browsers)

`GET /healthz`, `GET /v1/capabilities`, `POST /v1/{operation}` (multipart `file`, optional `scale`, `background`). Operations: `portrait-enhance`, `lighting-correct`, `cleanup`, `upscale`, `remove-background`, `replace-background`, `blur-background`, `style-transform` (always `501`). Errors: `{ "detail": { "code", "message" } }`.
