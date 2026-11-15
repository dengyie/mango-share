package main

import (
	"path/filepath"
	"testing"
	"time"
)

// purgeExpired must drop expired sessions and email codes while leaving
// live rows untouched.
func TestPurgeExpiredRows(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()

	now := time.Now().Unix()
	seed := func(table, cols string, vals ...any) {
		t.Helper()
		q := "INSERT INTO " + table + " (" + cols + ") VALUES (" + placeholders(len(vals)) + ")"
		if _, err := st.db.Exec(q, vals...); err != nil {
			t.Fatalf("seed %s: %v", table, err)
		}
	}
	seed("users", "email, password_hash, display_name, created_at", "u@x.com", "h", "", now)
	seed("sessions", "token_hash, user_id, created_at, expires_at, last_seen_at", "live", 1, now, now+3600, now)
	seed("sessions", "token_hash, user_id, created_at, expires_at, last_seen_at", "dead", 1, now, now-1, now)
	seed("email_codes", "email, purpose, code_hash, attempts, created_at, expires_at, last_sent_at",
		"u@x.com", "register", "h", 0, now, now+600, now)
	seed("email_codes", "email, purpose, code_hash, attempts, created_at, expires_at, last_sent_at",
		"u@x.com", "reset", "h", 0, now, now-1, now)

	if err := st.purgeExpired(); err != nil {
		t.Fatal(err)
	}
	count := func(table, where string) int {
		t.Helper()
		var n int
		if err := st.db.QueryRow("SELECT COUNT(*) FROM " + table + " WHERE " + where).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	if n := count("sessions", "token_hash = 'live'"); n != 1 {
		t.Fatalf("live session deleted: %d", n)
	}
	if n := count("sessions", "token_hash = 'dead'"); n != 0 {
		t.Fatalf("expired session survived: %d", n)
	}
	if n := count("email_codes", "purpose = 'register'"); n != 1 {
		t.Fatalf("live email code deleted: %d", n)
	}
	if n := count("email_codes", "purpose = 'reset'"); n != 0 {
		t.Fatalf("expired email code survived: %d", n)
	}
}

func placeholders(n int) string {
	s := ""
	for i := 0; i < n; i++ {
		if i > 0 {
			s += ", "
		}
		s += "?"
	}
	return s
}
