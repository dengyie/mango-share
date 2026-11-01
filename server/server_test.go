package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// ---- helpers -----------------------------------------------------------

type mailMsg struct {
	To      string
	Code    string
	Purpose string
}

// captureMailer records verification codes instead of sending mail.
type captureMailer struct {
	mu   sync.Mutex
	sent []mailMsg
}

func (m *captureMailer) SendCode(_ context.Context, to, code, purpose string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sent = append(m.sent, mailMsg{To: to, Code: code, Purpose: purpose})
	return nil
}

func (m *captureMailer) count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.sent)
}

func (m *captureMailer) last(t *testing.T) mailMsg {
	t.Helper()
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.sent) == 0 {
		t.Fatal("no mail captured")
	}
	return m.sent[len(m.sent)-1]
}

func newTestServer(t *testing.T) (*httptest.Server, *captureMailer) {
	t.Helper()
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(st.close)
	mailer := &captureMailer{}
	cfg := LoadConfig()
	cfg.TokenTTL = 24 * time.Hour
	srv := NewServer(cfg, st, mailer, log.New(io.Discard, "", 0))
	var testRequestMu sync.Mutex
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		testRequestMu.Lock()
		defer testRequestMu.Unlock()
		srv.Handler().ServeHTTP(w, r)
		srv.codePending.Wait()
	}))
	t.Cleanup(func() { ts.Close(); _ = srv.Close(context.Background()) })
	return ts, mailer
}

func doJSON(t *testing.T, ts *httptest.Server, method, path, token string, body any) (int, map[string]any) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	req, err := http.NewRequest(method, ts.URL+path, &buf)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	out := map[string]any{}
	_ = json.NewDecoder(res.Body).Decode(&out)
	return res.StatusCode, out
}

// registerUser walks send-code → register and returns the token.
func registerUser(t *testing.T, ts *httptest.Server, mailer *captureMailer, email, password string) string {
	t.Helper()
	status, _ := doJSON(t, ts, "POST", "/api/auth/send-code", "", map[string]string{"email": email, "purpose": purposeRegister})
	if status != http.StatusAccepted {
		t.Fatalf("send-code status = %d", status)
	}
	code := mailer.last(t).Code
	status, out := doJSON(t, ts, "POST", "/api/auth/register", "", map[string]string{
		"email": email, "code": code, "password": password, "displayName": "测试用户",
	})
	if status != http.StatusOK {
		t.Fatalf("register status = %d body=%v", status, out)
	}
	token, _ := out["token"].(string)
	if token == "" {
		t.Fatal("register returned no token")
	}
	return token
}

// failMailer rejects every send (simulates one-mail / Resend being down).
type failMailer struct{}

func (failMailer) SendCode(_ context.Context, _, _, _ string) error {
	return fmt.Errorf("one-mail send status 503: overloaded")
}

// ---- tests -------------------------------------------------------------

func TestRegisterLoginItemsFlow(t *testing.T) {
	ts, mailer := newTestServer(t)
	email := "user@example.com"
	token := registerUser(t, ts, mailer, email, "password123")

	status, out := doJSON(t, ts, "GET", "/api/me", token, nil)
	if status != http.StatusOK {
		t.Fatalf("me status = %d", status)
	}
	u, _ := out["user"].(map[string]any)
	if u["email"] != email || u["displayName"] != "测试用户" {
		t.Fatalf("me user = %v", u)
	}

	// mark two items
	status, out = doJSON(t, ts, "PUT", "/api/my/items", token, map[string]any{
		"items": []map[string]any{
			{"itemType": "u-card", "itemId": "redotpay", "status": "opened", "updatedAt": time.Now().UnixMilli()},
			{"itemType": "perk", "itemId": "oracle-free", "status": "wanted", "updatedAt": time.Now().UnixMilli()},
		},
	})
	if status != http.StatusOK {
		t.Fatalf("put items status = %d %v", status, out)
	}
	if len(out["items"].([]any)) != 2 {
		t.Fatalf("expected 2 items, got %v", out["items"])
	}

	// unmark one
	status, out = doJSON(t, ts, "PUT", "/api/my/items", token, map[string]any{
		"items": []map[string]any{
			{"itemType": "u-card", "itemId": "redotpay", "status": "", "updatedAt": time.Now().UnixMilli()},
		},
	})
	if status != http.StatusOK {
		t.Fatalf("unmark status = %d", status)
	}
	items := out["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["itemId"] != "oracle-free" {
		t.Fatalf("after unmark items = %v", items)
	}

	// logout invalidates session
	doJSON(t, ts, "POST", "/api/auth/logout", token, nil)
	if status, _ := doJSON(t, ts, "GET", "/api/me", token, nil); status != http.StatusUnauthorized {
		t.Fatalf("me after logout status = %d", status)
	}

	// login again works and items persist
	status, out = doJSON(t, ts, "POST", "/api/auth/login", "", map[string]string{"email": email, "password": "password123"})
	if status != http.StatusOK {
		t.Fatalf("login status = %d", status)
	}
	token2 := out["token"].(string)
	status, out = doJSON(t, ts, "GET", "/api/my/items", token2, nil)
	if status != http.StatusOK || len(out["items"].([]any)) != 1 {
		t.Fatalf("items after relogin = %d %v", status, out["items"])
	}
}

