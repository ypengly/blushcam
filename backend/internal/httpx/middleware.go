package httpx

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"
)

type ctxKey int

const requestIDKey ctxKey = 1

func RequestID(ctx context.Context) string { v, _ := ctx.Value(requestIDKey).(string); return v }

func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-Id")
		if len(id) == 0 || len(id) > 64 || strings.ContainsAny(id, " \r\n") {
			b := make([]byte, 8)
			_, _ = rand.Read(b)
			id = hex.EncodeToString(b)
		}
		w.Header().Set("X-Request-Id", id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey, id)))
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (s *statusWriter) WriteHeader(c int) { s.status = c; s.ResponseWriter.WriteHeader(c) }

// Logger logs method, path (no query string, so tokens are never logged), status and duration. Never bodies or cookies.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(sw, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "status", sw.status, "ms", time.Since(start).Milliseconds(), "request_id", RequestID(r.Context()))
	})
}

func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("panic", "recovered", rec, "request_id", RequestID(r.Context()))
				Fail(w, r, NewError(500, "internal", "Something went wrong on our side."))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		next.ServeHTTP(w, r)
	})
}

// BodyLimit caps request bodies. Upload routes use their own, larger limit via LimitBody.
func BodyLimit(max int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, max)
			next.ServeHTTP(w, r)
		})
	}
}

// CORS allows only configured origins and supports credentials. The web app normally uses the same-origin proxy so this is a fallback.
func CORS(allowed []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && slices.Contains(allowed, origin) {
				h := w.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Credentials", "true")
				h.Set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token")
				h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
				h.Add("Vary", "Origin")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// OriginCheck is defence-in-depth CSRF protection: state-changing requests carrying an Origin header must come from an allowed origin.
func OriginCheck(allowed []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions {
				if o := r.Header.Get("Origin"); o != "" && !slices.Contains(allowed, o) {
					Fail(w, r, ErrCSRF)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RateLimiter is a small in-memory fixed-window limiter keyed by client IP. For multi-instance deployments, put a shared limiter in front.
type RateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	hits   map[string]*bucket
	now    func() time.Time
}
type bucket struct {
	n     int
	start time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{limit: limit, window: window, hits: map[string]*bucket{}, now: time.Now}
}

func (l *RateLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	t := l.now()
	b := l.hits[key]
	if b == nil || t.Sub(b.start) >= l.window {
		l.hits[key] = &bucket{n: 1, start: t}
		if len(l.hits) > 10000 { // opportunistic cleanup
			for k, v := range l.hits {
				if t.Sub(v.start) >= l.window {
					delete(l.hits, k)
				}
			}
		}
		return true
	}
	b.n++
	return b.n <= l.limit
}

func ClientIP(r *http.Request) string {
	// Only trust X-Forwarded-For if you run behind a proxy you control that overwrites it.
	if xf := r.Header.Get("X-Forwarded-For"); xf != "" {
		return strings.TrimSpace(strings.Split(xf, ",")[0])
	}
	h, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return h
}

func (l *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !l.Allow(ClientIP(r)) {
			w.Header().Set("Retry-After", "60")
			Fail(w, r, NewError(http.StatusTooManyRequests, "rate_limited", "Too many attempts. Please wait a minute and try again."))
			return
		}
		next.ServeHTTP(w, r)
	})
}
