package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
)

type Template struct {
	ID       string          `json:"id"`
	Kind     string          `json:"kind"`
	Category string          `json:"category"`
	Name     string          `json:"name"`
	Audience string          `json:"audience"`
	Document json.RawMessage `json:"document,omitempty"`
}

func (s *Store) ListTemplates(ctx context.Context, kind, audience string) ([]Template, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id,kind,category,name,audience FROM templates WHERE ($1='' OR kind=$1) AND ($2='' OR audience=$2 OR audience='everyone') ORDER BY sort_order,name`, kind, audience)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Template{}
	for rows.Next() {
		var t Template
		if err := rows.Scan(&t.ID, &t.Kind, &t.Category, &t.Name, &t.Audience); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) GetTemplate(ctx context.Context, id string) (Template, error) {
	var t Template
	err := s.Pool.QueryRow(ctx, `SELECT id,kind,category,name,audience,document_json FROM templates WHERE id=$1`, id).Scan(&t.ID, &t.Kind, &t.Category, &t.Name, &t.Audience, &t.Document)
	if errors.Is(err, pgx.ErrNoRows) {
		return Template{}, ErrNotFound
	}
	return t, err
}

// UpsertTemplate lets `api seed-templates` publish the frontend's template catalogue to the DB.
func (s *Store) UpsertTemplate(ctx context.Context, t Template, order int) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO templates(id,kind,category,name,audience,document_json,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT (id) DO UPDATE SET kind=$2,category=$3,name=$4,audience=$5,document_json=$6,sort_order=$7`, t.ID, t.Kind, t.Category, t.Name, t.Audience, []byte(t.Document), order)
	return err
}
