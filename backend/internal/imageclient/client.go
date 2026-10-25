// Package imageclient talks to the Python image service. It never sends photos unless a handler was given explicit user consent.
package imageclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"time"
)

type Client struct {
	base string
	http *http.Client
}

func New(base string, timeout time.Duration) *Client { return &Client{base: base, http: &http.Client{Timeout: timeout}} }

type Operation struct {
	Operation string `json:"operation"`
	Label     string `json:"label"`
	Available bool   `json:"available"`
	Kind      string `json:"kind"`
	Reason    string `json:"reason,omitempty"`
	External  bool   `json:"external"`
}

var ErrUnavailable = errors.New("image service unavailable")

// Capabilities returns the Python service's honest list; if the service is down every operation is reported unavailable.
func (c *Client) Capabilities(ctx context.Context) ([]Operation, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, c.base+"/v1/capabilities", nil)
	res, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, ErrUnavailable
	}
	var out struct {
		Operations []Operation `json:"operations"`
	}
	if err := json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&out); err != nil {
		return nil, ErrUnavailable
	}
	return out.Operations, nil
}

type ProcessError struct {
	Status  int
	Code    string
	Message string
}

func (e *ProcessError) Error() string { return e.Code + ": " + e.Message }

// Process forwards one image + options and returns the processed image bytes and content type.
func (c *Client) Process(ctx context.Context, op string, filename string, data []byte, fields map[string]string) ([]byte, string, error) {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", `form-data; name="file"; filename="upload"`)
	h.Set("Content-Type", "application/octet-stream")
	fw, _ := mw.CreatePart(h)
	_, _ = fw.Write(data)
	for k, v := range fields {
		_ = mw.WriteField(k, v)
	}
	_ = mw.Close()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/v1/"+op, &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	res, err := c.http.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return nil, "", ctx.Err()
		}
		return nil, "", fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 64<<20))
	if res.StatusCode != http.StatusOK {
		var e struct {
			Detail struct{ Code, Message string } `json:"detail"`
		}
		_ = json.Unmarshal(body, &e)
		if e.Detail.Code == "" {
			e.Detail.Code, e.Detail.Message = "upstream_error", "The image service returned an error."
		}
		return nil, "", &ProcessError{Status: res.StatusCode, Code: e.Detail.Code, Message: e.Detail.Message}
	}
	return body, res.Header.Get("Content-Type"), nil
}