func TestSendCodeCooldownAndSuppression(t *testing.T) {
	ts, mailer := newTestServer(t)

	// first send ok
	if status, _ := doJSON(t, ts, "POST", "/api/auth/send-code", "", map[string]string{"email": "a@example.com", "purpose": purposeRegister}); status != http.StatusAccepted {
		t.Fatal("first send-code should be 202")
	}
	// Immediate resend is silently suppressed to avoid account enumeration.
	if status, _ := doJSON(t, ts, "POST", "/api/auth/send-code", "", map[string]string{"email": "a@example.com", "purpose": purposeRegister}); status != http.StatusAccepted {
		t.Fatal("second immediate send-code should be 202")
	}
	if got := mailer.count(); got != 1 {
		t.Fatalf("cooldown must suppress duplicate mail, got %d", got)
	}

	// register an account, then send register code to it: 202 but NO mail
	registerUser(t, ts, mailer, "taken@example.com", "password123")
	n := mailer.count()
	if status, _ := doJSON(t, ts, "POST", "/api/auth/send-code", "", map[string]string{"email": "taken@example.com", "purpose": purposeRegister}); status != http.StatusAccepted {
		t.Fatal("register code for existing email should be 202")
	}
	if got := mailer.count(); got != n {
		t.Fatalf("suppressed send should not mail: %d -> %d", n, got)
	}

	// reset code for unknown email: 202, no mail
	if status, _ := doJSON(t, ts, "POST", "/api/auth/send-code", "", map[string]string{"email": "ghost@example.com", "purpose": purposeReset}); status != http.StatusAccepted {
		t.Fatal("reset code for unknown email should be 202")
	}
	if got := mailer.count(); got != n {
		t.Fatalf("suppressed reset should not mail: %d -> %d", n, got)
	}

	// reset code for existing email does send
	if status, _ := doJSON(t, ts, "POST", "/api/auth/send-code", "", map[string]string{"email": "taken@example.com", "purpose": purposeReset}); status != http.StatusAccepted {
		t.Fatal("reset code for existing email should be 202")
	}
	msg := mailer.last(t)
	if msg.Purpose != purposeReset || msg.To != "taken@example.com" {
		t.Fatalf("unexpected mail %v", msg)
	}
}

func TestWrongCodeAndEnumerationSafety(t *testing.T) {
	ts, mailer := newTestServer(t)
	email := "victim@example.com"

	doJSON(t, ts, "POST", "/api/auth/send-code", "", map[string]string{"email": email, "purpose": purposeRegister})
	_ = mailer.last(t).Code // real code exists; submit a wrong one
	status, _ := doJSON(t, ts, "POST", "/api/auth/register", "", map[string]string{
		"email": email, "code": "000000", "password": "password123",
	})
	if status != http.StatusBadRequest {
		t.Fatalf("register with wrong code status = %d", status)
	}
	// unknown email registering must fail identically (no enumeration)
	status, _ = doJSON(t, ts, "POST", "/api/auth/register", "", map[string]string{
		"email": "never-sent@example.com", "code": "123456", "password": "password123",
	})
	if status != http.StatusBadRequest {
		t.Fatalf("register unknown email status = %d", status)
	}
}

