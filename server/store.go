package main

import (
	"crypto/subtle"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

var (
	errNotFound     = errors.New("not found")
	errCooldown     = errors.New("cooldown")
	errCodeInvalid  = errors.New("code invalid")
	errCodeExpired  = errors.New("code expired")
	errEmailTaken   = errors.New("email taken")
	errTooManyItems = errors.New("too many items")
)

const maxCodeAttempts = 5

type store struct{ db *sql.DB }

func openStore(path string) (*store, error) {
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}
	dsn := "file:" + path +
		"?_pragma=busy_timeout(5000)" +
		"&_pragma=journal_mode(WAL)" +
		"&_pragma=synchronous(NORMAL)" +
		"&_pragma=foreign_keys(1)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// Single connection: this service is tiny and write-mostly-serial, and
	// it removes any SQLITE_BUSY reasoning entirely.
	db.SetMaxOpenConns(1)
	st := &store{db: db}
	if err := st.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return st, nil
}

func (s *store) close() { _ = s.db.Close() }

func (s *store) migrate() error {
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS email_codes (
  email        TEXT NOT NULL,
  purpose      TEXT NOT NULL,
  code_hash    TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_sent_at INTEGER NOT NULL,
  PRIMARY KEY (email, purpose)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS user_items (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type  TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  status     TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_items_user ON user_items(user_id);
`)
	return err
}

// ---- users -------------------------------------------------------------

type user struct {
	ID           int64
	Email        string
	PasswordHash string
	DisplayName  string
	CreatedAt    int64
}

func (s *store) userByEmail(email string) (*user, error) {
	row := s.db.QueryRow(
		`SELECT id, email, password_hash, display_name, created_at FROM users WHERE email = ?`, email)
	var u user
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.DisplayName, &u.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (s *store) userExists(email string) (bool, error) {
	var one int
	err := s.db.QueryRow(`SELECT 1 FROM users WHERE email = ?`, email).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *store) createUser(email, passwordHash, displayName string) (*user, error) {
	now := time.Now().Unix()
	res, err := s.db.Exec(
		`INSERT INTO users (email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)`,
		email, passwordHash, displayName, now)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return &user{ID: id, Email: email, PasswordHash: passwordHash, DisplayName: displayName, CreatedAt: now}, nil
}

func (s *store) setPassword(userID int64, passwordHash string) error {
	_, err := s.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, passwordHash, userID)
	return err
}

// ---- email codes -------------------------------------------------------

type codeRow struct {
	CodeHash   string
	Attempts   int
	ExpiresAt  int64
	LastSentAt int64
}

func (s *store) getCode(email, purpose string) (*codeRow, error) {
	row := s.db.QueryRow(
		`SELECT code_hash, attempts, expires_at, last_sent_at FROM email_codes WHERE email = ? AND purpose = ?`,
		email, purpose)
	var c codeRow
	if err := row.Scan(&c.CodeHash, &c.Attempts, &c.ExpiresAt, &c.LastSentAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errNotFound
		}
		return nil, err
	}
	return &c, nil
}

// saveCode atomically enforces the per-email+purpose resend cooldown and
// persists the new code: the SELECT only produces a row when no live row
// was sent inside the cooldown window, so a blocked request is a silent
// zero-row insert — detected via RowsAffected and reported as errCooldown
// (→ 429). Statements run serialized on the single connection, so two
// concurrent send-code requests can never both reach the mailer; a
// check-then-insert split had both passing the check and sending two mails.
func (s *store) saveCode(email, purpose, codeHash string, ttl, cooldown time.Duration) error {
	now := time.Now().Unix()
	res, err := s.db.Exec(`
INSERT INTO email_codes (email, purpose, code_hash, attempts, created_at, expires_at, last_sent_at)
SELECT ?, ?, ?, 0, ?, ?, ?
WHERE NOT EXISTS (
  SELECT 1 FROM email_codes
  WHERE email = ? AND purpose = ? AND ? - last_sent_at < ?
)
ON CONFLICT (email, purpose) DO UPDATE SET
  code_hash = excluded.code_hash,
  attempts = 0,
  created_at = excluded.created_at,
  expires_at = excluded.expires_at,
  last_sent_at = excluded.last_sent_at`,
		email, purpose, codeHash, now, now+int64(ttl.Seconds()), now,
		email, purpose, now, int64(cooldown.Seconds()))
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errCooldown
	}
	return nil
}

// verifyCode consumes a correct code; wrong attempts count up to
// maxCodeAttempts before the code is dead.
func (s *store) verifyCode(email, purpose, code string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var c codeRow
	err = tx.QueryRow(`SELECT code_hash, attempts, expires_at FROM email_codes WHERE email = ? AND purpose = ?`, email, purpose).Scan(&c.CodeHash, &c.Attempts, &c.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return errCodeInvalid
	}
	if err != nil {
		return err
	}
	result := error(nil)
	switch {
	case c.Attempts >= maxCodeAttempts:
		result = errCodeInvalid
	case time.Now().Unix() > c.ExpiresAt:
		result = errCodeExpired
	case subtle.ConstantTimeCompare([]byte(sha256Hex(code)), []byte(c.CodeHash)) != 1:
		if _, err := tx.Exec(`UPDATE email_codes SET attempts = attempts + 1 WHERE email = ? AND purpose = ?`, email, purpose); err != nil {
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		return errCodeInvalid
	}
	if _, err := tx.Exec(`DELETE FROM email_codes WHERE email = ? AND purpose = ?`, email, purpose); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return result
}

func (s *store) deleteCode(email, purpose string) error {
	_, err := s.db.Exec(`DELETE FROM email_codes WHERE email = ? AND purpose = ?`, email, purpose)
	return err
}

// ---- sessions ----------------------------------------------------------

func (s *store) createSession(userID int64, ttl time.Duration) (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}
	now := time.Now().Unix()
	_, err = s.db.Exec(
		`INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)`,
		sha256Hex(token), userID, now, now+int64(ttl.Seconds()), now)
	if err != nil {
		return "", err
	}
	return token, nil
}

// sessionUser resolves a bearer token to its user, applying sliding
// renewal: once less than half the TTL remains, the window is extended.
func (s *store) sessionUser(token string, ttl time.Duration) (*user, error) {
	hash := sha256Hex(token)
	row := s.db.QueryRow(`
SELECT u.id, u.email, u.password_hash, u.display_name, u.created_at, s.expires_at
FROM sessions s JOIN users u ON u.id = s.user_id
WHERE s.token_hash = ?`, hash)
	var u user
	var expiresAt int64
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.DisplayName, &u.CreatedAt, &expiresAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errNotFound
		}
		return nil, err
	}
	now := time.Now().Unix()
	if now > expiresAt {
		_ = s.deleteSessionByHash(hash)
		return nil, errNotFound
	}
	if expiresAt-now < int64(ttl.Seconds()/2) {
		_, _ = s.db.Exec(
			`UPDATE sessions SET expires_at = ?, last_seen_at = ? WHERE token_hash = ?`,
			now+int64(ttl.Seconds()), now, hash)
	}
	return &u, nil
}

func (s *store) deleteSessionByHash(hash string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE token_hash = ?`, hash)
	return err
}

