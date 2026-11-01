package main

import (
	"context"
	"errors"
	"hash/fnv"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	// per-request limit matches the per-user cap: the client merge sync
	// uploads the full merged list in one call.
	maxItemsPerRequest = 2000
	maxItemsPerUser    = 2000

	sendCodeCooldown  = 60 * time.Second
	sendIPHourlyLimit = 10
	sendDailyLimit    = 10
	loginIPWindow     = 15 * time.Minute
	loginIPFailures   = 20
	loginAcctFailures = 10
)

// itemType whitelist — item ids are opaque strings anchored in the static
// frontend catalog (slug/id).
var itemTypes = map[string]bool{
	"u-card":      true,
	"sim-card":    true,
	"credit-card": true,
	"perk":        true,
	"ai-station":  true,
}

var itemStatuses = map[string]bool{
	"opened": true,
	"wanted": true,
}

type Server struct {
	cfg          Config
	st           *store
	mailer       Mailer
	logger       *log.Logger
	rl           *rateLimiter
	mux          *http.ServeMux
	codeMu       sync.Mutex
	codeClosed   bool
	codeJobs     chan codeJob
	codeDone     chan struct{}
	codeCtx      context.Context
	codeCancel   context.CancelFunc
	codePending  sync.WaitGroup
	codeWorkers  sync.WaitGroup
	codeAccounts [64]sync.Mutex
}

type codeJob struct {
	email, purpose string
	queuedAt       time.Time
}

const codeQueueSize = 64
const codeWorkerCount = 4
const codeSendTimeout = 15 * time.Second

// Close stops accepting work and drains accepted requests before the store closes.
// If the deadline expires, in-flight mail is cancelled and queued jobs are dropped.
func (s *Server) Close(ctx context.Context) error {
	s.codeMu.Lock()
	if !s.codeClosed {
		s.codeClosed = true
		close(s.codeJobs)
	}
	s.codeMu.Unlock()
	select {
	case <-s.codeDone:
		return nil
	case <-ctx.Done():
		s.codeCancel()
		return ctx.Err()
	}
}

func (s *Server) runCodeJobs() {
	defer s.codeWorkers.Done()
	for job := range s.codeJobs {
		if s.codeCtx.Err() == nil {
			s.processCodeJob(job)
		} else {
			s.logger.Print("send-code job dropped: shutdown")
		}
		s.codePending.Done()
	}
}

func NewServer(cfg Config, st *store, mailer Mailer, logger *log.Logger) *Server {
	s := &Server{cfg: cfg, st: st, mailer: mailer, logger: logger, rl: newRateLimiter(), codeJobs: make(chan codeJob, codeQueueSize), codeDone: make(chan struct{})}
	s.codeCtx, s.codeCancel = context.WithCancel(context.Background())
	s.codeWorkers.Add(codeWorkerCount)
	for i := 0; i < codeWorkerCount; i++ {
		go s.runCodeJobs()
	}
	go func() {
		s.codeWorkers.Wait()
		s.codeCancel()
		close(s.codeDone)
	}()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("POST /api/auth/send-code", s.handleSendCode)
	mux.HandleFunc("POST /api/auth/register", s.handleRegister)
	mux.HandleFunc("POST /api/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/auth/reset-password", s.handleResetPassword)
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)
	mux.HandleFunc("GET /api/me", s.handleMe)
	mux.HandleFunc("GET /api/my/items", s.handleGetItems)
	mux.HandleFunc("PUT /api/my/items", s.handlePutItems)
	s.mux = mux
	return s
}

func (s *Server) Handler() http.Handler {
	return s.logRequests(s.securityHeaders(s.mux))
}

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: 200}
		next.ServeHTTP(rec, r)
		s.logger.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(start).Round(time.Millisecond))
	})
}

