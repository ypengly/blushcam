package storage

import (
	"context"
	"testing"
	"time"
)

func TestSigner(t *testing.T) {
	s := NewSigner("0123456789abcdef0123456789abcdef")
	now := time.Unix(1_700_000_000, 0)
	exp, sig := s.Sign("a_1.png", time.Minute, now)
	es := "1700000060"
	if exp != 1_700_000_060 {
		t.Fatal(exp)
	}
	if !s.Verify("a_1.png", es, sig, now) {
		t.Fatal("valid signature rejected")
	}
	if s.Verify("a_2.png", es, sig, now) {
		t.Fatal("signature must be bound to key")
	}
	if s.Verify("a_1.png", es, sig, now.Add(2*time.Minute)) {
		t.Fatal("expired signature accepted")
	}
	if s.Verify("a_1.png", "1700009999", sig, now) {
		t.Fatal("tampered expiry accepted")
	}
	if NewSigner("other-secret-other-secret-other-1").Verify("a_1.png", es, sig, now) {
		t.Fatal("different secret accepted")
	}
}

func TestLocalRejectsTraversal(t *testing.T) {
	l, err := NewLocal(t.TempDir(), NewSigner("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	for _, k := range []string{"../x", "a/../../x", "/etc/passwd", "a\\b", ""} {
		if err := l.Put(ctx, k, "image/png", []byte("x")); err == nil {
			t.Errorf("key %q should be rejected", k)
		}
	}
	if err := l.Put(ctx, "a_ok.png", "image/png", []byte("hi")); err != nil {
		t.Fatal(err)
	}
	rc, err := l.Get(ctx, "a_ok.png")
	if err != nil {
		t.Fatal(err)
	}
	rc.Close()
	if err := l.Delete(ctx, "a_ok.png"); err != nil {
		t.Fatal(err)
	}
	if _, err := l.Get(ctx, "a_ok.png"); err != ErrNotFound {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}
