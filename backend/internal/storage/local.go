package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Local struct {
	root   string
	signer *Signer
}

func NewLocal(root string, signer *Signer) (*Local, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(abs, 0o750); err != nil {
		return nil, err
	}
	return &Local{root: abs, signer: signer}, nil
}

// path maps a storage key to a file under root, rejecting traversal. Keys are server-generated, but we still verify.
func (l *Local) path(key string) (string, error) {
	if key == "" || strings.ContainsAny(key, "\x00\\") || strings.Contains(key, "..") || filepath.IsAbs(key) {
		return "", errors.New("invalid storage key")
	}
	p := filepath.Join(l.root, filepath.FromSlash(key))
	if rel, err := filepath.Rel(l.root, p); err != nil || strings.HasPrefix(rel, "..") {
		return "", errors.New("invalid storage key")
	}
	return p, nil
}

func (l *Local) Put(_ context.Context, key, _ string, data []byte) error {
	p, err := l.path(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o750); err != nil {
		return err
	}
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, data, 0o640); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

func (l *Local) Get(_ context.Context, key string) (io.ReadCloser, error) {
	p, err := l.path(key)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(p)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrNotFound
	}
	return f, err
}

func (l *Local) Delete(_ context.Context, key string) error {
	p, err := l.path(key)
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func (l *Local) SignedURL(_ context.Context, key, _ string, ttl time.Duration) (string, error) {
	exp, sig := l.signer.Sign(key, ttl, time.Now())
	return fmt.Sprintf("/api/v1/files/%s?exp=%d&sig=%s", url.PathEscape(key), exp, sig), nil
}