func (s *store) revokeSessions(userID int64) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE user_id = ?`, userID)
	return err
}

// ---- user items --------------------------------------------------------

type itemEntry struct {
	ItemType  string `json:"itemType"`
	ItemID    string `json:"itemId"`
	Status    string `json:"status"`
	UpdatedAt int64  `json:"updatedAt"`
}

func (s *store) listItems(userID int64) ([]itemEntry, error) {
	return s.listItemsWithDeleted(userID, false)
}

func (s *store) listItemsWithDeleted(userID int64, includeDeleted bool) ([]itemEntry, error) {
	rows, err := s.db.Query(
		`SELECT item_type, item_id, status, updated_at FROM user_items WHERE user_id = ? AND (status <> '' OR ?) ORDER BY updated_at DESC`,
		userID, includeDeleted)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []itemEntry{}
	for rows.Next() {
		var it itemEntry
		if err := rows.Scan(&it.ItemType, &it.ItemID, &it.Status, &it.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// applyItems merges client entries last-writer-wins per item key: an
// incoming entry only applies when it is not older than the stored one.
// The stored updated_at keeps the client action time (already sanitized by
// the handler), so merge ordering stays anchored to when the user acted,
// not to when a sync happened to arrive. Empty status deletes the row.
// Returns the authoritative list.
func (s *store) applyItems(userID int64, items []itemEntry, maxItems int) ([]itemEntry, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	for _, in := range items {
		var existingMS int64
		var existingStatus string
		err := tx.QueryRow(
			`SELECT updated_at, status FROM user_items WHERE user_id = ? AND item_type = ? AND item_id = ?`,
			userID, in.ItemType, in.ItemID).Scan(&existingMS, &existingStatus)
		if errors.Is(err, sql.ErrNoRows) {
			if _, err := tx.Exec(
				`INSERT INTO user_items (user_id, item_type, item_id, status, updated_at) VALUES (?, ?, ?, ?, ?)`,
				userID, in.ItemType, in.ItemID, in.Status, in.UpdatedAt); err != nil {
				return nil, err
			}
			continue
		}
		if err != nil {
			return nil, err
		}
		if in.UpdatedAt < existingMS || (in.UpdatedAt == existingMS && existingStatus == "" && in.Status != "") {
			continue // stale client entry loses
		}
		if _, err := tx.Exec(
			`UPDATE user_items SET status = ?, updated_at = ? WHERE user_id = ? AND item_type = ? AND item_id = ?`,
			in.Status, in.UpdatedAt, userID, in.ItemType, in.ItemID); err != nil {
			return nil, err
		}
	}

	var count int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM user_items WHERE user_id = ? AND status <> ''`, userID).Scan(&count); err != nil {
		return nil, err
	}
	if count > maxItems {
		return nil, errTooManyItems
	}
	// Keep tombstones indefinitely to prevent stale clients resurrecting data,
	// but bound total rows as well as visible marks. Reject atomically at capacity.
	if err := tx.QueryRow(`SELECT COUNT(*) FROM user_items WHERE user_id = ?`, userID).Scan(&count); err != nil {
		return nil, err
	}
	if count > 10000 {
		return nil, errTooManyItems
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return s.listItems(userID)
}
