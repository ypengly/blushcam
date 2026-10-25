// Package handlers contains the HTTP handlers and the auth middleware.
package handlers

import (
	"context"
	"errors"
	"net/http"

	"github.com/blushcam/backend/internal/auth"
	"github.com/blushcam/backend/internal/config"
	"github.com/blushcam/backend/internal/httpx"
	"github.com/blushcam/backend/internal/imageclient"
	"github.com/blushcam/backend/internal/mail"
	"github.com/blushcam/backend/internal/storage"
	"github.com/blushcam/backend/internal/store"
)

type Deps struct {
	Cfg     config.Config
	Store   *store.Store
	Storage storage.Store
	Signer  *storage.Signer
	Mailer  *mail.Mailer
	Images  *imageclient.Client
	// AIRate limits AI processing per user.
	AIRate *httpx.RateLimiter
}

type ctxKey int

const sessionKey ctxKey = 1

type authed struct {
	UserID string
	CSRF   string
	Hash   []byte
}

func current(r *http.Request) authed { a, _ := r.Context().Value(sessionKey).(authed); return a }

// RequireAuth validates the session cookie against the database on EVERY request and enforces the CSRF header on unsafe methods.
func (d *Deps) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(d.Cfg.CookieName)
		if err != nil || c.Value == "" || len(c.Value) > 128 {
			httpx.Fail(w, r, httpx.ErrUnauthorized)
			return
		}
		h := auth.HashToken(c.Value)
		se, err := d.Store.SessionByTokenHash(r.Context(), h)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				d.clearCookie(w)
				httpx.Fail(w, r, httpx.ErrUnauthorized)
				return
			}
			httpx.Fail(w, r, err)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			if !auth.CSRFEqual(r.Header.Get("X-CSRF-Token"), se.CSRF) {
				httpx.Fail(w, r, httpx.ErrCSRF)
				return
			}
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), sessionKey, authed{UserID: se.UserID, CSRF: se.CSRF, Hash: h})))
	})
}

func (d *Deps) setCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{Name: d.Cfg.CookieName, Value: token, Path: "/", HttpOnly: true, Secure: d.Cfg.CookieSecure, SameSite: http.SameSiteLaxMode, MaxAge: int(d.Cfg.SessionTTL.Seconds())})
}
func (d *Deps) clearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: d.Cfg.CookieName, Value: "", Path: "/", HttpOnly: true, Secure: d.Cfg.CookieSecure, SameSite: http.SameSiteLaxMode, MaxAge: -1})
}