// The admin role is derived from cfg.AdminEmails at response time — no DB
// column, no way to register into it by racing a config change.
func TestRoleDerivedFromAdminEmail(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer st.close()
	mailer := &captureMailer{}
	cfg := LoadConfig()
	cfg.AdminEmails = parseAdminEmails("boss@example.com, Second@example.com ,")
	srv := NewServer(cfg, st, mailer, log.New(io.Discard, "", 0))
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		srv.Handler().ServeHTTP(w, r)
		srv.codePending.Wait()
	}))
	t.Cleanup(func() { ts.Close(); _ = srv.Close(context.Background()) })

	adminToken := registerUser(t, ts, mailer, "boss@example.com", "password123")
	secondToken := registerUser(t, ts, mailer, "second@example.com", "password123")
	userToken := registerUser(t, ts, mailer, "user@example.com", "password123")

	for _, tok := range []string{adminToken, secondToken} {
		status, out := doJSON(t, ts, "GET", "/api/me", tok, nil)
		if status != http.StatusOK {
			t.Fatalf("admin me status = %d", status)
		}
		if u := out["user"].(map[string]any); u["role"] != "admin" {
			t.Fatalf("role = %v, want admin", u["role"])
		}
	}

	status, out := doJSON(t, ts, "GET", "/api/me", userToken, nil)
	if status != http.StatusOK {
		t.Fatalf("user me status = %d", status)
	}
	if u := out["user"].(map[string]any); u["role"] != "user" {
		t.Fatalf("user role = %v, want user", u["role"])
	}

	// login must report the role too (not just /api/me)
	status, out = doJSON(t, ts, "POST", "/api/auth/login", "", map[string]string{
		"email": "BOSS@example.com", "password": "password123",
	})
	if status != http.StatusOK {
		t.Fatalf("admin login status = %d", status)
	}
	if u := out["user"].(map[string]any); u["role"] != "admin" {
		t.Fatalf("login role = %v, want admin (case-insensitive match)", u["role"])
	}

	// an empty admin list means nobody is admin — set explicitly so the
	// case stays hermetic regardless of the CI environment's ADMIN_EMAIL.
	emptyCfg := LoadConfig()
	emptyCfg.AdminEmails = nil
	srv2 := NewServer(emptyCfg, st, mailer, log.New(io.Discard, "", 0))
	ts2 := httptest.NewServer(srv2.Handler())
	t.Cleanup(func() { ts2.Close(); _ = srv2.Close(context.Background()) })
	status, out = doJSON(t, ts2, "GET", "/api/me", adminToken, nil)
	if status != http.StatusOK {
		t.Fatalf("no-admin-config me status = %d", status)
	}
	if u := out["user"].(map[string]any); u["role"] != "user" {
		t.Fatalf("role with empty admin list = %v, want user", u["role"])
	}
}

func TestParseAdminEmails(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want []string
	}{
		{"empty", "", nil},
		{"whitespace only", "   ", nil},
		{"comma only", ",", nil},
		{"commas with spaces", " , , ", nil},
		{"single", "a@b.c", []string{"a@b.c"}},
		{"trim and lowercase", " A@B.C , d@e.f ", []string{"a@b.c", "d@e.f"}},
		{"dedupe case-insensitively", "a@b.c, A@B.C ,a@b.c", []string{"a@b.c"}},
		{"keeps first-seen order", "z@x.y, a@b.c, M@N.O", []string{"z@x.y", "a@b.c", "m@n.o"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := parseAdminEmails(tc.in)
			if len(got) != len(tc.want) {
				t.Fatalf("parseAdminEmails(%q) = %v, want %v", tc.in, got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Fatalf("parseAdminEmails(%q) = %v, want %v", tc.in, got, tc.want)
				}
			}
		})
	}
}

