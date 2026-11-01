package main

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

// Exercise the HTTP protocol against both a new file and the schema used before
// tombstones were introduced. Seed sessions directly; email delivery is unrelated.
func TestAccountSyncSQLiteCompatibility(t *testing.T) {
	for _, legacy := range []bool{false, true} {
		t.Run(fmt.Sprintf("legacy=%v", legacy), func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "account.db")
			if legacy {
				db, err := sql.Open("sqlite", path)
				if err != nil {
					t.Fatal(err)
				}
				_, err = db.Exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active');
CREATE TABLE user_items (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_type TEXT NOT NULL, item_id TEXT NOT NULL, status TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(user_id,item_type,item_id));
INSERT INTO users (id,email,password_hash,created_at) VALUES (1,'legacy@example.com','hash',1);
INSERT INTO user_items VALUES (1,'perk','legacy','wanted',100);`)
				if err != nil {
					t.Fatal(err)
				}
				if err = db.Close(); err != nil {
					t.Fatal(err)
				}
			}
			st, err := openStore(path)
			if err != nil {
				t.Fatal(err)
			}
			if !legacy {
				if _, err := st.createUser("new@example.com", "hash", "new"); err != nil {
					t.Fatal(err)
				}
			}
			other, err := st.createUser("other@example.com", "hash", "other")
			if err != nil {
				t.Fatal(err)
			}
			token, err := st.createSession(1, time.Hour)
			if err != nil {
				t.Fatal(err)
			}
			otherToken, err := st.createSession(other.ID, time.Hour)
			if err != nil {
				t.Fatal(err)
			}
			cfg := LoadConfig()
			cfg.TokenTTL = time.Hour
			srv := NewServer(cfg, st, &captureMailer{}, log.New(io.Discard, "", 0))
			ts := httptest.NewServer(srv.Handler())
			request := func(method, query, auth string, entries ...itemEntry) (int, map[string]any) {
				t.Helper()
				var body any
				if method == "PUT" {
					body = map[string]any{"items": entries}
				}
				return doJSON(t, ts, method, "/api/my/items"+query, auth, body)
			}
			check := func(status int, out map[string]any, want int, capability bool) []any {
				t.Helper()
				if status != want {
					t.Fatalf("status=%d want=%d body=%v", status, want, out)
				}
				if want != 200 {
					return nil
				}
				if (out["tombstoneProtocol"] == float64(1)) != capability {
					t.Fatalf("capability: %v", out)
				}
				items, ok := out["items"].([]any)
				if !ok {
					t.Fatalf("items: %v", out)
				}
				return items
			}
			if legacy {
				s, o := request("GET", "", token)
				items := check(s, o, 200, false)
				if len(items) != 1 || items[0].(map[string]any)["itemId"] != "legacy" {
					t.Fatalf("legacy data lost: %v", o)
				}
			}
			mark := itemEntry{ItemType: "perk", ItemID: "shared", Status: "wanted", UpdatedAt: 1000}
			deletion := itemEntry{ItemType: "perk", ItemID: "shared", Status: "", UpdatedAt: 2000}
			s, o := request("PUT", "", token, mark)
			check(s, o, 200, false)
			s, o = request("PUT", "?includeDeleted=1", token, deletion)
			items := check(s, o, 200, true)
			found := false
			for _, raw := range items {
				item := raw.(map[string]any)
				if item["itemId"] == "shared" && item["status"] == "" {
					found = true
				}
			}
			if !found {
				t.Fatalf("missing tombstone: %v", o)
			}
			// A stale old client cannot resurrect the deleted entry; its response hides tombstones.
			s, o = request("PUT", "", token, mark)
			items = check(s, o, 200, false)
			for _, raw := range items {
				if raw.(map[string]any)["itemId"] == "shared" {
					t.Fatalf("stale resurrection: %v", o)
				}
			}
			s, o = request("GET", "?includeDeleted=1", otherToken)
			if len(check(s, o, 200, true)) != 0 {
				t.Fatalf("cross-account leakage: %v", o)
			}
			s, o = request("GET", "?includeDeleted=1", "invalid")
			check(s, o, 401, false)
			// Invalid entries reject the entire batch, rather than partially writing.
			s, o = request("PUT", "?includeDeleted=1", token, itemEntry{ItemType: "perk", ItemID: "valid", Status: "wanted", UpdatedAt: 3000}, itemEntry{ItemType: "invalid", ItemID: "bad", Status: "wanted", UpdatedAt: 3000})
			check(s, o, 400, false)
			s, o = request("GET", "?includeDeleted=1", token)
			items = check(s, o, 200, true)
			for _, raw := range items {
				if raw.(map[string]any)["itemId"] == "valid" {
					t.Fatalf("partial write: %v", o)
				}
			}
			ts.Close()
			if err := srv.Close(context.Background()); err != nil {
				t.Fatal(err)
			}
			st.close()
			// A restart must preserve both the deletion and existing legacy data.
			st, err = openStore(path)
			if err != nil {
				t.Fatal(err)
			}
			defer st.close()
			rows, err := st.listItemsWithDeleted(1, true)
			if err != nil {
				t.Fatal(err)
			}
			found = false
			for _, row := range rows {
				if row.ItemID == "shared" && row.Status == "" && row.UpdatedAt == 2000 {
					found = true
				}
			}
			if !found {
				t.Fatalf("tombstone lost on restart: %v", rows)
			}
		})
	}
}

func TestAccountSyncRequestBoundaries(t *testing.T) {
	ts, mailer := newTestServer(t)
	token := registerUser(t, ts, mailer, "boundaries@example.com", "password123")
	for _, tc := range []struct {
		name    string
		entries []itemEntry
	}{
		{"bad status", []itemEntry{{ItemType: "perk", ItemID: "x", Status: "bogus", UpdatedAt: 1}}},
		{"empty id", []itemEntry{{ItemType: "perk", ItemID: "", Status: "wanted", UpdatedAt: 1}}},
		{"too many", make([]itemEntry, maxItemsPerRequest+1)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			status, out := doJSON(t, ts, http.MethodPut, "/api/my/items?includeDeleted=1", token, map[string]any{"items": tc.entries})
			if status != 400 {
				t.Fatalf("status=%d body=%v", status, out)
			}
		})
	}
	status, out := doJSON(t, ts, http.MethodGet, "/api/my/items?includeDeleted=1", token, nil)
	if status != 200 || len(out["items"].([]any)) != 0 {
		t.Fatalf("unexpected writes: %d %v", status, out)
	}
}
