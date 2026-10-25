package auth

import (
	"strings"
	"testing"
)

func TestHashAndVerify(t *testing.T) {
	h, err := HashPassword("correct horse 42")
	if err != nil || !strings.HasPrefix(h, "$argon2id$") {
		t.Fatalf("hash: %v %q", err, h)
	}
	if strings.Contains(h, "correct horse") {
		t.Fatal("hash must not contain the plaintext")
	}
	ok, err := VerifyPassword("correct horse 42", h)
	if err != nil || !ok {
		t.Fatalf("verify good: %v %v", ok, err)
	}
	if ok, _ := VerifyPassword("wrong password 1", h); ok {
		t.Fatal("wrong password accepted")
	}
	h2, _ := HashPassword("correct horse 42")
	if h == h2 {
		t.Fatal("salts must differ")
	}
}

func TestVerifyRejectsMalformed(t *testing.T) {
	for _, bad := range []string{"", "plaintext", "$argon2id$v=19$m=0,t=0,p=0$AA$AA", "$bcrypt$a$b$c$d"} {
		if ok, err := VerifyPassword("x", bad); ok || err == nil {
			t.Errorf("%q should error", bad)
		}
	}
}

func TestTokens(t *testing.T) {
	a, ah, _ := NewToken()
	b, _, _ := NewToken()
	if a == b || len(a) < 40 {
		t.Fatal("tokens must be unique and long")
	}
	if string(HashToken(a)) != string(ah) || string(HashToken(b)) == string(ah) {
		t.Fatal("hash mismatch")
	}
	if !CSRFEqual("abc", "abc") || CSRFEqual("abc", "abd") || CSRFEqual("", "") {
		t.Fatal("csrf compare")
	}
}
