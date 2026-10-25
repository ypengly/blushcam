package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/blushcam/backend/internal/httpx"
)

func (d *Deps) Healthz(w http.ResponseWriter, r *http.Request) { httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"}) }

// Readyz checks the database (required). The image service is optional, so it is reported but doesn't fail readiness.
func (d *Deps) Readyz(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := d.Store.Ping(ctx); err != nil {
		httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable", "database": "down"})
		return
	}
	_, ierr := d.Images.Capabilities(ctx)
	img := "up"
	if ierr != nil {
		img = "down (optional)"
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ready", "database": "up", "imageService": img})
}

func (d *Deps) ListTemplates(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	list, err := d.Store.ListTemplates(r.Context(), q.Get("kind"), q.Get("audience"))
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"templates": list})
}

func (d *Deps) GetTemplate(w http.ResponseWriter, r *http.Request) {
	t, err := d.Store.GetTemplate(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		notFound(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, t)
}