type publicUser struct {
	ID          int64  `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	CreatedAt   int64  `json:"createdAt"`
	Role        string `json:"role"`
}

// roleOf derives the UI role from the configured admin email. It only gates
// the admin-console entry in the frontend — actual admin powers stay with
// the API station's own credential store, which the console authenticates
// against separately.
func (s *Server) roleOf(email string) string {
	e := strings.ToLower(email)
	for _, admin := range s.cfg.AdminEmails {
		if e == admin {
			return "admin"
		}
	}
	return "user"
}

func (s *Server) toPublicUser(u *user) publicUser {
	return publicUser{
		ID:          u.ID,
		Email:       u.Email,
		DisplayName: u.DisplayName,
		CreatedAt:   u.CreatedAt,
		Role:        s.roleOf(u.Email),
	}
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(h) <= len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
		return ""
	}
	return strings.TrimSpace(h[len(prefix):])
}

// authUser resolves the request's bearer token to a user.
func (s *Server) authUser(r *http.Request) (*user, error) {
	token := bearerToken(r)
	if token == "" {
		return nil, errNotFound
	}
	return s.st.sessionUser(token, s.cfg.TokenTTL)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ---- send-code ---------------------------------------------------------

func (s *Server) handleSendCode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email   string `json:"email"`
		Purpose string `json:"purpose"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	email := normalizeEmail(req.Email)
	purpose := req.Purpose
	if !validEmail(email) || (purpose != purposeRegister && purpose != purposeReset) {
		writeError(w, http.StatusBadRequest, "邮箱格式不正确")
		return
	}

	ip := clientIP(r)
	// Admission is independent of account existence, cooldown and mailer latency.
	s.codeMu.Lock()
	if s.codeClosed {
		s.codeMu.Unlock()
		writeError(w, http.StatusServiceUnavailable, "服务暂时不可用，请稍后再试")
		return
	}
	if len(s.codeJobs) == cap(s.codeJobs) {
		s.codeMu.Unlock()
		s.logger.Print("send-code queue full: admission rejected")
		writeError(w, http.StatusServiceUnavailable, "服务繁忙，请稍后再试")
		return
	}
	if !s.rl.allow("sc:ip:"+ip, sendIPHourlyLimit, time.Hour) {
		s.codeMu.Unlock()
		writeError(w, http.StatusTooManyRequests, "发送过于频繁，请稍后再试")
		return
	}
	s.codePending.Add(1)
	select {
	case s.codeJobs <- codeJob{email: email, purpose: purpose, queuedAt: time.Now()}:
		s.codeMu.Unlock()
		writeJSON(w, http.StatusAccepted, map[string]bool{"ok": true})
	default:
		s.codePending.Done()
		s.codeMu.Unlock()
		writeError(w, http.StatusServiceUnavailable, "服务繁忙，请稍后再试")
	}
}

// Workers are independent of request contexts. The queue is memory-only: a
// crash or forced shutdown can lose accepted jobs; acceptance is not delivery.
func (s *Server) processCodeJob(job codeJob) {
	email, purpose := job.email, job.purpose
	h := fnv.New32a()
	_, _ = h.Write([]byte(email))
	accountLock := &s.codeAccounts[h.Sum32()%uint32(len(s.codeAccounts))]
	accountLock.Lock()
	defer accountLock.Unlock()
	// Do not deliver stale queued requests after the user's resend window.
	if time.Since(job.queuedAt) >= sendCodeCooldown {
		s.logger.Print("send-code job dropped: stale")
		return
	}
	if s.codeCtx.Err() != nil {
		s.logger.Print("send-code job dropped: shutdown")
		return
	}
	exists, err := s.st.userExists(email)
	if err != nil {
		s.logger.Printf("send-code lookup failed: %v", err)
		return
	}
	if (purpose == purposeRegister && exists) || (purpose == purposeReset && !exists) {
		return
	}
	row, err := s.st.getCode(email, purpose)
	if err == nil && time.Now().Unix()-row.LastSentAt < int64(sendCodeCooldown.Seconds()) {
		return
	}
	if err != nil && !errors.Is(err, errNotFound) {
		s.logger.Printf("send-code lookup failed: %v", err)
		return
	}
	// Charge delivery attempts, including failures and ambiguous timeouts, to
	// prevent unlimited retries when the provider reports an error.
	if !s.rl.allow("sc:acct:"+email, sendDailyLimit, 24*time.Hour) {
		return
	}
	code, err := randomCode()
	if err != nil {
		s.logger.Printf("send-code generation failed: %v", err)
		return
	}
	hash := sha256Hex(code)
	if err := s.st.saveCode(email, purpose, hash, s.cfg.CodeTTL, sendCodeCooldown); err != nil {
		if !errors.Is(err, errCooldown) {
			s.logger.Printf("send-code save failed: %v", err)
		}
		return
	}
	ctx, cancel := context.WithTimeout(s.codeCtx, codeSendTimeout)
	defer cancel()
	if err := s.mailer.SendCode(ctx, email, code, purpose); err != nil {
		s.logger.Printf("send mail email=%s failed: %v", email, err)
		// Never delete a newer code installed while this delivery was in flight.
		if _, err := s.st.db.Exec(`DELETE FROM email_codes WHERE email = ? AND purpose = ? AND code_hash = ?`, email, purpose, hash); err != nil {
			s.logger.Printf("send-code rollback failed: %v", err)
		}
	}
}

