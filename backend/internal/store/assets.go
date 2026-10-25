package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type Asset struct {
	ID         string
	OwnerID    string
	StorageKey string
	MimeType   string
	FileSize   int64
	Width      int
	Height     int
	CreatedAt  time.Time
}

// CreateAsset inserts the asset row inside a transaction that first checks the owner's quota (serialised per-user with an advisory lock).
func (s *Store) CreateAsset(ctx context.Context, a Asset, quota int64) (Asset, error) {
	err := s.Tx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, a.OwnerID); err != nil {
			return err
		}
		var used int64
		if err := tx.QueryRow(ctx, `SELECT COALESCE(SUM(file_size),0) FROM project_assets WHERE owner_id=$1`, a.OwnerID).Scan(&used); err != nil {
			return err
		}
		if used+a.FileSize > quota {
			return ErrQuota
		}
		return tx.QueryRow(ctx, `INSERT INTO project_assets(owner_id,storage_key,mime_type,file_size,width,height) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,created_at`,
			a.OwnerID, a.StorageKey, a.MimeType, a.FileSize, a.Width, a.Height).Scan(&a.ID, &a.CreatedAt)
	})
	return a, err
}

func (s *Store) GetAsset(ctx context.Context, owner, id string) (Asset, error) {
	var a Asset
	err := s.Pool.QueryRow(ctx, `SELECT id,owner_id,storage_key,mime_type,file_size,width,height,created_at FROM project_assets WHERE id=$1 AND owner_id=$2`, id, owner).
		Scan(&a.ID, &a.OwnerID, &a.StorageKey, &a.MimeType, &a.FileSize, &a.Width, &a.Height, &a.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) || isBadUUID(err) {
		return Asset{}, ErrNotFound
	}
	return a, err
}

// AssetByKey is used by the signed-URL file endpoint (the signature already proves authorisation).
func (s *Store) AssetByKey(ctx context.Context, key string) (Asset, error) {
	var a Asset
	err := s.Pool.QueryRow(ctx, `SELECT id,owner_id,storage_key,mime_type,file_size,width,height,created_at FROM project_assets WHERE storage_key=$1`, key).
		Scan(&a.ID, &a.OwnerID, &a.StorageKey, &a.MimeType, &a.FileSize, &a.Width, &a.Height, &a.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Asset{}, ErrNotFound
	}
	return a, err
}

func (s *Store) DeleteAsset(ctx context.Context, owner, id string) (string, error) {
	var key string
	err := s.Pool.QueryRow(ctx, `DELETE FROM project_assets WHERE id=$1 AND owner_id=$2 RETURNING storage_key`, id, owner).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) || isBadUUID(err) {
		return "", ErrNotFound
	}
	return key, err
}

func (s *Store) AssetKeys(ctx context.Context, owner string) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `SELECT storage_key FROM project_assets WHERE owner_id=$1`, owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// OrphanAssets returns assets older than maxAge that no project references (neither as preview nor inside document_json.assets).
// This implements the documented cleanup policy for abandoned temporary uploads.
func (s *Store) OrphanAssets(ctx context.Context, maxAge time.Duration) ([]Asset, error) {
	rows, err := s.Pool.Query(ctx, `SELECT a.id,a.owner_id,a.storage_key FROM project_assets a
		WHERE a.created_at < now()-make_interval(secs => $1)
		AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.preview_asset_id=a.id OR p.document_json->'assets' @> to_jsonb(a.id::text) OR p.document_json->>'assets' LIKE '%'||a.id::text||'%')`, maxAge.Seconds())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Asset
	for rows.Next() {
		var a Asset
		if err := rows.Scan(&a.ID, &a.OwnerID, &a.StorageKey); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) DeleteAssetByID(ctx context.Context, id string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM project_assets WHERE id=$1`, id)
	return err
}
