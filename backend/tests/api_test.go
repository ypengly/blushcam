// Integration tests: need PostgreSQL. Set TEST_DATABASE_URL (CI does); otherwise they are skipped.
package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/blushcam/backend/internal/config"
	"github.com/blushcam/backend/internal/handlers"
	"github.com/blushcam/backend/internal/httpx"
	"github.com/blushcam/backend/internal/imageclient"
	"github.com/blushcam/backend/internal/mail"
	"github.com/blushcam/backend/internal/storage"
	"github.com/blushcam/backend/internal/store"
	"github.com/blushcam/backend/migrations"
)

type client struct {
	t    *testing.T
	base string
	c    *http.Client
	csrf string
}

func newServer(t *testing.T) (*httptest.Server, config.Config) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	st, err := store.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(st.Close)
	if _, err := st.Pool.Exec(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`); err != nil {
		t.Fatal(err)
	}
	if _, err := st.Migrate(ctx, migrations.FS); err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{Env: "development", CookieName: "sess", SessionTTL: time.Hour, MaxBodyBytes: 1 << 20, MaxUploadBytes: 1 << 20, UserQuotaBytes: 1500, MaxImagePixels: 1_000_000,
		AuthRatePerMinute: 1000, ResetTTL: time.Minute, SigningSecret: strings.Repeat("s", 40), SignedURLTTL: time.Minute, PublicAppURL: "http://app.test", CORSOrigins: []string{"http://app.test"}, ImageServiceURL: "http://127.0.0.1:1"}
	signer := storage.NewSigner(cfg.SigningSecret)
	obj, _ := storage.NewLocal(t.TempDir(), signer)
	d := &handlers.Deps{Cfg: cfg, Store: st, Storage: obj, Signer: signer, Mailer: mail.New(cfg.SMTP), Images: imageclient.New(cfg.ImageServiceURL, time.Second), AIRate: httpx.NewRateLimiter(100, time.Minute)}
	srv := httptest.NewServer(handlers.Router(d))
	t.Cleanup(srv.Close)
	return srv, cfg
}

func newClient(t *testing.T, base string) *client {
	jar, _ := cookiejar.New(nil)
	return &client{t: t, base: base, c: &http.Client{Jar: jar, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
}

func (c *client) do(method, path string, body any, headers map[string]string) (int, map[string]any, []byte) {
	var rd io.Reader
	ct := ""
	switch b := body.(type) {
	case nil:
	case *bytes.Buffer:
		rd = b
	default:
		j, _ := json.Marshal(b)
		rd, ct = bytes.NewReader(j), "application/json"
	}
	req, _ := http.NewRequest(method, c.base+path, rd)
	if ct != "" {
		req.Header.Set("Content-Type", ct)
	}
	if c.csrf != "" && method != "GET" {
		req.Header.Set("X-CSRF-Token", c.csrf)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	res, err := c.c.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	var m map[string]any
	_ = json.Unmarshal(raw, &m)
	return res.StatusCode, m, raw
}

func (c *client) register(email string) {
	code, m, _ := c.do("POST", "/api/v1/auth/register", map[string]string{"email": email, "password": "blush-cam-2026"}, nil)
	if code != 201 {
		c.t.Fatalf("register %s: %d %v", email, code, m)
	}
	c.csrf = m["csrfToken"].(string)
}

func pngUpload(t *testing.T, w, h int) (*bytes.Buffer, string) {
	var img bytes.Buffer
	_ = png.Encode(&img, image.NewRGBA(image.Rect(0, 0, w, h)))
	return multipartBody(t, "file", "x.png", img.Bytes())
}
func multipartBody(t *testing.T, field, name string, data []byte) (*bytes.Buffer, string) {
	var b bytes.Buffer
	mw := multipart.NewWriter(&b)
	fw, _ := mw.CreateFormFile(field, name)
	_, _ = fw.Write(data)
	_ = mw.Close()
	return &b, mw.FormDataContentType()
}

func TestHealthAndReadiness(t *testing.T) {
	srv, _ := newServer(t)
	c := newClient(t, srv.URL)
	if code, _, _ := c.do("GET", "/healthz", nil, nil); code != 200 {
		t.Fatal(code)
	}
	code, m, _ := c.do("GET", "/readyz", nil, nil)
	if code != 200 || m["database"] != "up" || !strings.HasPrefix(m["imageService"].(string), "down") {
		t.Fatalf("readyz %d %v (image service is optional)", code, m)
	}
}

func TestAuthFlowAndSessionCookie(t *testing.T) {
	srv, _ := newServer(t)
	c := newClient(t, srv.URL)
	if code, _, _ := c.do("GET", "/api/v1/auth/me", nil, nil); code != 401 {
		t.Fatalf("anonymous me = %d", code)
	}
	if code, m, _ := c.do("POST", "/api/v1/auth/register", map[string]string{"email": "bad", "password": "x"}, nil); code != 422 || m["error"] == nil {
		t.Fatalf("validation: %d %v", code, m)
	}
	c.register("a@example.com")
	if code, _, _ := c.do("POST", "/api/v1/auth/register", map[string]string{"email": "A@example.com", "password": "blush-cam-2026"}, nil); code != 422 {
		t.Fatalf("duplicate email should be rejected case-insensitively, got %d", code)
	}
	code, m, _ := c.do("GET", "/api/v1/auth/me", nil, nil)
	if code != 200 || m["user"].(map[string]any)["email"] != "a@example.com" {
		t.Fatalf("me: %d %v", code, m)
	}
	// cookie flags
	res, _ := http.Post(srv.URL+"/api/v1/auth/login", "application/json", strings.NewReader(`{"email":"a@example.com","password":"blush-cam-2026"}`))
	ck := res.Cookies()
	if len(ck) != 1 || !ck[0].HttpOnly || ck[0].SameSite != http.SameSiteLaxMode {
		t.Fatalf("session cookie flags wrong: %+v", ck)
	}
	// wrong password and unknown email look identical
	c2 := newClient(t, srv.URL)
	code1, m1, _ := c2.do("POST", "/api/v1/auth/login", map[string]string{"email": "a@example.com", "password": "wrong-password-1"}, nil)
	code2, m2, _ := c2.do("POST", "/api/v1/auth/login", map[string]string{"email": "nobody@example.com", "password": "wrong-password-1"}, nil)
	if code1 != 401 || code2 != 401 || m1["error"].(map[string]any)["message"] != m2["error"].(map[string]any)["message"] {
		t.Fatalf("login errors must not reveal accounts: %v %v", m1, m2)
	}
	// logout invalidates the server-side session
	if code, _, _ := c.do("POST", "/api/v1/auth/logout", nil, nil); code != 204 {
		t.Fatalf("logout %d", code)
	}
	if code, _, _ := c.do("GET", "/api/v1/auth/me", nil, nil); code != 401 {
		t.Fatal("session still valid after logout")
	}
}

func TestPasswordResetDoesNotEnumerate(t *testing.T) {
	srv, _ := newServer(t)
	c := newClient(t, srv.URL)
	c.register("r@example.com")
	_, m1, _ := c.do("POST", "/api/v1/auth/forgot-password", map[string]string{"email": "r@example.com"}, nil)
	_, m2, _ := c.do("POST", "/api/v1/auth/forgot-password", map[string]string{"email": "ghost@example.com"}, nil)
	if m1["message"] != m2["message"] {
		t.Fatal("forgot-password response differs between existing and missing accounts")
	}
	if code, _, _ := c.do("POST", "/api/v1/auth/reset-password", map[string]string{"token": "nope", "password": "blush-cam-2026"}, nil); code != 400 {
		t.Fatalf("bad token: %d", code)
	}
}

func TestCSRFRequiredOnUnsafeMethods(t *testing.T) {
	srv, _ := newServer(t)
	c := newClient(t, srv.URL)
	c.register("c@example.com")
	good := c.csrf
	c.csrf = ""
	body := map[string]any{"name": "x", "projectType": "photo", "document": map[string]any{"docs": []any{map[string]any{}}}}
	if code, _, _ := c.do("POST", "/api/v1/projects", body, nil); code != 403 {
		t.Fatalf("missing CSRF token should be 403, got %d", code)
	}
	c.csrf = good
	if code, _, _ := c.do("POST", "/api/v1/projects", body, map[string]string{"Origin": "https://evil.test"}); code != 403 {
		t.Fatalf("foreign Origin should be 403, got %d", code)
	}
	if code, _, _ := c.do("POST", "/api/v1/projects", body, nil); code != 201 {
		t.Fatalf("valid create: %d", code)
	}
}

func TestProjectCRUDAndOwnership(t *testing.T) {
	srv, _ := newServer(t)
	alice, bob := newClient(t, srv.URL), newClient(t, srv.URL)
	alice.register("alice@example.com")
	bob.register("bob@example.com")
	doc := map[string]any{"docs": []any{map[string]any{"version": 1}}, "assets": map[string]string{}}
	code, m, _ := alice.do("POST", "/api/v1/projects", map[string]any{"name": "Strip", "projectType": "booth", "document": doc}, nil)
	if code != 201 {
		t.Fatalf("create %d %v", code, m)
	}
	id := m["id"].(string)
	// bob cannot see, edit, duplicate or delete alice's project — and gets 404, not 403
	for _, tc := range [][2]string{{"GET", ""}, {"PATCH", ""}, {"DELETE", ""}, {"POST", "/duplicate"}} {
		var body any
		if tc[0] == "PATCH" {
			body = map[string]any{"name": "hacked"}
		}
		if code, _, _ := bob.do(tc[0], "/api/v1/projects/"+id+tc[1], body, nil); code != 404 {
			t.Fatalf("bob %s%s => %d, want 404", tc[0], tc[1], code)
		}
	}
	if _, m, _ := bob.do("GET", "/api/v1/projects", nil, nil); len(m["projects"].([]any)) != 0 {
		t.Fatal("bob lists alice's projects")
	}
	if code, _, _ := alice.do("GET", "/api/v1/projects/not-a-uuid", nil, nil); code != 404 {
		t.Fatalf("bad id => %d", code)
	}
	// alice: update, duplicate, search/filter, delete
	if code, _, _ := alice.do("PATCH", "/api/v1/projects/"+id, map[string]any{"name": "Renamed"}, nil); code != 200 {
		t.Fatal("patch")
	}
	if code, _, _ := alice.do("POST", "/api/v1/projects/"+id+"/duplicate", nil, nil); code != 201 {
		t.Fatal("duplicate")
	}
	_, m, _ = alice.do("GET", "/api/v1/projects?q=renamed&type=booth", nil, nil)
	if len(m["projects"].([]any)) != 1 {
		t.Fatalf("search: %v", m)
	}
	_, m, _ = alice.do("GET", "/api/v1/projects?q=%25", nil, nil) // LIKE wildcard must be literal
	if len(m["projects"].([]any)) != 0 {
		t.Fatal("wildcard search should match nothing")
	}
	if code, _, _ := alice.do("POST", "/api/v1/projects", map[string]any{"name": "", "projectType": "nope", "document": map[string]any{}}, nil); code != 422 {
		t.Fatal("validation")
	}
	if code, _, _ := alice.do("DELETE", "/api/v1/projects/"+id, nil, nil); code != 204 {
		t.Fatal("delete")
	}
}

func TestUploadSecurityAndPrivacy(t *testing.T) {
	srv, _ := newServer(t)
	alice, bob := newClient(t, srv.URL), newClient(t, srv.URL)
	alice.register("alice@example.com")
	bob.register("bob@example.com")
	upload := func(c *client, b *bytes.Buffer, ct string) (int, map[string]any) {
		code, m, _ := c.do("POST", "/api/v1/assets", b, map[string]string{"Content-Type": ct})
		return code, m
	}
	// real PNG accepted
	b, ct := pngUpload(t, 10, 10)
	code, m := upload(alice, b, ct)
	if code != 201 {
		t.Fatalf("upload %d %v", code, m)
	}
	id, url := m["id"].(string), m["url"].(string)
	// HTML disguised as PNG, and a pixel bomb, are rejected
	b, ct = multipartBody(t, "file", "evil.png", []byte("<html><script>alert(1)</script></html>"))
	if code, _ := upload(alice, b, ct); code != 422 {
		t.Fatalf("fake image => %d", code)
	}
	b, ct = pngUpload(t, 1500, 1500)
	if code, _ := upload(alice, b, ct); code != 422 {
		t.Fatalf("pixel cap => %d", code)
	}
	// anonymous upload rejected
	anon := newClient(t, srv.URL)
	b, ct = pngUpload(t, 4, 4)
	if code, _ := upload(anon, b, ct); code != 401 {
		t.Fatalf("anon upload => %d", code)
	}
	// bob cannot read or delete alice's asset
	if code, _, _ := bob.do("GET", "/api/v1/assets/"+id, nil, nil); code != 404 {
		t.Fatalf("bob read => %d", code)
	}
	if code, _, _ := bob.do("DELETE", "/api/v1/assets/"+id, nil, nil); code != 404 {
		t.Fatalf("bob delete => %d", code)
	}
	// signed URL works, tampering/expiry do not
	if code, _, raw := alice.do("GET", url, nil, nil); code != 200 || len(raw) == 0 {
		t.Fatalf("signed url => %d", code)
	}
	if code, _, _ := anon.do("GET", url, nil, nil); code != 200 {
		t.Fatal("signed URL should work without a session (it is the credential)")
	}
	if code, _, _ := anon.do("GET", strings.Replace(url, "sig=", "sig=00", 1), nil, nil); code != 403 {
		t.Fatalf("tampered signature => %d", code)
	}
	if code, _, _ := anon.do("GET", "/api/v1/files/a_unknown.png?exp=1&sig=abc", nil, nil); code != 403 {
		t.Fatal("expired/invalid link must be 403")
	}
	// quota (1500 bytes) is enforced
	hit := false
	for i := 0; i < 20 && !hit; i++ {
		b, ct = pngUpload(t, 30+i, 30)
		if code, _ := upload(alice, b, ct); code == 507 {
			hit = true
		}
	}
	if !hit {
		t.Fatal("quota never enforced")
	}
}

func TestAIRequiresAuthConsentAndReportsUnavailable(t *testing.T) {
	srv, _ := newServer(t)
	c := newClient(t, srv.URL)
	code, m, _ := c.do("GET", "/api/v1/ai/capabilities", nil, nil)
	if code != 200 || m["serviceReachable"] != false {
		t.Fatalf("capabilities: %d %v", code, m)
	}
	for _, o := range m["operations"].([]any) {
		if o.(map[string]any)["available"] != false {
			t.Fatal("no operation may claim availability while the image service is down")
		}
	}
	b, ct := pngUpload(t, 4, 4)
	if code, _, _ := c.do("POST", "/api/v1/ai/process", b, map[string]string{"Content-Type": ct}); code != 401 {
		t.Fatalf("anon AI => %d", code)
	}
	c.register("ai@example.com")
	b, ct = pngUpload(t, 4, 4) // no consent field
	if code, m, _ := c.do("POST", "/api/v1/ai/process", b, map[string]string{"Content-Type": ct}); code != 400 || m["error"].(map[string]any)["code"] != "consent_required" {
		t.Fatalf("missing consent => %d %v", code, m)
	}
}