func TestLoginWrongPasswordAndRateLimit(t *testing.T) {
	ts, mailer := newTestServer(t)
	email := "login@example.com"
	registerUser(t, ts, mailer, email, "correct-password")

	for i := 0; i < loginAcctFailures; i++ {
		status, _ := doJSON(t, ts, "POST", "/api/auth/login", "", map[string]string{"email": email, "password": "wrong-pass"})
		if status != http.StatusUnauthorized {
			t.Fatalf("wrong password attempt %d status = %d", i, status)
		}
	}
	// account failure limit reached → 429 even with the correct password
	status, _ := doJSON(t, ts, "POST", "/api/auth/login", "", map[string]string{"email": email, "password": "correct-password"})
	if status != http.StatusTooManyRequests {
		t.Fatalf("after %d failures expected 429, got %d", loginAcctFailures, status)
	}

	// unknown account: identical 401 shape (no enumeration)
	status, _ = doJSON(t, ts, "POST", "/api/auth/login", "", map[string]string{"email": "nobody@example.com", "password": "whatever123"})
	if status != http.StatusUnauthorized {
		t.Fatalf("unknown account login status = %d", status)
	}
}

func TestResetPasswordRevokesSessions(t *testing.T) {
	ts, mailer := newTestServer(t)
	email := "reset@example.com"
	oldToken := registerUser(t, ts, mailer, email, "old-password-1")

	doJSON(t, ts, "POST", "/api/auth/send-code", "", map[string]string{"email": email, "purpose": purposeReset})
	code := mailer.last(t).Code
	status, out := doJSON(t, ts, "POST", "/api/auth/reset-password", "", map[string]string{
		"email": email, "code": code, "password": "new-password-9",
	})
	if status != http.StatusOK {
		t.Fatalf("reset status = %d %v", status, out)
	}
	if status, _ := doJSON(t, ts, "GET", "/api/me", oldToken, nil); status != http.StatusUnauthorized {
		t.Fatal("old session should be revoked after password reset")
	}
	status, _ = doJSON(t, ts, "POST", "/api/auth/login", "", map[string]string{"email": email, "password": "new-password-9"})
	if status != http.StatusOK {
		t.Fatal("login with new password failed")
	}
}

func TestItemsStaleEntryLoses(t *testing.T) {
	ts, mailer := newTestServer(t)
	token := registerUser(t, ts, mailer, "stale@example.com", "password123")

	newer := time.Now().UnixMilli()
	older := newer - 60_000

	status, out := doJSON(t, ts, "PUT", "/api/my/items", token, map[string]any{
		"items": []map[string]any{{"itemType": "sim-card", "itemId": "giffgaff", "status": "opened", "updatedAt": newer}},
	})
	if status != http.StatusOK {
		t.Fatal("seed item failed")
	}
	// stale entry (older updatedAt) must NOT downgrade it to wanted
	status, out = doJSON(t, ts, "PUT", "/api/my/items", token, map[string]any{
		"items": []map[string]any{{"itemType": "sim-card", "itemId": "giffgaff", "status": "wanted", "updatedAt": older}},
	})
	if status != http.StatusOK {
		t.Fatal("stale put failed")
	}
	items := out["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["status"] != "opened" {
		t.Fatalf("stale entry overwrote newer: %v", items)
	}
}

func TestItemsValidationAndCap(t *testing.T) {
	ts, mailer := newTestServer(t)
	token := registerUser(t, ts, mailer, "cap@example.com", "password123")

	status, _ := doJSON(t, ts, "PUT", "/api/my/items", token, map[string]any{
		"items": []map[string]any{{"itemType": "nope", "itemId": "x", "status": "opened", "updatedAt": 1}},
	})
	if status != http.StatusBadRequest {
		t.Fatalf("invalid item type status = %d", status)
	}
	status, _ = doJSON(t, ts, "PUT", "/api/my/items", token, map[string]any{
		"items": []map[string]any{{"itemType": "u-card", "itemId": "x", "status": "maybe", "updatedAt": 1}},
	})
	if status != http.StatusBadRequest {
		t.Fatalf("invalid status = %d", status)
	}

	// per-user cap: filling to exactly the cap is allowed; the next insert
	// fails and rolls back completely.
	mk := func(n int) []map[string]any {
		items := make([]map[string]any, 0, n)
		for i := 0; i < n; i++ {
			items = append(items, map[string]any{
				"itemType": "u-card", "itemId": fmt.Sprintf("card-%04d", i), "status": "wanted", "updatedAt": time.Now().UnixMilli(),
			})
		}
		return items
	}
	status, _ = doJSON(t, ts, "PUT", "/api/my/items", token, map[string]any{"items": mk(maxItemsPerUser)})
	if status != http.StatusOK {
		t.Fatalf("fill to cap status = %d", status)
	}
	status, _ = doJSON(t, ts, "PUT", "/api/my/items", token, map[string]any{
		"items": []map[string]any{{"itemType": "u-card", "itemId": "overflow", "status": "wanted", "updatedAt": time.Now().UnixMilli()}},
	})
	if status != http.StatusBadRequest {
		t.Fatalf("over-cap status = %d", status)
	}
	_, out := doJSON(t, ts, "GET", "/api/my/items", token, nil)
	if got := len(out["items"].([]any)); got != maxItemsPerUser {
		t.Fatalf("items after over-cap = %d, want %d", got, maxItemsPerUser)
	}
}

