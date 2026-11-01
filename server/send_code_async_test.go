package main

import (
	"bytes"
	"context"
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

type blockingCodeMailer struct {
	started chan struct{}
	release chan struct{}
}

func (m *blockingCodeMailer) SendCode(ctx context.Context, _, _, _ string) error {
	close(m.started)
	select {
	case <-m.release:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func TestSendCodeQueueSaturationAndShutdown(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	if _, err := st.createUser("taken@example.com", "hash", ""); err != nil {
		t.Fatal(err)
	}
	m := &blockingCodeMailer{started: make(chan struct{}), release: make(chan struct{})}
	s := NewServer(LoadConfig(), st, m, log.New(io.Discard, "", 0))
	request := func(email string, i int) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodPost, "/api/auth/send-code", bytes.NewBufferString(`{"email":"`+email+`","purpose":"register"}`))
		r.RemoteAddr = fmt.Sprintf("198.51.%d.%d:1234", i/250, i%250+1)
		w := httptest.NewRecorder()
		s.Handler().ServeHTTP(w, r)
		return w
	}
	if got := request("free@example.com", 0); got.Code != http.StatusAccepted {
		t.Fatal(got.Code)
	}
	select {
	case <-m.started:
	case <-time.After(time.Second):
		t.Fatal("mailer did not start")
	}
	for i := 1; ; i++ {
		if got := request("free@example.com", i); got.Code == http.StatusServiceUnavailable {
			break
		} else if got.Code != http.StatusAccepted || i > codeQueueSize+codeWorkerCount {
			t.Fatalf("queue slot %d: %d", i, got.Code)
		}
	}
	a, b := request("taken@example.com", 200), request("other@example.com", 201)
	if a.Code != http.StatusServiceUnavailable || a.Code != b.Code || a.Body.String() != b.Body.String() {
		t.Fatalf("queue full responses differ: %d %s / %d %s", a.Code, a.Body.String(), b.Code, b.Body.String())
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := s.Close(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("close: %v", err)
	}
	<-s.codeDone
	if _, err := st.getCode("free@example.com", purposeRegister); !errors.Is(err, errNotFound) {
		t.Fatalf("cancelled mail code remained: %v", err)
	}
	if got := request("other@example.com", 202); got.Code != http.StatusServiceUnavailable {
		t.Fatalf("closed queue: %d", got.Code)
	}
}

type replaceCodeMailer struct{ st *store }

func (m replaceCodeMailer) SendCode(_ context.Context, email, _, purpose string) error {
	if err := m.st.saveCode(email, purpose, sha256Hex("654321"), time.Minute, 0); err != nil {
		return err
	}
	return errors.New("delivery failed")
}

func TestSendCodeFailureDoesNotDeleteNewerCode(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	s := NewServer(LoadConfig(), st, replaceCodeMailer{st}, log.New(io.Discard, "", 0))
	defer s.Close(context.Background())
	s.processCodeJob(codeJob{email: "replace@example.com", purpose: purposeRegister, queuedAt: time.Now()})
	row, err := st.getCode("replace@example.com", purposeRegister)
	if err != nil || row.CodeHash != sha256Hex("654321") {
		t.Fatalf("newer code deleted: %v %v", row, err)
	}
}

func TestSendCodeStaleJobsAreDropped(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	m := &captureMailer{}
	s := NewServer(LoadConfig(), st, m, log.New(io.Discard, "", 0))
	defer s.Close(context.Background())
	s.processCodeJob(codeJob{email: "stale@example.com", purpose: purposeRegister, queuedAt: time.Now().Add(-sendCodeCooldown)})
	if m.count() != 0 {
		t.Fatal("stale request sent")
	}
	if _, err := st.getCode("stale@example.com", purposeRegister); !errors.Is(err, errNotFound) {
		t.Fatalf("stale request saved a code: %v", err)
	}
}

func TestSendCodeCooldownDoesNotConsumeDailyQuota(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	m := &captureMailer{}
	s := NewServer(LoadConfig(), st, m, log.New(io.Discard, "", 0))
	defer s.Close(context.Background())
	job := codeJob{email: "quota@example.com", purpose: purposeRegister, queuedAt: time.Now()}
	s.processCodeJob(job)
	for i := 0; i < 20; i++ {
		s.processCodeJob(job)
	}
	s.rl.mu.Lock()
	count := s.rl.buckets["sc:acct:quota@example.com"].count
	s.rl.mu.Unlock()
	if count != 1 || m.count() != 1 {
		t.Fatalf("cooldown charged quota: count=%d mails=%d", count, m.count())
	}
}

func TestSendCodeDoesNotWaitForSlowMailer(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	if _, err := st.createUser("taken@example.com", "hash", ""); err != nil {
		t.Fatal(err)
	}
	mailer := &blockingCodeMailer{started: make(chan struct{}), release: make(chan struct{})}
	srv := NewServer(LoadConfig(), st, mailer, log.New(io.Discard, "", 0))
	defer srv.Close(context.Background())
	request := func(email string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodPost, "/api/auth/send-code", bytes.NewBufferString(`{"email":"`+email+`","purpose":"register"}`))
		r.RemoteAddr = "192.0.2.1:1234"
		w := httptest.NewRecorder()
		srv.Handler().ServeHTTP(w, r)
		return w
	}
	suppressed := request("taken@example.com")
	done := make(chan *httptest.ResponseRecorder, 1)
	go func() { done <- request("free@example.com") }()
	select {
	case <-mailer.started:
	case <-time.After(time.Second):
		close(mailer.release)
		t.Fatal("mailer did not start")
	}
	select {
	case result := <-done:
		close(mailer.release)
		if result.Code != suppressed.Code || result.Body.String() != suppressed.Body.String() {
			t.Fatalf("different responses: %d %s vs %d %s", result.Code, result.Body.String(), suppressed.Code, suppressed.Body.String())
		}
	case <-time.After(200 * time.Millisecond):
		close(mailer.release)
		<-done
		t.Fatal("eligible response waited for blocked mailer, unlike suppressed response")
	}
}

type stuckFirstMailer struct {
	started chan struct{}
	release chan struct{}
	second  chan struct{}
	once    sync.Once
}

func (m *stuckFirstMailer) SendCode(_ context.Context, to, _, _ string) error {
	if to == "blocked@example.com" {
		close(m.started)
		<-m.release
	} else {
		m.once.Do(func() { close(m.second) })
	}
	return nil
}

func TestQueueBlockedMailerDoesNotBlockOtherJobs(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	m := &stuckFirstMailer{started: make(chan struct{}), release: make(chan struct{}), second: make(chan struct{})}
	s := NewServer(LoadConfig(), st, m, log.New(io.Discard, "", 0))
	defer func() { close(m.release); s.Close(context.Background()) }()
	s.codePending.Add(2)
	s.codeJobs <- codeJob{email: "blocked@example.com", purpose: purposeRegister, queuedAt: time.Now()}
	select {
	case <-m.started:
	case <-time.After(time.Second):
		t.Fatal("first mail did not start")
	}
	s.codeJobs <- codeJob{email: "second@example.com", purpose: purposeRegister, queuedAt: time.Now()}
	select {
	case <-m.second:
	case <-time.After(300 * time.Millisecond):
		t.Fatal("second job blocked behind stalled mail")
	}
}

func TestQueueCloseHonorsDeadlineWithUncooperativeMailer(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	m := &stuckFirstMailer{started: make(chan struct{}), release: make(chan struct{}), second: make(chan struct{})}
	s := NewServer(LoadConfig(), st, m, log.New(io.Discard, "", 0))
	s.codePending.Add(1)
	s.codeJobs <- codeJob{email: "blocked@example.com", purpose: purposeRegister, queuedAt: time.Now()}
	<-m.started
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- s.Close(ctx) }()
	select {
	case err := <-done:
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Errorf("close: %v", err)
		}
	case <-time.After(300 * time.Millisecond):
		t.Error("close exceeded deadline")
	}
	close(m.release)
	<-s.codeDone
}

