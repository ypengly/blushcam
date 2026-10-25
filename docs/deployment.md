# Deployment

## Docker Compose (single host)
```bash
cp .env.example .env
# REQUIRED edits: POSTGRES_PASSWORD, STORAGE_SIGNING_SECRET (openssl rand -hex 32)
docker compose up --build
./scripts/seed-templates.sh      # optional: publish templates to the DB
```
Web: http://localhost:3000 · API: :8080 · Image service: :8000 · Postgres: :5432.

## Production checklist
1. **HTTPS everywhere** (reverse proxy such as Caddy/nginx/Cloudflare). Camera access *requires* a secure context except on `localhost`.
2. `APP_ENV=production`, `COOKIE_SECURE=true` (the API refuses to start otherwise), `PUBLIC_APP_URL=https://your.domain`, `CORS_ALLOWED_ORIGINS=https://your.domain`.
3. Expose only the **web** service publicly. The API and image service should be reachable only from the web container/private network (the web app proxies `/api/v1/*`). Set `API_INTERNAL_URL` for the web service if the API host differs from `http://localhost:8080`.
4. If you run behind a proxy that sets `X-Forwarded-For`, make sure it *overwrites* any client-supplied value (the rate limiter trusts it). For >1 API instance use a shared rate limiter at the proxy.
5. Storage: `STORAGE_PROVIDER=s3` with `S3_*` variables (R2/MinIO/S3/Spaces). Keep the bucket **private**; the API issues short-lived presigned URLs. Local disk (`/data` volume) is fine for a single node.
6. Email: set `SMTP_*`. Without it, password-reset emails are **not sent** (the API says so in logs; in development the link is logged).
7. Secrets: supply via your platform's secret store, never commit `.env`. Rotate `STORAGE_SIGNING_SECRET` to invalidate outstanding links.
8. Backups: schedule `pg_dump` and snapshot the object store.
9. Run `go mod tidy` once and commit `go.sum`; commit `package-lock.json` so CI `npm ci` is reproducible.
10. AI: leave `AI_PROVIDER=none` unless you have a provider; set `AI_PROVIDER=remove_bg_http`, `AI_PROVIDER_URL`, `AI_PROVIDER_API_KEY` to enable background tools and update the privacy page.

## Security headers
The web app sets CSP (self-only scripts/connect, `frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (camera=self), HSTS. Review the CSP if you add analytics/CDNs. The API sets `nosniff`, `frame-ancestors 'none'` and returns images with `Content-Security-Policy: sandbox`.
