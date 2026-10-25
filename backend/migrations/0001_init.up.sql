CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the SHA-256 of the session token is stored; the raw token lives in the cookie.
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  BYTEA NOT NULL UNIQUE,
  csrf_token  TEXT NOT NULL,
  user_agent  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

CREATE TABLE password_resets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);
CREATE INDEX password_resets_user_idx ON password_resets(user_id);

CREATE TABLE project_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type   TEXT NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
  file_size   BIGINT NOT NULL CHECK (file_size > 0),
  width       INT NOT NULL CHECK (width > 0),
  height      INT NOT NULL CHECK (height > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_assets_owner_idx ON project_assets(owner_id);

CREATE TABLE collections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);

CREATE TABLE projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id    UUID REFERENCES collections(id) ON DELETE SET NULL,
  name             TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  project_type     TEXT NOT NULL CHECK (project_type IN ('photo','booth','collage','scrapbook')),
  document_json    JSONB NOT NULL,
  preview_asset_id UUID REFERENCES project_assets(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_owner_updated_idx ON projects(owner_id, updated_at DESC);
CREATE INDEX projects_owner_type_idx ON projects(owner_id, project_type);

CREATE TABLE templates (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('photo','booth','collage','scrapbook')),
  category      TEXT NOT NULL,
  name          TEXT NOT NULL,
  audience      TEXT NOT NULL DEFAULT 'everyone' CHECK (audience IN ('everyone','solo','friends','couple','family')),
  document_json JSONB NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0
);
CREATE INDEX templates_kind_idx ON templates(kind, category);

CREATE TABLE user_preferences (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme           TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark')),
  mirror_preview  BOOLEAN NOT NULL DEFAULT true,
  default_export  TEXT NOT NULL DEFAULT 'png' CHECK (default_export IN ('png','jpeg','webp')),
  ai_consent      BOOLEAN NOT NULL DEFAULT false,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