func TestHealth(t *testing.T) {
	ts, _ := newTestServer(t)
	status, out := doJSON(t, ts, "GET", "/api/health", "", nil)
	if status != http.StatusOK || out["status"] != "ok" {
		t.Fatalf("health = %d %v", status, out)
	}
}

// postWithIP sends a request as if coming from the given client IP (nginx
// sets X-Real-IP in production; tests set it directly).
func postWithIP(t *testing.T, ts *httptest.Server, ip string, path string, body any) int {
	t.Helper()
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(body); err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest(http.MethodPost, ts.URL+path, &buf)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Real-IP", ip)
	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	return res.StatusCode
}

// A third party hammering a victim's email with suppressed send-code
// requests must not consume the victim's per-account daily budget.
func TestSendCodeSuppressionKeepsAccountBudget(t *testing.T) {
	ts, mailer := newTestServer(t)
	registerUser(t, ts, mailer, "victim@example.com", "password123")
	sentBefore := mailer.count() // the registration mail itself

	suppressed202 := 0
	for i := 0; i < 12; i++ {
		status := postWithIP(t, ts, "9.9.9.9", "/api/auth/send-code",
			map[string]string{"email": "victim@example.com", "purpose": purposeRegister})
		if status == http.StatusAccepted {
			suppressed202++
		}
	}
	if suppressed202 == 0 {
		t.Fatal("no suppressed request got through (attacker IP budget misconfigured)")
	}
	if got := mailer.count(); got != sentBefore {
		t.Fatalf("suppressed sends mailed codes: %d -> %d", sentBefore, got)
	}

	// The victim (own IP) can still get a real reset code the same day.
	status := postWithIP(t, ts, "8.8.8.8", "/api/auth/send-code",
		map[string]string{"email": "victim@example.com", "purpose": purposeReset})
	if status != http.StatusAccepted {
		t.Fatalf("reset after suppressed flood status = %d (account budget was burned)", status)
	}
	if got := mailer.count(); got != sentBefore+1 {
		t.Fatalf("reset code not mailed: %d -> %d", sentBefore, got)
	}
}

// Concurrent send-code requests for the same email+purpose must produce
// exactly one mailed code: the cooldown is enforced atomically inside
// saveCode, so the losers are silently suppressed instead of sending mail.
func TestSendCodeConcurrentSendsOneMail(t *testing.T) {
	ts, mailer := newTestServer(t)

	const racers = 8
	statuses := make([]int, racers)
	var wg sync.WaitGroup
	for i := 0; i < racers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			statuses[i], _ = doJSON(t, ts, "POST", "/api/auth/send-code", "",
				map[string]string{"email": "race@example.com", "purpose": purposeRegister})
		}(i)
	}
	wg.Wait()

	for _, status := range statuses {
		if status != http.StatusAccepted {
			t.Fatalf("expected all 202, got %v", statuses)
		}
	}
	mailed := mailer.count()
	if mailed != 1 {
		t.Fatalf("exactly one mail expected, got %d", mailed)
	}

	// The stored code must be the one that was mailed: register succeeds
	// with it.
	code := mailer.last(t).Code
	status, out := doJSON(t, ts, "POST", "/api/auth/register", "", map[string]string{
		"email": "race@example.com", "code": code, "password": "password123",
	})
	if status != http.StatusOK {
		t.Fatalf("register with mailed code status = %d %v", status, out)
	}
}