func TestQueueStaleDropIsLogged(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	var logs bytes.Buffer
	s := NewServer(LoadConfig(), st, &captureMailer{}, log.New(&logs, "", 0))
	defer s.Close(context.Background())
	s.processCodeJob(codeJob{email: "stale@example.com", purpose: purposeRegister, queuedAt: time.Now().Add(-sendCodeCooldown)})
	if !strings.Contains(logs.String(), "stale") {
		t.Fatalf("missing stale drop log: %q", logs.String())
	}
}

func TestQueueRejectionDoesNotConsumeIPQuota(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	var logs bytes.Buffer
	s := &Server{rl: newRateLimiter(), codeJobs: make(chan codeJob, codeQueueSize), logger: log.New(&logs, "", 0)}
	for len(s.codeJobs) < cap(s.codeJobs) {
		s.codePending.Add(1)
		s.codeJobs <- codeJob{}
	}
	r := httptest.NewRequest(http.MethodPost, "/api/auth/send-code", strings.NewReader(`{"email":"free@example.com","purpose":"register"}`))
	r.RemoteAddr = "192.0.2.44:1234"
	w := httptest.NewRecorder()
	s.handleSendCode(w, r)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected full queue: %d", w.Code)
	}
	s.rl.mu.Lock()
	b := s.rl.buckets["sc:ip:192.0.2.44"]
	s.rl.mu.Unlock()
	if b != nil {
		t.Fatalf("rejected request charged IP quota: %d", b.count)
	}
	if !strings.Contains(logs.String(), "queue full") {
		t.Fatalf("missing saturation log: %q", logs.String())
	}
}

func TestQueueDeliveryFailureConsumesDailyQuota(t *testing.T) {
	st, err := openStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.close()
	s := NewServer(LoadConfig(), st, failingCodeMailer{}, log.New(io.Discard, "", 0))
	defer s.Close(context.Background())
	job := codeJob{email: "failed@example.com", purpose: purposeRegister, queuedAt: time.Now()}
	for i := 0; i < sendDailyLimit+1; i++ {
		s.processCodeJob(job)
	}
	s.rl.mu.Lock()
	b := s.rl.buckets["sc:acct:failed@example.com"]
	s.rl.mu.Unlock()
	if b == nil || b.count != sendDailyLimit {
		t.Fatalf("failed deliveries not charged: %+v", b)
	}
	if _, err := st.getCode(job.email, job.purpose); !errors.Is(err, errNotFound) {
		t.Fatalf("failed code remains: %v", err)
	}
}

type failingCodeMailer struct{}

func (failingCodeMailer) SendCode(context.Context, string, string, string) error {
	return errors.New("delivery failed")
}

// Admission must stay bounded even when every rate-limit key is still live.
func TestQueueRateLimiterBoundsLiveKeys(t *testing.T) {
	rl := newRateLimiter()
	for i := 0; i < maxRLBuckets; i++ {
		if !rl.allow(fmt.Sprintf("ip:%d", i), 1, time.Hour) {
			t.Fatal("premature rejection")
		}
	}
	if rl.allow("overflow", 1, time.Hour) {
		t.Fatal("admitted key beyond bound")
	}
	if len(rl.buckets) != maxRLBuckets {
		t.Fatalf("unbounded buckets: %d", len(rl.buckets))
	}
}
