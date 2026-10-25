package storage

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// S3 works with AWS S3 and any S3-compatible service (R2, MinIO, Spaces, Backblaze B2…).
type S3 struct {
	c      *minio.Client
	bucket string
}

func NewS3(endpoint, region, bucket, access, secret string) (*S3, error) {
	secure := true
	host := endpoint
	if host == "" {
		host = "s3.amazonaws.com"
	}
	if strings.HasPrefix(host, "http://") {
		secure = false
	}
	host = strings.TrimPrefix(strings.TrimPrefix(host, "https://"), "http://")
	c, err := minio.New(host, &minio.Options{Creds: credentials.NewStaticV4(access, secret, ""), Secure: secure, Region: region})
	if err != nil {
		return nil, err
	}
	return &S3{c: c, bucket: bucket}, nil
}

func (s *S3) Put(ctx context.Context, key, ct string, data []byte) error {
	_, err := s.c.PutObject(ctx, s.bucket, key, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{ContentType: ct})
	return err
}
func (s *S3) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	o, err := s.c.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	if _, err := o.Stat(); err != nil {
		_ = o.Close()
		if minio.ToErrorResponse(err).Code == "NoSuchKey" {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return o, nil
}
func (s *S3) Delete(ctx context.Context, key string) error {
	return s.c.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}
func (s *S3) SignedURL(ctx context.Context, key, ct string, ttl time.Duration) (string, error) {
	if ttl <= 0 {
		return "", errors.New("ttl must be positive")
	}
	q := url.Values{}
	q.Set("response-content-type", ct)
	u, err := s.c.PresignedGetObject(ctx, s.bucket, key, ttl, q)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}
