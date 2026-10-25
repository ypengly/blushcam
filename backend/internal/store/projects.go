package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type Project struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	ProjectType    string          `json:"projectType"`
	Document       json.RawMessage `json:"document,omitempty"`
	PreviewAssetID *string         `json:"-"`
	CollectionID   *string         `json:"collectionId"`
	CreatedAt      time.Time       `json:"createdAt"`
	UpdatedAt      time.Time       `json:"updatedAt"`
}

type ListOpts struct {
	Query, Type, Sort string // Sort: updated|created|name
	Limit, Offset     int
}

func (s *Store) ListProjects(ctx context.Context, owner string, o ListOpts) ([]Project, error) {
	order := "updated_at DESC"
	switch o.Sort {
	case "created":
		order = "created_at DESC"
	case "name":
		order = "lower(name) ASC"
	}
	if o.Limit <= 0 || o.Limit > 200 {
		o.Limit = 100
	}
	// $2 / $3 are optional filters; escape LIKE wildcards in the search term.
	q := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(o.Query)
	rows, err := s.Pool.Query(ctx, `SELECT id,name,project_type,preview_asset_id,collection_id,created_at,updated_at FROM projects
		WHERE owner_id=$1 AND ($2='' OR project_type=$2) AND ($3='' OR name ILIKE '%'||$3||'%')
		ORDER BY `+order+` LIMIT $4 OFFSET $5`, owner, o.Type, q, o.Limit, o.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.ProjectType, &p.PreviewAssetID, &p.CollectionID, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) GetProject(ctx context.Context, owner, id string) (Project, error) {
	var p Project
	err := s.Pool.QueryRow(ctx, `SELECT id,name,project_type,document_json,preview_asset_id,collection_id,created_at,updated_at FROM projects WHERE id=$1 AND owner_id=$2`, id, owner).
		Scan(&p.ID, &p.Name, &p.ProjectType, &p.Document, &p.PreviewAssetID, &p.CollectionID, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) || isBadUUID(err) {
		return Project{}, ErrNotFound
	}
	return p, err
}

func (s *Store) CreateProject(ctx context.Context, owner, name, typ string, doc json.RawMessage, preview *string) (Project, error) {
	var p Project
	err := s.Pool.QueryRow(ctx, `INSERT INTO projects(owner_id,name,project_type,document_json,preview_asset_id)
		VALUES($1,$2,$3,$4,(SELECT id FROM project_assets WHERE id=$5 AND owner_id=$1)) RETURNING id,name,project_type,created_at,updated_at`, owner, name, typ, doc, preview).
		Scan(&p.ID, &p.Name, &p.ProjectType, &p.CreatedAt, &p.UpdatedAt)
	return p, err
}

type ProjectPatch struct {
	Name           *string
	Document       json.RawMessage
	PreviewAssetID *string
}

func (s *Store) UpdateProject(ctx context.Context, owner, id string, pt ProjectPatch) (Project, error) {
	var p Project
	err := s.Pool.QueryRow(ctx, `UPDATE projects SET
		name=COALESCE($3,name), document_json=COALESCE($4,document_json),
		preview_asset_id=COALESCE((SELECT id FROM project_assets WHERE id=$5 AND owner_id=$2), preview_asset_id), updated_at=now()
		WHERE id=$1 AND owner_id=$2 RETURNING id,name,project_type,created_at,updated_at`, id, owner, pt.Name, nullableJSON(pt.Document), pt.PreviewAssetID).
		Scan(&p.ID, &p.Name, &p.ProjectType, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) || isBadUUID(err) {
		return Project{}, ErrNotFound
	}
	return p, err
}

func nullableJSON(j json.RawMessage) any {
	if len(j) == 0 {
		return nil
	}
	return []byte(j)
}

func (s *Store) DeleteProject(ctx context.Context, owner, id string) error {
	ct, err := s.Pool.Exec(ctx, `DELETE FROM projects WHERE id=$1 AND owner_id=$2`, id, owner)
	if err != nil {
		if isBadUUID(err) {
			return ErrNotFound
		}
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) DuplicateProject(ctx context.Context, owner, id string) (Project, error) {
	var p Project
	err := s.Pool.QueryRow(ctx, `INSERT INTO projects(owner_id,collection_id,name,project_type,document_json,preview_asset_id)
		SELECT owner_id,collection_id,left(name,112)||' copy',project_type,document_json,preview_asset_id FROM projects WHERE id=$1 AND owner_id=$2
		RETURNING id,name,project_type,created_at,updated_at`, id, owner).Scan(&p.ID, &p.Name, &p.ProjectType, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) || isBadUUID(err) {
		return Project{}, ErrNotFound
	}
	return p, err
}

func isBadUUID(err error) bool { return err != nil && strings.Contains(err.Error(), "invalid input syntax for type uuid") }
