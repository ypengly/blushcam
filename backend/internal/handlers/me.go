package handlers

import (
	"net/http"

	"github.com/blushcam/backend/internal/auth"
	"github.com/blushcam/backend/internal/httpx"
	"github.com/blushcam/backend/internal/store"
	"github.com/blushcam/backend/internal/validation"
)

func (d *Deps) UpdateMe(w http.ResponseWriter, r *http.Request) {
	var in struct {
		DisplayName string `json:"displayName"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, r, err)
		return
	}
	name, err := validation.Name(in.DisplayName, 60)
	if err != nil {
		httpx.Fail(w, r, httpx.Validation(map[string]string{"displayName": err.Error()}))
		return
	}
	if err := d.Store.UpdateDisplayName(r.Context(), current(r).UserID, name); err != nil {
		httpx.Fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"displayName": name})
}

// DeleteMe permanently deletes the account after re-checking the password, removing stored objects first, then DB rows (cascade).
func (d *Deps) DeleteMe(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Password string `json:"password"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, r, err)
		return
	}
	uid := current(r).UserID
	u, err := d.Store.UserByID(r.Context(), uid)
	if err != nil {
		httpx.Fail(w, r, httpx.ErrUnauthorized)
		return
	}
	if ok, verr := auth.VerifyPassword(in.Password, u.PasswordHash); verr != nil || !ok {
		httpx.Fail(w, r, httpx.NewError(http.StatusForbidden, "invalid_credentials", "That password is incorrect."))
		return
	}
	keys, err := d.Store.AssetKeys(r.Context(), uid)
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	for _, k := range keys {
		if err := d.Storage.Delete(r.Context(), k); err != nil {
			httpx.Fail(w, r, err)
			return
		}
	}
	if err := d.Store.DeleteUser(r.Context(), uid); err != nil {
		httpx.Fail(w, r, err)
		return
	}
	d.clearCookie(w)
	httpx.JSON(w, http.StatusNoContent, nil)
}

func (d *Deps) GetPrefs(w http.ResponseWriter, r *http.Request) {
	p, err := d.Store.GetPrefs(r.Context(), current(r).UserID)
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (d *Deps) PutPrefs(w http.ResponseWriter, r *http.Request) {
	var p store.Prefs
	if err := httpx.Decode(r, &p); err != nil {
		httpx.Fail(w, r, err)
		return
	}
	f := map[string]string{}
	if p.Theme != "light" && p.Theme != "dark" {
		f["theme"] = "Choose light or dark."
	}
	if p.DefaultExport != "png" && p.DefaultExport != "jpeg" && p.DefaultExport != "webp" {
		f["defaultExport"] = "Choose png, jpeg or webp."
	}
	if len(f) > 0 {
		httpx.Fail(w, r, httpx.Validation(f))
		return
	}
	if err := d.Store.PutPrefs(r.Context(), current(r).UserID, p); err != nil {
		httpx.Fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}
