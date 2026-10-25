// Package config loads all runtime configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env                 string
	Addr                string
	DatabaseURL         string
	CORSOrigins         []string
	PublicAppURL        string
	CookieName          string
	CookieSecure        bool
	SessionTTL          time.Duration
	MaxBodyBytes        int64
	MaxUploadBytes      int64
	UserQuotaBytes      int64
	MaxImagePixels      int64
	AuthRatePerMinute   int
	ResetTTL            time.Duration
	StorageProvider     string
	LocalStorageDir     string
	SigningSecret       string
	SignedURLTTL        time.Duration
	S3                  S3Config
	ImageServiceURL     string
	ImageServiceTimeout time.Duration
	SMTP                SMTPConfig
	TempUploadMaxAge    time.Duration
}

type S3Config struct{ Endpoint, Region, Bucket, AccessKey, SecretKey string }
type SMTPConfig struct {
	Host, User, Password, From string
	Port                       int
}

func (c Config) IsProd() bool { return c.Env == "production" }
func (c SMTPConfig) Enabled() bool { return c.Host != "" }

func Load() (Config, error) {
	c := Config{
		Env:                 get("APP_ENV", "development"),
		Addr:                get("API_ADDR", ":8080"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		CORSOrigins:         splitCSV(get("CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
		PublicAppURL:        get("PUBLIC_APP_URL", "http://localhost:3000"),
		CookieName:          get("SESSION_COOKIE_NAME", "blushcam_session"),
		CookieSecure:        getBool("COOKIE_SECURE", false),
		SessionTTL:          time.Duration(getInt("SESSION_TTL_HOURS", 168)) * time.Hour,
		MaxBodyBytes:        int64(getInt("MAX_BODY_BYTES", 1<<20)),
		MaxUploadBytes:      int64(getInt("MAX_UPLOAD_BYTES", 15<<20)),
		UserQuotaBytes:      int64(getInt("USER_QUOTA_BYTES", 500<<20)),
		MaxImagePixels:      int64(getInt("IMAGE_MAX_PIXELS", 40_000_000)),
		AuthRatePerMinute:   getInt("AUTH_RATE_PER_MINUTE", 10),
		ResetTTL:            time.Duration(getInt("PASSWORD_RESET_TTL_MINUTES", 30)) * time.Minute,
		StorageProvider:     get("STORAGE_PROVIDER", "local"),
		LocalStorageDir:     get("LOCAL_STORAGE_DIR", "./storage-data"),
		SigningSecret:       os.Getenv("STORAGE_SIGNING_SECRET"),
		SignedURLTTL:        time.Duration(getInt("SIGNED_URL_TTL_SECONDS", 300)) * time.Second,
		S3:                  S3Config{os.Getenv("S3_ENDPOINT"), os.Getenv("S3_REGION"), os.Getenv("S3_BUCKET"), os.Getenv("S3_ACCESS_KEY"), os.Getenv("S3_SECRET_KEY")},
		ImageServiceURL:     get("IMAGE_SERVICE_URL", "http://localhost:8000"),
		ImageServiceTimeout: time.Duration(getInt("IMAGE_SERVICE_TIMEOUT_SECONDS", 20)) * time.Second,
		SMTP:                SMTPConfig{Host: os.Getenv("SMTP_HOST"), User: os.Getenv("SMTP_USER"), Password: os.Getenv("SMTP_PASSWORD"), From: get("SMTP_FROM", "BlushCam <no-reply@localhost>"), Port: getInt("SMTP_PORT", 587)},
		TempUploadMaxAge:    24 * time.Hour,
	}
	return c, c.validate()
}

func (c Config) validate() error {
	var errs []string
	if c.DatabaseURL == "" {
		errs = append(errs, "DATABASE_URL is required")
	}
	if len(c.SigningSecret) < 32 {
		errs = append(errs, "STORAGE_SIGNING_SECRET must be at least 32 characters (generate with `openssl rand -hex 32`)")
	}
	if c.IsProd() && !c.CookieSecure {
		errs = append(errs, "COOKIE_SECURE must be true in production")
	}
	if c.StorageProvider != "local" && c.StorageProvider != "s3" {
		errs = append(errs, "STORAGE_PROVIDER must be local or s3")
	}
	if c.StorageProvider == "s3" && (c.S3.Bucket == "" || c.S3.AccessKey == "" || c.S3.SecretKey == "") {
		errs = append(errs, "S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY are required when STORAGE_PROVIDER=s3")
	}
	if len(errs) > 0 {
		return errors.New("invalid configuration: " + strings.Join(errs, "; "))
	}
	return nil
}

func get(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func getInt(k string, d int) int {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
		fmt.Fprintf(os.Stderr, "warning: %s is not an integer, using default %d\n", k, d)
	}
	return d
}
func getBool(k string, d bool) bool {
	if v := os.Getenv(k); v != "" {
		b, err := strconv.ParseBool(v)
		if err == nil {
			return b
		}
	}
	return d
}
func splitCSV(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
