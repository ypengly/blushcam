// Package httpx holds HTTP helpers shared by handlers: JSON responses, errors, middleware.
package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
)

// APIError is the single error shape returned by the API.
type APIError struct {
	Status  int               `json:"-"`
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

func (e *APIError) Error() string { return e.Code + ": " + e.Message }

func NewError(status int, code, msg string) *APIError { return &APIError{Status: status, Code: code, Message: msg} }
func Validation(fields map[string]string) *APIError {
	return &APIError{Status: http.StatusUnprocessableEntity, Code: "validation_failed", Message: "Please fix the highlighted fields.", Fields: fields}
}

var (
	ErrUnauthorized = NewError(http.StatusUnauthorized, "unauthorized", "Please sign in.")
	ErrForbidden    = NewError(http.StatusForbidden, "forbidden", "You don’t have access to that.")
	ErrNotFound     = NewError(http.StatusNotFound, "not_found", "Not found.")
	ErrCSRF         = NewError(http.StatusForbidden, "csrf", "Your session token is missing or invalid. Refresh the page and try again.")
)

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// Fail writes err as the standard JSON error. Unknown errors become 500 without leaking details.
func Fail(w http.ResponseWriter, r *http.Request, err error) {
	var ae *APIError
	if !errors.As(err, &ae) {
		slog.ErrorContext(r.Context(), "unhandled error", "err", err, "request_id", RequestID(r.Context()), "path", r.URL.Path)
		ae = NewError(http.StatusInternalServerError, "internal", "Something went wrong on our side.")
	}
	JSON(w, ae.Status, map[string]any{"error": ae})
}

// Decode reads a JSON body (size-limited by middleware), rejecting unknown fields and trailing data.
func Decode(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			return NewError(http.StatusRequestEntityTooLarge, "too_large", "That request is too large.")
		}
		return NewError(http.StatusBadRequest, "bad_json", "The request body isn’t valid JSON.")
	}
	if _, err := dec.Token(); err != io.EOF {
		return NewError(http.StatusBadRequest, "bad_json", "Unexpected data after the JSON body.")
	}
	return nil
}
