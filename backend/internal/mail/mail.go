// Package mail sends transactional email over SMTP. If SMTP isn't configured, Enabled() is false and
// callers must say so honestly rather than pretend a message was sent.
package mail

import (
	"fmt"
	"net/smtp"
	"strings"

	"github.com/blushcam/backend/internal/config"
)

type Mailer struct{ cfg config.SMTPConfig }

func New(cfg config.SMTPConfig) *Mailer { return &Mailer{cfg: cfg} }
func (m *Mailer) Enabled() bool         { return m.cfg.Enabled() }

func sanitizeHeader(s string) string { return strings.NewReplacer("\r", "", "\n", "").Replace(s) }

func (m *Mailer) Send(to, subject, body string) error {
	if !m.Enabled() {
		return fmt.Errorf("smtp not configured")
	}
	msg := "From: " + sanitizeHeader(m.cfg.From) + "\r\nTo: " + sanitizeHeader(to) + "\r\nSubject: " + sanitizeHeader(subject) +
		"\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n" + body
	var auth smtp.Auth
	if m.cfg.User != "" {
		auth = smtp.PlainAuth("", m.cfg.User, m.cfg.Password, m.cfg.Host)
	}
	return smtp.SendMail(fmt.Sprintf("%s:%d", m.cfg.Host, m.cfg.Port), auth, extractAddr(m.cfg.From), []string{to}, []byte(msg))
}

func extractAddr(from string) string {
	if i := strings.Index(from, "<"); i >= 0 {
		if j := strings.Index(from[i:], ">"); j > 0 {
			return from[i+1 : i+j]
		}
	}
	return from
}
