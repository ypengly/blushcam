package validation

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

func pngBytes(w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	img.Set(0, 0, color.RGBA{255, 0, 0, 255})
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}

func TestEmail(t *testing.T) {
	if e, err := Email("  Foo@Example.COM "); err != nil || e != "foo@example.com" {
		t.Fatalf("%q %v", e, err)
	}
	for _, bad := range []string{"", "x", "a@b", "a b@c.de", "Name <a@b.co>"} {
		if _, err := Email(bad); err == nil {
			t.Errorf("%q should fail", bad)
		}
	}
}

func TestPassword(t *testing.T) {
	for _, bad := range []string{"short1", "onlyletterslong", "12345678901"} {
		if Password(bad) == nil {
			t.Errorf("%q should fail", bad)
		}
	}
	if Password("blush-cam-2026") != nil {
		t.Fatal("good password rejected")
	}
}

func TestImageAcceptsRealImages(t *testing.T) {
	info, err := Image(pngBytes(20, 10), 1_000_000)
	if err != nil || info.Mime != "image/png" || info.Width != 20 || info.Height != 10 {
		t.Fatalf("%+v %v", info, err)
	}
	var b bytes.Buffer
	_ = jpeg.Encode(&b, image.NewRGBA(image.Rect(0, 0, 8, 8)), nil)
	if info, err := Image(b.Bytes(), 1000); err != nil || info.Mime != "image/jpeg" {
		t.Fatalf("%+v %v", info, err)
	}
}

func TestImageRejectsFakesAndBombs(t *testing.T) {
	if _, err := Image([]byte("<script>alert(1)</script>"), 1e6); err == nil {
		t.Fatal("html accepted")
	}
	if _, err := Image([]byte("GIF89a....."), 1e6); err == nil {
		t.Fatal("gif/garbage accepted")
	}
	if _, err := Image(pngBytes(200, 200), 1000); err == nil {
		t.Fatal("pixel cap not enforced")
	}
	good := pngBytes(50, 50)
	if _, err := Image(good[:len(good)/2], 1e6); err == nil {
		t.Fatal("truncated image accepted")
	}
	if _, err := Image(nil, 1e6); err == nil {
		t.Fatal("empty accepted")
	}
}
