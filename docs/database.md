# Database

PostgreSQL 16. Migrations are plain SQL in `backend/migrations/NNNN_name.{up,down}.sql`, embedded in the API binary and applied in order inside transactions (advisory-locked, tracked in `schema_migrations`). `api migrate` applies them; the server also applies them on start unless `API_AUTO_MIGRATE=false`. `*.down.sql` files are provided for manual rollback (`psql -f`), not auto-run.

| Table | Purpose / notes |
|---|---|
| `users` | `email CITEXT UNIQUE`, Argon2id `password_hash`, `display_name` |
| `sessions` | stores **SHA-256 of the token** (raw token only in the cookie), per-session `csrf_token`, `expires_at`; `ON DELETE CASCADE` from users |
| `password_resets` | hashed single-use tokens with expiry |
| `project_assets` | `owner_id`, unique `storage_key`, `mime_type` (CHECK png/jpeg/webp), `file_size > 0`, `width/height > 0`. **No image bytes in the DB.** |
| `collections` | optional folders (`UNIQUE(owner_id,name)`); schema is ready, no API/UI yet |
| `projects` | `owner_id` FK (cascade), `project_type` CHECK, `document_json JSONB` (`{docs:[…], assets:{imgKey: assetId}}`), `preview_asset_id` (SET NULL), indexes on `(owner_id, updated_at DESC)` and `(owner_id, project_type)` |
| `templates` | server-side catalogue seeded from the frontend (`api seed-templates`) |
| `user_preferences` | one row per user |

Not created: `processing_jobs` — AI processing is synchronous and bounded, so there is no job table to maintain.

Ownership rules: every project/asset query includes `owner_id = <session user>`; foreign keys cascade on user deletion; deleting a project does not delete its assets immediately — unreferenced assets older than 24 h are purged hourly by the API's janitor (see `docs/privacy.md`).
