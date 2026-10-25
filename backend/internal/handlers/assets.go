package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/blushcam/backend/internal/httpx"
	"github.com/blushcam/backend/internal/store"
	"github.com/blushcam/backend/internal/storage"
	"github.com/blushcam/backend/internal/validation"
)

var extFor = map[string]string{"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}

type assetDTO struct {
	ID       string `json:"id"`
	URL      string `json:"url"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	MimeType string `json:"mimeType"`
	FileSize int64  `json:"fileSize"`
}

// readUpload reads the multipart "file" field with a hard size cap.
func (d *Deps) readUpload(w http.ResponseWriter, r *http.Request) ([]byte, error) {
	r.Body = http.MaxBytesReader(w, r.Body, d.Cfg.MaxUploadBytes+(1<<20))
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			return nil, httpx.NewError(http.StatusRequestEntityTooLarge, "too_large", "That file is too large.")
		}
		return nil, httpx.NewError(http.StatusBadRequest, "bad_upload", "Send the photo as multipart form data in a field called “file”.")
	}
	defer r.MultipartForm.RemoveAll() //nolint:errcheck
	f, _, err := r.FormFile("file")
	if err != nil {
		return nil, httpx.NewError(http.StatusBadRequest, "bad_upload", "Missing “file” field.")
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, d.Cfg.MaxUploadBytes+1))
	if err != nil {
		return nil, httpx.NewError(http.StatusBadRequest, "bad_upload", "Could not read the upload.")
	}
	if int64(len(data)) > d.Cfg.MaxUploadBytes {
		return nil, httpx.NewError(http.StatusRequestEntityTooLarge, "too_large", "That file is too large.")
	}
	return data, nil
}

// UploadAsset stores a private image after verifying the bytes really decode (never trusting client MIME/filename).
func (d *Deps) UploadAsset(w http.ResponseWriter, r *http.Request) {
	uid := current(r).UserID
	data, err := d.readUpload(w, r)
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	info, err := validation.Image(data, d.Cfg.MaxImagePixels)
	if err != nil {
		httpx.Fail(w, r, httpx.NewError(http.StatusUnprocessableEntity, "invalid_image", err.Error()))
		return
	}
	rb := make([]byte, 16)
	_, _ = rand.Read(rb)
	key := "a_" + hex.EncodeToString(rb) + "." + extFor[info.Mime] // server-generated flat key: no user input in paths
	a, err := d.Store.CreateAsset(r.Context(), store.Asset{OwnerID: uid, StorageKey: key, MimeType: info.Mime, FileSize: int64(len(data)), Width: info.Width, Height: info.Height}, d.Cfg.UserQuotaBytes)
	if errors.Is(err, store.ErrQuota) {
		httpx.Fail(w, r, httpx.NewError(http.StatusInsufficientStorage, "quota_exceeded", "You’ve reached your storage limit. Delete some projects or photos first."))
		return
	}
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	if err := d.Storage.Put(r.Context(), key, info.Mime, data); err != nil {
		_ = d.Store.DeleteAssetByID(r.Context(), a.ID) // roll back the row if the object couldn't be stored
		httpx.Fail(w, r, err)
		return
	}
	url, err := d.Storage.SignedURL(r.Context(), key, info.Mime, d.Cfg.SignedURLTTL)
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, assetDTO{a.ID, url, a.Width, a.Height, a.MimeType, a.FileSize})
}

func (d *Deps) GetAsset(w http.ResponseWriter, r *http.Request) {
	a, err := d.Store.GetAsset(r.Context(), current(r).UserID, chi.URLParam(r, "id")) // owner-scoped in SQL
	if err != nil {
		notFound(w, r, err)
		return
	}
	url, err := d.Storage.SignedURL(r.Context(), a.StorageKey, a.MimeType, d.Cfg.SignedURLTTL)
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, assetDTO{a.ID, url, a.Width, a.Height, a.MimeType, a.FileSize})
}

func (d *Deps) DeleteAsset(w http.ResponseWriter, r *http.Request) {
	key, err := d.Store.DeleteAsset(r.Context(), current(r).UserID, chi.URLParam(r, "id"))
	if err != nil {
		notFound(w, r, err)
		return
	}
	_ = d.Storage.Delete(r.Context(), key)
	httpx.JSON(w, http.StatusNoContent, nil)
}

// ServeFile serves local-provider files. Authorisation is the HMAC signature (short-lived), so it works for <img>/fetch without extra headers.
func (d *Deps) ServeFile(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	q := r.URL.Query()
	if !d.Signer.Verify(key, q.Get("exp"), q.Get("sig"), time.Now()) {
		httpx.Fail(w, r, httpx.NewError(http.StatusForbidden, "bad_signature", "This link is invalid or has expired."))
		return
	}
	a, err := d.Store.AssetByKey(r.Context(), key)
	if err != nil {
		notFound(w, r, err)
		return
	}
	rc, err := d.Storage.Get(r.Context(), key)
	if errors.Is(err, storage.ErrNotFound) {
		httpx.Fail(w, r, httpx.ErrNotFound)
		return
	}
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	defer rc.Close()
	h := w.Header()
	h.Set("Content-Type", a.MimeType)
	h.Set("Cache-Control", "private, max-age=60")
	h.Set("Content-Security-Policy", "sandbox")
	h.Set("X-Content-Type-Options", "nosniff")
	_, _ = io.Copy(w, rc)
}
