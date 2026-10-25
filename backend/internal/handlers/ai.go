package handlers

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strconv"

	"github.com/blushcam/backend/internal/httpx"
	"github.com/blushcam/backend/internal/imageclient"
	"github.com/blushcam/backend/internal/validation"
)

var colorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

var allOps = []imageclient.Operation{
	{Operation: "portrait-enhance", Label: "Portrait enhancement"}, {Operation: "upscale", Label: "Photo upscaling"},
	{Operation: "remove-background", Label: "Background removal"}, {Operation: "replace-background", Label: "Background replacement"},
	{Operation: "blur-background", Label: "Background blur"}, {Operation: "lighting-correct", Label: "Lighting correction"},
	{Operation: "style-transform", Label: "Style transformation"}, {Operation: "cleanup", Label: "Automatic cleanup"},
}

// Capabilities reports exactly what the Python service can do right now. If the service is unreachable everything is "unavailable".
func (d *Deps) AICapabilities(w http.ResponseWriter, r *http.Request) {
	ops, err := d.Images.Capabilities(r.Context())
	if err != nil {
		out := make([]imageclient.Operation, len(allOps))
		for i, o := range allOps {
			o.Kind, o.Available, o.Reason = "unavailable", false, "The image service isn’t running or reachable."
			out[i] = o
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"operations": out, "serviceReachable": false})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"operations": ops, "serviceReachable": true})
}

// AIProcess requires: signed-in user, CSRF, explicit consent=true in the request, a verified image, and an available operation.
func (d *Deps) AIProcess(w http.ResponseWriter, r *http.Request) {
	uid := current(r).UserID
	if !d.AIRate.Allow(uid) {
		httpx.Fail(w, r, httpx.NewError(http.StatusTooManyRequests, "rate_limited", "You’re going a bit fast — wait a minute and try again."))
		return
	}
	data, err := d.readUpload(w, r)
	if err != nil {
		httpx.Fail(w, r, err)
		return
	}
	if r.FormValue("consent") != "true" {
		httpx.Fail(w, r, httpx.NewError(http.StatusBadRequest, "consent_required", "Please confirm that you agree to upload this photo for processing."))
		return
	}
	op := r.FormValue("operation")
	known := false
	for _, o := range allOps {
		known = known || o.Operation == op
	}
	if !known {
		httpx.Fail(w, r, httpx.Validation(map[string]string{"operation": "Unknown operation."}))
		return
	}
	if _, err := validation.Image(data, d.Cfg.MaxImagePixels); err != nil {
		httpx.Fail(w, r, httpx.NewError(http.StatusUnprocessableEntity, "invalid_image", err.Error()))
		return
	}
	fields := map[string]string{}
	if bg := r.FormValue("background"); bg != "" {
		if !colorRe.MatchString(bg) {
			httpx.Fail(w, r, httpx.Validation(map[string]string{"background": "Use a colour like #FCE4EC."}))
			return
		}
		fields["background"] = bg
	}
	if s := r.FormValue("scale"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 2 || n > 4 {
			httpx.Fail(w, r, httpx.Validation(map[string]string{"scale": "Scale must be 2, 3 or 4."}))
			return
		}
		fields["scale"] = s
	}
	out, ct, err := d.Images.Process(r.Context(), op, "upload", data, fields)
	var pe *imageclient.ProcessError
	switch {
	case errors.As(err, &pe):
		status := pe.Status
		if status < 400 || status > 599 {
			status = http.StatusBadGateway
		}
		httpx.Fail(w, r, httpx.NewError(status, pe.Code, pe.Message))
	case errors.Is(err, imageclient.ErrUnavailable):
		httpx.Fail(w, r, httpx.NewError(http.StatusServiceUnavailable, "unavailable", "The image service isn’t available right now."))
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		httpx.Fail(w, r, httpx.NewError(http.StatusGatewayTimeout, "timeout", "Processing took too long or was cancelled."))
	case err != nil:
		httpx.Fail(w, r, err)
	default:
		w.Header().Set("Content-Type", ct)
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write(out) // image bytes are never stored or logged
	}
}
