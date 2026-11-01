package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

func TestItemsDeletionRejectsStaleResurrection(t *testing.T) {
	s, err := openStore(filepath.Join(t.TempDir(), "items.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.close()
	u, err := s.createUser("items@example.com", "hash", "items")
	if err != nil {
		t.Fatal(err)
	}
	mark := itemEntry{ItemType: "perk", ItemID: "p", Status: "wanted", UpdatedAt: 100}
	deletion := itemEntry{ItemType: "perk", ItemID: "p", Status: "", UpdatedAt: 200}
	for _, e := range []itemEntry{mark, deletion, mark} {
		if _, err := s.applyItems(u.ID, []itemEntry{e}, 10); err != nil {
			t.Fatal(err)
		}
	}
	items, err := s.listItems(u.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 0 {
		t.Fatalf("stale mark resurrected deleted item: %+v", items)
	}
}

func TestItemsTombstonesHaveBoundedStorage(t *testing.T) {
	s, err := openStore(filepath.Join(t.TempDir(), "bound.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.close()
	u, err := s.createUser("bound@example.com", "hash", "bound")
	if err != nil {
		t.Fatal(err)
	}
	// Build the full capacity through the real merge path in batches. Applying
	// one entry per transaction repeatedly scans all existing rows for capacity.
	for start := 0; start < 10000; start += 500 {
		entries := make([]itemEntry, 0, 500)
		for i := start; i < start+500; i++ {
			entries = append(entries, itemEntry{ItemType: "perk", ItemID: fmt.Sprint(i), Status: "", UpdatedAt: 1})
		}
		if _, err := s.applyItems(u.ID, entries, 2000); err != nil {
			t.Fatalf("populate tombstones at %d: %v", start, err)
		}
	}
	_, err = s.applyItems(u.ID, []itemEntry{{ItemType: "perk", ItemID: "overflow", Status: "", UpdatedAt: 1}}, 2000)
	if !errors.Is(err, errTooManyItems) {
		t.Fatalf("expected capacity error, got %v", err)
	}
	var count int
	if err := s.db.QueryRow("SELECT COUNT(*) FROM user_items WHERE user_id = ?", u.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 10000 {
		t.Fatalf("expected 10000 tombstones after rejected overflow, got %d", count)
	}
}

func TestItemsAPITotalCapacity(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "capacity.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	u, err := st.createUser("capacity@example.com", "hash", "capacity")
	if err != nil {
		t.Fatal(err)
	}
	token, err := st.createSession(u.ID, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	// Seed through the merge path; HTTP requests below exercise the actual API.
	for start := 0; start < 10000; start += 500 {
		entries := make([]itemEntry, 500)
		for i := range entries {
			entries[i] = itemEntry{ItemType: "perk", ItemID: fmt.Sprint(start + i), UpdatedAt: 100}
		}
		if _, err := st.applyItems(u.ID, entries, maxItemsPerUser); err != nil {
			t.Fatal(err)
		}
	}
	srv := NewServer(LoadConfig(), st, &captureMailer{}, log.New(io.Discard, "", 0))
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()
	defer srv.Close(context.Background())
	put := func(entries ...itemEntry) (int, map[string]any) {
		t.Helper()
		return doJSON(t, ts, http.MethodPut, "/api/my/items", token, map[string]any{"items": entries})
	}
	checkRow := func(id, status string, updated int64) {
		t.Helper()
		var gotStatus string
		var gotUpdated int64
		if err := st.db.QueryRow(`SELECT status, updated_at FROM user_items WHERE user_id = ? AND item_type = 'perk' AND item_id = ?`, u.ID, id).Scan(&gotStatus, &gotUpdated); err != nil {
			t.Fatal(err)
		}
		if gotStatus != status || gotUpdated != updated {
			t.Fatalf("row %s = (%q, %d), want (%q, %d)", id, gotStatus, gotUpdated, status, updated)
		}
	}
	mark := itemEntry{ItemType: "perk", ItemID: "0", Status: "wanted", UpdatedAt: 200}
	status, out := put(mark)
	if status != http.StatusOK || len(out["items"].([]any)) != 1 {
		t.Fatalf("update at capacity: %d %v", status, out)
	}
	checkRow("0", "wanted", 200)
	deletion := itemEntry{ItemType: "perk", ItemID: "0", UpdatedAt: 300}
	status, out = put(deletion)
	if status != http.StatusOK || len(out["items"].([]any)) != 0 {
		t.Fatalf("delete at capacity: %d %v", status, out)
	}
	checkRow("0", "", 300)
	// An overflowing batch must roll back even updates performed before the insert.
	status, out = put(itemEntry{ItemType: "perk", ItemID: "0", Status: "wanted", UpdatedAt: 400}, itemEntry{ItemType: "perk", ItemID: "new", Status: "wanted", UpdatedAt: 400})
	if status != http.StatusBadRequest {
		t.Fatalf("new item at capacity: %d %v", status, out)
	}
	if out["error"] != "条目总数已达上限（包括已删除的条目），或标记数量已达上限" {
		t.Errorf("capacity error should mention deleted entries: %v", out)
	}
	checkRow("0", "", 300)
	var count int
	if err := st.db.QueryRow(`SELECT COUNT(*) FROM user_items WHERE user_id = ?`, u.ID).Scan(&count); err != nil || count != 10000 {
		t.Fatalf("row count after rejected batch = %d, err=%v", count, err)
	}
	status, out = doJSON(t, ts, http.MethodGet, "/api/my/items?includeDeleted=1", token, nil)
	if status != http.StatusOK || out["tombstoneProtocol"] != float64(1) || len(out["items"].([]any)) != 10000 {
		t.Fatalf("get at capacity: status=%d", status)
	}
}

func TestItemsProtocolCapabilityAndLegacyShape(t *testing.T) {
	ts, mailer := newTestServer(t)
	token := registerUser(t, ts, mailer, "protocol@example.com", "password123")
	for _, method := range []string{"GET", "PUT"} {
		for _, query := range []string{"", "?includeDeleted=1"} {
			var body any
			if method == "PUT" {
				body = map[string]any{"items": []any{}}
			}
			status, out := doJSON(t, ts, method, "/api/my/items"+query, token, body)
			if status != 200 {
				t.Fatalf("%s %s: %v", method, query, out)
			}
			capability, present := out["tombstoneProtocol"]
			if query == "" && present || query != "" && capability != float64(1) {
				t.Fatalf("%s %s: %v", method, query, out)
			}
		}
	}
}