// A code must never reach an inbox without being verifiable: the row is
// persisted before sending and rolled back when the send fails.
func TestSendCodeMailFailureLeavesNoCode(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(st.close)
	srv := NewServer(LoadConfig(), st, failMailer{}, log.New(io.Discard, "", 0))
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(func() { ts.Close(); _ = srv.Close(context.Background()) })

	status, _ := doJSON(t, ts, "POST", "/api/auth/send-code", "",
		map[string]string{"email": "fail@example.com", "purpose": purposeRegister})
	if status != http.StatusAccepted {
		t.Fatalf("send-code with failing mailer status = %d", status)
	}
	srv.codePending.Wait()
	if _, err := st.getCode("fail@example.com", purposeRegister); !errors.Is(err, errNotFound) {
		t.Fatalf("failed send must not leave a code row, got %v", err)
	}
}

func TestRateLimiterSweepsExpiredBuckets(t *testing.T) {
	rl := newRateLimiter()
	expired := time.Now().Add(-time.Minute)
	rl.mu.Lock()
	for i := 0; i < maxRLBuckets; i++ {
		rl.buckets[fmt.Sprintf("k%d", i)] = &rlBucket{count: 1, window: expired, period: time.Second}
	}
	rl.mu.Unlock()

	// len has reached the cap: the next allow must sweep the expired
	// buckets before inserting its own.
	if !rl.allow("trigger", 5, time.Hour) {
		t.Fatal("trigger allow rejected")
	}
	if len(rl.buckets) != 1 {
		t.Fatalf("expired buckets not swept, still %d", len(rl.buckets))
	}
}

func TestPasswordValidation(t *testing.T) {
	ts, mailer := newTestServer(t)
	email := "pw@example.com"
	doJSON(t, ts, "POST", "/api/auth/send-code", "", map[string]string{"email": email, "purpose": purposeRegister})
	code := mailer.last(t).Code

	// short password rejected before the code is consumed
	status, _ := doJSON(t, ts, "POST", "/api/auth/register", "", map[string]string{
		"email": email, "code": code, "password": "short12",
	})
	if status != http.StatusBadRequest {
		t.Fatalf("short password register status = %d", status)
	}
	// same code still works with a valid password
	status, out := doJSON(t, ts, "POST", "/api/auth/register", "", map[string]string{
		"email": email, "code": code, "password": "password123",
	})
	if status != http.StatusOK {
		t.Fatalf("register with same code status = %d %v", status, out)
	}
}

func TestOneMailMailer(t *testing.T) {
	var gotPath string
	var gotBody map[string]any
	var gotStatus int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &gotBody)
		w.WriteHeader(gotStatus)
		if gotStatus == 200 {
			_, _ = w.Write([]byte(`{"status":"ok"}`))
		} else {
			_, _ = w.Write([]byte(`send blocked`))
		}
	}))
	defer srv.Close()

	m := newOneMailMailer(srv.URL, "jwt-secret", "MangoShare")

	// success path posts the full one-mail payload
	gotStatus = 200
	if err := m.SendCode(context.Background(), "user@example.com", "123456", purposeRegister); err != nil {
		t.Fatalf("SendCode ok: %v", err)
	}
	if gotPath != "/external/api/send_mail" {
		t.Fatalf("path = %s", gotPath)
	}
	if gotBody["token"] != "jwt-secret" || gotBody["to_mail"] != "user@example.com" ||
		gotBody["from_name"] != "MangoShare" || gotBody["is_html"] != true ||
		gotBody["subject"] != mailSubject(purposeRegister) {
		t.Fatalf("unexpected body: %v", gotBody)
	}
	if content, _ := gotBody["content"].(string); !strings.Contains(content, "123456") {
		t.Fatalf("content missing code")
	}

	// HTTP error surfaces status and body snippet
	gotStatus = 403
	err := m.SendCode(context.Background(), "user@example.com", "123456", purposeRegister)
	if err == nil || !strings.Contains(err.Error(), "403") || !strings.Contains(err.Error(), "send blocked") {
		t.Fatalf("error = %v", err)
	}
}
