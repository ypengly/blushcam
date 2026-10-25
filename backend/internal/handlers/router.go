package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/blushcam/backend/internal/httpx"
)

// Router wires all routes; exported so integration tests (backend/tests) can mount the same handler tree.
func Router(d *Deps) http.Handler {
	authLimit := httpx.NewRateLimiter(d.Cfg.AuthRatePerMinute, time.Minute)
	r := chi.NewRouter()
	r.Use(httpx.RequestIDMiddleware, httpx.Recoverer, httpx.Logger, httpx.SecurityHeaders, httpx.CORS(d.Cfg.CORSOrigins), httpx.OriginCheck(append([]string{d.Cfg.PublicAppURL}, d.Cfg.CORSOrigins...)))

	r.Get("/healthz", d.Healthz)
	r.Get("/readyz", d.Readyz)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(httpx.BodyLimit(d.Cfg.MaxBodyBytes))
		r.Get("/files/{key}", d.ServeFile)
		r.Get("/ai/capabilities", d.AICapabilities)
		r.Get("/templates", d.ListTemplates)
		r.Get("/templates/{id}", d.GetTemplate)

		r.Group(func(r chi.Router) { // unauthenticated, rate limited
			r.Use(authLimit.Middleware)
			r.Post("/auth/register", d.Register)
			r.Post("/auth/login", d.Login)
			r.Post("/auth/forgot-password", d.ForgotPassword)
			r.Post("/auth/reset-password", d.ResetPassword)
		})

		r.Group(func(r chi.Router) { // authenticated + CSRF on unsafe methods
			r.Use(d.RequireAuth)
			r.Post("/auth/logout", d.Logout)
			r.Get("/auth/me", d.Me)
			r.Patch("/me", d.UpdateMe)
			r.Delete("/me", d.DeleteMe)
			r.Get("/me/preferences", d.GetPrefs)
			r.Put("/me/preferences", d.PutPrefs)
			r.Get("/projects", d.ListProjects)
			r.Post("/projects", d.CreateProject)
			r.Get("/projects/{id}", d.GetProject)
			r.Patch("/projects/{id}", d.PatchProject)
			r.Delete("/projects/{id}", d.DeleteProject)
			r.Post("/projects/{id}/duplicate", d.DuplicateProject)
			r.Post("/assets", d.UploadAsset)
			r.Get("/assets/{id}", d.GetAsset)
			r.Delete("/assets/{id}", d.DeleteAsset)
			r.Post("/ai/process", d.AIProcess)
		})
	})
	return r
}

