package handlers

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/blushcam/backend/internal/auth"
	"github.com/blushcam/backend/internal/httpx"
	"github.com/blushcam/backend/internal/store"
	"github.com/blushcam/backend/internal/validation"
)

type userDTO struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
}

func toUser(u store.User) userDTO { return userDTO{ID: u.ID, Email: u.Email, DisplayName: u.DisplayName} }

type credentials struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

func (d *Deps) startSession(w http.ResponseWriter, r *http.Request, u store.User, status int) {
	token, hash, err := auth.NewToken()
	if err == nil {
		var csrf string
		if csrf, err = auth.NewCSRF(); err == nil {
			if err = d.Store.CreateSession(r.Context(), u.ID, hash, csrf, r.UserAgent(), d.Cfg.SessionTTL); err == nil {
				d.setCookie(w, token)
				httpx.JSON(w, status, map[string]any{"user": toUser(u), "csrfToken": csrf})
				return
			}
		}
	}
	httpx.Fail(w, r, err)
}

func (d *Deps) Register(w http.ResponseWriter, r *http.Request) {
	var in credentials
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, r, err)
		return
	}
	fields := map[string]string{}
	email, err := validation.Email(in.Email)
	if err != nil {
		fields["email"] = err.Error()
	}
	if err := validation.Password(in.Password); err != nil {
		fields["password"] = err.Error()
	}
	name, err := validation.Name(in.DisplayName, 60)
	if err != nil {
		fields["displayName"] = err.Error()
	}
	if len(fields) > 0 {
		httpx.Fail(w, r, httpx.Validation(fields))
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	u, err := d.Store.CreateUser(r.Context(), email, hash, name)
	if errors.Is(err, store.ErrDuplicate) {
		httpx.Fail(w, r, httpx.Validation(map[string]string{"email": "That email is already registered. Try signing in."}))
		return
	}
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	d.startSession(w, r, u, http.StatusCreated)
}

func (d *Deps) Login(w http.ResponseWriter, r *http.Request) {
	var in credentials
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, r, err)
		return
	}
	bad := httpx.NewError(http.StatusUnauthorized, "invalid_credentials", "Email or password is incorrect.")
	email, err := validation.Email(in.Email)
	if err != nil || in.Password == "" || len(in.Password) > 128 {
		httpx.Fail(w, r, bad)
		return
	}
	u, err := d.Store.UserByEmail(r.Context(), email)
	if errors.Is(err, store.ErrNotFound) {
		auth.DummyVerify(in.Password) // equalise timing
		httpx.Fail(w, r, bad)
		return
	}
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	ok, verr := auth.VerifyPassword(in.Password, u.PasswordHash)
	if verr != nil || !ok {
		httpx.Fail(w, r, bad)
		return
	}
	d.startSession(w, r, u, http.StatusOK)
}

func (d *Deps) Logout(w http.ResponseWriter, r *http.Request) {
	a := current(r)
	_ = d.Store.DeleteSession(r.Context(), a.Hash)
	d.clearCookie(w)
	httpx.JSON(w, http.StatusNoContent, nil)
}

func (d *Deps) Me(w http.ResponseWriter, r *http.Request) {
	a := current(r)
	u, err := d.Store.UserByID(r.Context(), a.UserID)
	if err != nil {
		httpx.Fail(w, r, httpx.ErrUnauthorized)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"user": toUser(u), "csrfToken": a.CSRF})
}

const resetMessage = "If that email has an account and this server has email delivery configured, a reset link is on its way."

// ForgotPassword always returns the same response (no account enumeration). If SMTP isn't configured, no email is sent and this is logged.
func (d *Deps) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email string `json:"email"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, r, err)
		return
	}
	defer httpx.JSON(w, http.StatusOK, map[string]string{"message": resetMessage})
	email, err := validation.Email(in.Email)
	if err != nil {
		return
	}
	u, err := d.Store.UserByEmail(r.Context(), email)
	if err != nil {
		return
	}
	token, hash, err := auth.NewToken()
	if err != nil || d.Store.CreateReset(r.Context(), u.ID, hash, d.Cfg.ResetTTL) != nil {
		return
	}
	link := d.Cfg.PublicAppURL + "/reset-password?token=" + token
	if !d.Mailer.Enabled() {
		if d.Cfg.IsProd() {
			slog.Warn("password reset requested but SMTP is not configured; email NOT sent")
		} else {
			slog.Warn("SMTP not configured; email NOT sent. Development-only reset link:", "link", link)
		}
		return
	}
	if err := d.Mailer.Send(u.Email, "Reset your BlushCam password", "Use this link to choose a new password (valid for "+d.Cfg.ResetTTL.String()+"):\n\n"+link+"\n\nIf you didn’t ask for this, you can ignore this email."); err != nil {
		slog.Error("sending reset email failed", "err", err)
	}
}

func (d *Deps) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var in struct{ Token, Password string }
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, r, err)
		return
	}
	if err := validation.Password(in.Password); err != nil {
		httpx.Fail(w, r, httpx.Validation(map[string]string{"password": err.Error()}))
		return
	}
	uid, err := d.Store.ConsumeReset(r.Context(), auth.HashToken(in.Token))
	if err != nil {
		httpx.Fail(w, r, httpx.NewError(http.StatusBadRequest, "invalid_token", "That reset link is invalid or has expired."))
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err == nil {
		err = d.Store.SetPassword(r.Context(), uid, hash)
	}
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "Password updated."})
}