// ---- register / login / reset ------------------------------------------

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email       string `json:"email"`
		Code        string `json:"code"`
		Password    string `json:"password"`
		DisplayName string `json:"displayName"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	email := normalizeEmail(req.Email)
	if !validEmail(email) || !validCode(req.Code) || !validPassword(req.Password) {
		writeError(w, http.StatusBadRequest, "注册信息不完整或格式不正确")
		return
	}
	if !s.rl.allow("reg:ip:"+clientIP(r), 10, time.Hour) {
		writeError(w, http.StatusTooManyRequests, "操作过于频繁，请稍后再试")
		return
	}

	// Unknown emails never receive a register code, so a failing code check
	// here covers both wrong code and "email already registered" without
	// leaking which.
	if err := s.st.verifyCode(email, purposeRegister, req.Code); err != nil {
		writeError(w, http.StatusBadRequest, "验证码无效或已过期，请重新获取")
		return
	}
	exists, err := s.st.userExists(email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	if exists {
		writeError(w, http.StatusBadRequest, "注册失败，请重新获取验证码后再试")
		return
	}
	hash, err := hashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	u, err := s.st.createUser(email, hash, sanitizeDisplayName(req.DisplayName, email))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	token, err := s.st.createSession(u.ID, s.cfg.TokenTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	s.logger.Printf("registered user id=%d email=%s ip=%s", u.ID, email, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": s.toPublicUser(u)})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	email := normalizeEmail(req.Email)
	ip := clientIP(r)
	if !validEmail(email) || req.Password == "" {
		writeError(w, http.StatusBadRequest, "请输入邮箱与密码")
		return
	}
	if !s.rl.allow("login:ip:"+ip, loginIPFailures, loginIPWindow) ||
		!s.rl.allow("login:acct:"+email, loginAcctFailures, loginIPWindow) {
		writeError(w, http.StatusTooManyRequests, "尝试过于频繁，请稍后再试")
		return
	}

	u, err := s.st.userByEmail(email)
	if err != nil {
		if errors.Is(err, errNotFound) {
			s.failLogin(email, req.Password)
			writeError(w, http.StatusUnauthorized, "邮箱或密码错误")
			return
		}
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	if !checkPassword(u.PasswordHash, req.Password) {
		writeError(w, http.StatusUnauthorized, "邮箱或密码错误")
		return
	}
	s.rl.reset("login:acct:" + email)
	token, err := s.st.createSession(u.ID, s.cfg.TokenTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": s.toPublicUser(u)})
}

// failLogin burns a bcrypt comparison for non-existent accounts so timing
// matches the existing-account path.
func (s *Server) failLogin(email, password string) {
	_ = checkPassword(dummyHashFor(email), password)
}

// dummyHashFor deterministically produces a bcrypt-looking string; using a
// real bcrypt hash of a random per-email value keeps cost identical.
var dummyHashMu sync.Mutex
var dummyHashes = map[string]string{}

func dummyHashFor(email string) string {
	dummyHashMu.Lock()
	defer dummyHashMu.Unlock()
	if h, ok := dummyHashes[email]; ok {
		return h
	}
	h, _ := hashPassword(sha256Hex("dummy:" + email)[:24])
	if len(dummyHashes) > 1000 {
		dummyHashes = map[string]string{}
	}
	dummyHashes[email] = h
	return h
}

func (s *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Code     string `json:"code"`
		Password string `json:"password"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	email := normalizeEmail(req.Email)
	if !validEmail(email) || !validCode(req.Code) || !validPassword(req.Password) {
		writeError(w, http.StatusBadRequest, "重置信息不完整或格式不正确")
		return
	}
	if !s.rl.allow("reset:ip:"+clientIP(r), 10, time.Hour) {
		writeError(w, http.StatusTooManyRequests, "操作过于频繁，请稍后再试")
		return
	}
	u, err := s.st.userByEmail(email)
	if err != nil {
		if errors.Is(err, errNotFound) {
			writeError(w, http.StatusBadRequest, "验证码无效或已过期，请重新获取")
			return
		}
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	if err := s.st.verifyCode(email, purposeReset, req.Code); err != nil {
		writeError(w, http.StatusBadRequest, "验证码无效或已过期，请重新获取")
		return
	}
	hash, err := hashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	if err := s.st.setPassword(u.ID, hash); err != nil {
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	// Password changed: revoke everything, hand back a fresh session.
	if err := s.st.revokeSessions(u.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	token, err := s.st.createSession(u.ID, s.cfg.TokenTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	s.logger.Printf("password reset user id=%d ip=%s", u.ID, clientIP(r))
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": s.toPublicUser(u)})
}

// ---- session -----------------------------------------------------------

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if token := bearerToken(r); token != "" {
		_ = s.st.deleteSessionByHash(sha256Hex(token))
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	u, err := s.authUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "未登录或登录已过期")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": s.toPublicUser(u)})
}

// ---- items -------------------------------------------------------------

func (s *Server) handleGetItems(w http.ResponseWriter, r *http.Request) {
	u, err := s.authUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "未登录或登录已过期")
		return
	}
	items, err := s.st.listItemsWithDeleted(u.ID, r.URL.Query().Get("includeDeleted") == "1")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	response := map[string]any{"items": items}
	if r.URL.Query().Get("includeDeleted") == "1" {
		response["tombstoneProtocol"] = 1
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Server) handlePutItems(w http.ResponseWriter, r *http.Request) {
	u, err := s.authUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "未登录或登录已过期")
		return
	}
	var req struct {
		Items []itemEntry `json:"items"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	if len(req.Items) > maxItemsPerRequest {
		writeError(w, http.StatusBadRequest, "单次同步条目过多")
		return
	}
	nowMS := time.Now().UnixMilli()
	cleaned := make([]itemEntry, 0, len(req.Items))
	seen := make(map[string]bool, len(req.Items))
	for _, it := range req.Items {
		if !itemTypes[it.ItemType] || it.ItemID == "" || len(it.ItemID) > 128 {
			writeError(w, http.StatusBadRequest, "条目格式不正确")
			return
		}
		if it.Status != "" && !itemStatuses[it.Status] {
			writeError(w, http.StatusBadRequest, "条目状态不正确")
			return
		}
		if it.UpdatedAt <= 0 || it.UpdatedAt > nowMS+60_000 {
			it.UpdatedAt = nowMS
		}
		key := it.ItemType + ":" + it.ItemID
		if seen[key] {
			continue
		}
		seen[key] = true
		cleaned = append(cleaned, it)
	}
	items, err := s.st.applyItems(u.ID, cleaned, maxItemsPerUser)
	if err == nil && r.URL.Query().Get("includeDeleted") == "1" {
		items, err = s.st.listItemsWithDeleted(u.ID, true)
	}
	if err != nil {
		if errors.Is(err, errTooManyItems) {
			writeError(w, http.StatusBadRequest, "条目总数已达上限（包括已删除的条目），或标记数量已达上限")
			return
		}
		writeError(w, http.StatusInternalServerError, "服务暂时不可用，请稍后再试")
		return
	}
	response := map[string]any{"items": items}
	if r.URL.Query().Get("includeDeleted") == "1" {
		response["tombstoneProtocol"] = 1
	}
	writeJSON(w, http.StatusOK, response)
}
