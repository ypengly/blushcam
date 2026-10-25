package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/blushcam/backend/internal/httpx"
	"github.com/blushcam/backend/internal/store"
	"github.com/blushcam/backend/internal/validation"
)

type projectIn struct {
	Name           *string         `json:"name"`
	ProjectType    string          `json:"projectType"`
	Document       json.RawMessage `json:"document"`
	PreviewAssetID *string         `json:"previewAssetId"`
}

// checkDocument requires a JSON object with a non-empty "docs" array (the editor's project format).
func checkDocument(raw json.RawMessage) error {
	var m struct {
		Docs []json.RawMessage `json:"docs"`
	}
	if err := json.Unmarshal(raw, &m); err != nil || len(m.Docs) == 0 || len(m.Docs) > 100 {
		return errors.New("The project document is invalid.")
	}
	return nil
}

func notFound(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, store.ErrNotFound) {
		httpx.Fail(w, r, httpx.ErrNotFound) // 404 (not 403) so ids of other users' projects can't be probed
		return
	}
	httpx.Fail(w, r, err)
}

type projectSummary struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	ProjectType  string  `json:"projectType"`
	CollectionID *string `json:"collectionId"`
	PreviewURL   *string `json:"previewUrl"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
}

func (d *Deps) signedAssetURL(ctx context.Context, owner string, id *string) *string {
	if id == nil {
		return nil
	}
	a, err := d.Store.GetAsset(ctx, owner, *id)
	if err != nil {
		return nil
	}
	u, err := d.Storage.SignedURL(ctx, a.StorageKey, a.MimeType, d.Cfg.SignedURLTTL)
	if err != nil {
		return nil
	}
	return &u
}

func (d *Deps) ListProjects(w http.ResponseWriter, r *http.Request) {
	uid := current(r).UserID
	q := r.URL.Query()
	lim, _ := strconv.Atoi(q.Get("limit"))
	off, _ := strconv.Atoi(q.Get("offset"))
	typ := q.Get("type")
	if typ != "" && !validation.ProjectTypes[typ] {
		httpx.Fail(w, r, httpx.Validation(map[string]string{"type": "Unknown project type."}))
		return
	}
	if len(q.Get("q")) > 100 {
		httpx.Fail(w, r, httpx.Validation(map[string]string{"q": "Search is too long."}))
		return
	}
	list, err := d.Store.ListProjects(r.Context(), uid, store.ListOpts{Query: q.Get("q"), Type: typ, Sort: q.Get("sort"), Limit: lim, Offset: off})
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	out := make([]projectSummary, 0, len(list))
	for _, p := range list {
		out = append(out, projectSummary{p.ID, p.Name, p.ProjectType, p.CollectionID, d.signedAssetURL(r.Context(), uid, p.PreviewAssetID), p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"), p.UpdatedAt.Format("2006-01-02T15:04:05Z07:00")})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"projects": out})
}

func (d *Deps) CreateProject(w http.ResponseWriter, r *http.Request) {
	var in projectIn
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, r, err)
		return
	}
	f := map[string]string{}
	name := ""
	if in.Name != nil {
		name, _ = validation.Name(*in.Name, 120)
	}
	if name == "" {
		f["name"] = "Give your project a name (up to 120 characters)."
	}
	if !validation.ProjectTypes[in.ProjectType] {
		f["projectType"] = "Unknown project type."
	}
	if err := checkDocument(in.Document); err != nil {
		f["document"] = err.Error()
	}
	if len(f) > 0 {
		httpx.Fail(w, r, httpx.Validation(f))
		return
	}
	p, err := d.Store.CreateProject(r.Context(), current(r).UserID, name, in.ProjectType, in.Document, in.PreviewAssetID)
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, p)
}

func (d *Deps) GetProject(w http.ResponseWriter, r *http.Request) {
	p, err := d.Store.GetProject(r.Context(), current(r).UserID, chi.URLParam(r, "id"))
	if err != nil {
		notFound(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"id": p.ID, "name": p.Name, "projectType": p.ProjectType, "document": p.Document, "createdAt": p.CreatedAt, "updatedAt": p.UpdatedAt})
}

func (d *Deps) PatchProject(w http.ResponseWriter, r *http.Request) {
	var in projectIn
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, r, err)
		return
	}
	f := map[string]string{}
	var name *string
	if in.Name != nil {
		n, _ := validation.Name(*in.Name, 120)
		if n == "" {
			f["name"] = "Give your project a name (up to 120 characters)."
		}
		name = &n
	}
	if len(in.Document) > 0 {
		if err := checkDocument(in.Document); err != nil {
			f["document"] = err.Error()
		}
	}
	if in.ProjectType != "" {
		f["projectType"] = "A project’s type can’t be changed."
	}
	if len(f) > 0 {
		httpx.Fail(w, r, httpx.Validation(f))
		return
	}
	p, err := d.Store.UpdateProject(r.Context(), current(r).UserID, chi.URLParam(r, "id"), store.ProjectPatch{Name: name, Document: in.Document, PreviewAssetID: in.PreviewAssetID})
	if err != nil {
		notFound(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (d *Deps) DeleteProject(w http.ResponseWriter, r *http.Request) {
	if err := d.Store.DeleteProject(r.Context(), current(r).UserID, chi.URLParam(r, "id")); err != nil {
		notFound(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusNoContent, nil)
}

func (d *Deps) DuplicateProject(w http.ResponseWriter, r *http.Request) {
	p, err := d.Store.DuplicateProject(r.Context(), current(r).UserID, chi.URLParam(r, "id"))
	if err != nil {
		notFound(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, p)
}
