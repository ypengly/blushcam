package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRateLimiter(t *testing.T) {
	l := NewRateLimiter(3, time.Minute)
	now := time.Unix(0, 0)
	l.now = func() time.Time { return now }
	for i := 0; i < 3; i++ {
		if !l.Allow("ip") {
			t.Fatal("should allow")
		}
	}
	if l.Allow("ip") || !l.Allow("other") {
		t.Fatal("limit per key")
	}
	now = now.Add(61 * time.Second)
	if !l.Allow("ip") {
		t.Fatal("window should reset")
	}
}

func TestDecodeRejectsUnknownFieldsAndTrailing(t *testing.T) {
	var v struct{ A string }
	for _, body := range []string{`{"A":"x","B":1}`, `{"A":"x"} {}`, `nope`} {
		r := httptest.NewRequest("POST", "/", strings.NewReader(body))
		if Decode(r, &v) == nil {
			t.Errorf("%s should fail", body)
		}
	}
	if Decode(httptest.NewRequest("POST", "/", strings.NewReader(`{"A":"x"}`)), &v) != nil || v.A != "x" {
		t.Fatal("valid body failed")
	}
}

func TestOriginCheckBlocksCrossSiteWrites(t *testing.T) {
	h := OriginCheck([]string{"https://app.test"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	do := func(method, origin string) int {
		r := httptest.NewRequest(method, "/", nil)
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w.Code
	}
	if do("POST", "https://evil.test") != 403 || do("POST", "https://app.test") != 200 || do("POST", "") != 200 || do("GET", "https://evil.test") != 200 {
		t.Fatal("origin check wrong")
	}
}

func TestBodyLimit(t *testing.T) {
	h := BodyLimit(10)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var v map[string]any
		if err := Decode(r, &v); err != nil {
			Fail(w, r, err)
			return
		}
		w.WriteHeader(200)
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("POST", "/", strings.NewReader(`{"a":"`+strings.Repeat("x", 100)+`"}`)))
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("got %d", w.Code)
	}
}
