package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

type User struct {
	ID           string
	Email        string
	PasswordHash string
	DisplayName  string
	CreatedAt    time.Time
}

type Session struct {
	ID        string
	UserID    string
	CSRF      string
	ExpiresAt time.Time
}

type Prefs struct {
	Theme         string `json:"theme"`
	MirrorPreview bool   `json:"mirrorPreview"`
	DefaultExport string `json:"defaultExport"`
	AIConsent     bool   `json:"aiConsent"`
}

func (s *Store) CreateUser(ctx context.Context, email, hash, name string) (User, error) {
	var u User
	err := s.Pool.QueryRow(ctx, `INSERT INTO users(email,password_hash,display_name) VALUES($1,$2,$3) RETURNING id,email,password_hash,display_name,created_at`, email, hash, name).
		Scan(&u.ID, &u.Email, &u.PasswordHash, &u.DisplayName, &u.CreatedAt)
	if isUnique(err) {
		return User{}, ErrDuplicate
	}
	return u, err
}

func (s *Store) UserByEmail(ctx context.Context, email string) (User, error) {
	var u User
	err := s.Pool.QueryRow(ctx, `SELECT id,email,password_hash,display_name,created_at FROM users WHERE email=$1`, email).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.DisplayName, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

func (s *Store) UserByID(ctx context.Context, id string) (User, error) {
	var u User
	err := s.Pool.QueryRow(ctx, `SELECT id,email,password_hash,display_name,created_at FROM users WHERE id=$1`, id).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.DisplayName, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

func (s *Store) UpdateDisplayName(ctx context.Context, id, name string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE users SET display_name=$2, updated_at=now() WHERE id=$1`, id, name)
	return err
}

func (s *Store) SetPassword(ctx context.Context, id, hash string) error {
	return s.Tx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE users SET password_hash=$2, updated_at=now() WHERE id=$1`, id, hash); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `DELETE FROM sessions WHERE user_id=$1`, id) // sign out everywhere after a password change
		return err
	})
}

// DeleteUser removes the user; FK cascades delete sessions, projects, assets rows. Caller deletes the stored objects first (keys from AssetKeys).
func (s *Store) DeleteUser(ctx context.Context, id string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, id)
	return err
}

func (s *Store) CreateSession(ctx context.Context, userID string, tokenHash []byte, csrf, ua string, ttl time.Duration) error {
	if len(ua) > 200 {
		ua = ua[:200]
	}
	_, err := s.Pool.Exec(ctx, `INSERT INTO sessions(user_id,token_hash,csrf_token,user_agent,expires_at) VALUES($1,$2,$3,$4,now()+make_interval(secs => $5))`, userID, tokenHash, csrf, ua, ttl.Seconds())
	return err
}

func (s *Store) SessionByTokenHash(ctx context.Context, h []byte) (Session, error) {
	var se Session
	err := s.Pool.QueryRow(ctx, `SELECT id,user_id,csrf_token,expires_at FROM sessions WHERE token_hash=$1 AND expires_at>now()`, h).Scan(&se.ID, &se.UserID, &se.CSRF, &se.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Session{}, ErrNotFound
	}
	return se, err
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash []byte) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash=$1`, tokenHash)
	return err
}

func (s *Store) CreateReset(ctx context.Context, userID string, tokenHash []byte, ttl time.Duration) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES($1,$2,now()+make_interval(secs => $3))`, userID, tokenHash, ttl.Seconds())
	return err
}

// ConsumeReset atomically marks a valid unused token as used and returns its user id (single-use).
func (s *Store) ConsumeReset(ctx context.Context, tokenHash []byte) (string, error) {
	var uid string
	err := s.Pool.QueryRow(ctx, `UPDATE password_resets SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING user_id`, tokenHash).Scan(&uid)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return uid, err
}

func (s *Store) GetPrefs(ctx context.Context, uid string) (Prefs, error) {
	p := Prefs{Theme: "light", MirrorPreview: true, DefaultExport: "png"}
	err := s.Pool.QueryRow(ctx, `SELECT theme,mirror_preview,default_export,ai_consent FROM user_preferences WHERE user_id=$1`, uid).Scan(&p.Theme, &p.MirrorPreview, &p.DefaultExport, &p.AIConsent)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, nil
	}
	return p, err
}

func (s *Store) PutPrefs(ctx context.Context, uid string, p Prefs) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO user_preferences(user_id,theme,mirror_preview,default_export,ai_consent) VALUES($1,$2,$3,$4,$5)
		ON CONFLICT (user_id) DO UPDATE SET theme=$2,mirror_preview=$3,default_export=$4,ai_consent=$5,updated_at=now()`, uid, p.Theme, p.MirrorPreview, p.DefaultExport, p.AIConsent)
	return err
}

// Cleanup removes expired sessions/reset tokens. Call periodically.
func (s *Store) Cleanup(ctx context.Context) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM sessions WHERE expires_at<now(); DELETE FROM password_resets WHERE expires_at<now()-interval '1 day'`)
	return err
}
