// Package validation validates user-supplied values and uploaded images.
package validation

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"net/mail"
	"strings"
	"unicode/utf8"

	_ "golang.org/x/image/webp"
)

func Email(s string) (string, error) {
	s = strings.TrimSpace(s)
	if s == "" || len(s) > 254 {
		return "", errors.New("Enter a valid email address.")
	}
	a, err := mail.ParseAddress(s)
	if err != nil || a.Address != s || !strings.Contains(s[strings.LastIndex(s, "@"):], ".") {
		return "", errors.New("Enter a valid email address.")
	}
	return strings.ToLower(s), nil
}

func Password(p string) error {
	n := utf8.RuneCountInString(p)
	if n < 10 {
		return errors.New("Use at least 10 characters.")
	}
	if len(p) > 128 {
		return errors.New("Use at most 128 characters.")
	}
	var letter, digit bool
	for _, r := range p {
		switch {
		case r >= '0' && r <= '9':
			digit = true
		case (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || r > 127:
			letter = true
		}
	}
	if !letter || !digit {
		return errors.New("Include at least one letter and one number.")
	}
	return nil
}

func Name(s string, max int) (string, error) {
	s = strings.TrimSpace(s)
	if !utf8.ValidString(s) || utf8.RuneCountInString(s) > max || strings.ContainsAny(s, "\x00\r\n") {
		return "", fmt.Errorf("Use at most %d characters.", max)
	}
	return s, nil
}

var ProjectTypes = map[string]bool{"photo": true, "booth": true, "collage": true, "scrapbook": true}

type ImageInfo struct {
	Mime          string
	Width, Height int
}

var ErrUnsupportedImage = errors.New("Unsupported image. Use PNG, JPEG or WebP.")

// Image verifies the bytes really decode as PNG/JPEG/WebP (not trusting the client's MIME type or filename),
// enforces a pixel cap BEFORE a full decode (decompression-bomb protection), then fully decodes to catch corrupt files.
func Image(data []byte, maxPixels int64) (ImageInfo, error) {
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return ImageInfo{}, ErrUnsupportedImage
	}
	var mime string
	switch format {
	case "png":
		mime = "image/png"
	case "jpeg":
		mime = "image/jpeg"
	case "webp":
		mime = "image/webp"
	default:
		return ImageInfo{}, ErrUnsupportedImage
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || int64(cfg.Width)*int64(cfg.Height) > maxPixels {
		return ImageInfo{}, fmt.Errorf("That image is too large (limit %d megapixels).", maxPixels/1_000_000)
	}
	if _, _, err := image.Decode(bytes.NewReader(data)); err != nil {
		return ImageInfo{}, errors.New("That image file is corrupt.")
	}
	return ImageInfo{Mime: mime, Width: cfg.Width, Height: cfg.Height}, nil
}
