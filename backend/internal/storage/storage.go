// Package storage abstracts object storage (local disk for development, S3-compatible for production)
// and implements short-lived HMAC signed URLs for private downloads.
package storage

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strconv"
	"time"
)

var ErrNotFound = errors.New("object not found")

type Store interface {
	Put(ctx context.Context, key, contentType string, data []byte) error
	Get(ctx context.Context, key string) (io.ReadCloser, error)
	Delete(ctx context.Context, key string) error
	// SignedURL returns a short-lived URL. Local storage returns a path served by the API; S3 returns a presigned URL.
	SignedURL(ctx context.Context, key, contentType string, ttl time.Duration) (string, error)
}

// Signer creates and verifies HMAC tokens used by the local provider's /files endpoint.
type Signer struct{ secret []byte }

func NewSigner(secret string) *Signer { return &Signer{secret: []byte(secret)} }

func (s *Signer) mac(key string, exp int64) string {
	m := hmac.New(sha256.New, s.secret)
	fmt.Fprintf(m, "%s\n%d", key, exp)
	return hex.EncodeToString(m.Sum(nil))
}

func (s *Signer) Sign(key string, ttl time.Duration, now time.Time) (exp int64, sig string) {
	exp = now.Add(ttl).Unix()
	return exp, s.mac(key, exp)
}

func (s *Signer) Verify(key string, expStr, sig string, now time.Time) bool {
	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil || now.Unix() > exp {
		return false
	}
	return hmac.Equal([]byte(s.mac(key, exp)), []byte(sig))
}
